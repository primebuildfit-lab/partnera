//! Partnera Creator — desktop thin client (Tauri 2).
//!
//! This is *packaging only*: it bundles **no runtime** — there is no local Node
//! server and no local database. On launch we:
//!   1. resolve the central API base URL (env `PARTNERA_API_URL`, else the
//!      documented Railway default),
//!   2. show a tiny local splash,
//!   3. navigate the window to `${API}/creator` (the Creator Portal) over HTTPS.
//!
//! The central API is the single source of truth (packages/web → shared Postgres),
//! so the Creator Portal UI is always the live version; the auto-updater only
//! refreshes this native shell. No campaign / commission / tracking logic lives
//! here — it is reused from the central app.
//!
//! Security posture:
//!   * the loaded web content gets NO Tauri IPC (see capabilities);
//!   * only the configured API host loads inside the window; any other external
//!     link opens in the system browser via a host allowlist;
//!   * deep links (`partnera-creator://`) are accepted **only** for `/creator…`
//!     paths on the configured host — never any other scope or host;
//!   * a single running instance is enforced, so a second launch (or an OS deep
//!     link dispatch) is routed to the existing window.

mod updater;

use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::json;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_deep_link::DeepLinkExt;
use tauri_plugin_opener::OpenerExt;

/// The default central API base URL when `PARTNERA_API_URL` is not set. This is
/// the deployed Partnera web host on Railway (the same one the Shopify pilot uses).
const DEFAULT_API_URL: &str = "https://partnera-web-production.up.railway.app";

/// The creator surface path served by the central app. This is the ONLY surface
/// this desktop opens; other scopes (business/affiliate/admin/ops/internal) are
/// never navigated to.
const CREATOR_PATH: &str = "/creator";

/// Custom deep-link scheme registered by the installer (see tauri.conf.json).
const DEEP_LINK_SCHEME: &str = "partnera-creator:";

/// Hosts whose links may be opened in the system browser (allowlist). Exact host
/// or any subdomain of these registrable domains.
const EXTERNAL_ALLOWLIST: &[&str] = &[
    "shopify.com",
    "myshopify.com",
    "admin.shopify.com",
    "railway.app",
    "up.railway.app",
    "supabase.com",
    "supabase.co",
    "github.com",
    "primebuildfit.com",
];

#[derive(Default)]
struct Runtime {
    log_file: Mutex<Option<PathBuf>>,
    /// Host of the configured API base URL — the only host allowed in-window.
    api_host: Mutex<Option<String>>,
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// Append a line to the local desktop log. Never logs secrets — callers pass only
/// safe, structured messages.
///
/// The whole record is formatted into one buffer and written with a single
/// `write_all`, because the boot path and the updater log from different threads:
/// `writeln!` can split a record across several writes, which interleaves them
/// into unparseable garbage. `msg` is escaped for the same reason — a stray quote
/// would otherwise produce invalid JSON.
pub(crate) fn log(app: &AppHandle, msg: &str) {
    let path = app
        .state::<Runtime>()
        .log_file
        .lock()
        .ok()
        .and_then(|g| g.clone());
    if let Some(path) = path {
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
            let escaped: String = msg
                .chars()
                .flat_map(|c| match c {
                    '"' => vec!['\\', '"'],
                    '\\' => vec!['\\', '\\'],
                    '\n' | '\r' | '\t' => vec![' '],
                    c if (c as u32) < 0x20 => vec![' '],
                    c => vec![c],
                })
                .collect();
            let line = format!("{{\"at\":{},\"msg\":\"{}\"}}\n", now_millis(), escaped);
            let _ = f.write_all(line.as_bytes());
        }
    }
}

/// Resolve the central API base URL (no trailing slash). Env override wins.
fn resolve_api_url() -> String {
    let raw = std::env::var("PARTNERA_API_URL").unwrap_or_else(|_| DEFAULT_API_URL.into());
    let trimmed = raw.trim().trim_end_matches('/').to_string();
    if trimmed.is_empty() {
        DEFAULT_API_URL.into()
    } else {
        trimmed
    }
}

/// Extract the host of a base URL (best effort; for the in-window allow check).
fn host_of(url: &str) -> Option<String> {
    url.parse::<tauri::Url>()
        .ok()
        .and_then(|u| u.host_str().map(|h| h.to_ascii_lowercase()))
}

fn host_is_allowed(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    EXTERNAL_ALLOWLIST
        .iter()
        .any(|d| host == *d || host.ends_with(&format!(".{d}")))
}

/// The per-user log directory (secret-free).
fn log_path(app: &AppHandle) -> PathBuf {
    let base = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("partnera-creator"));
    let logs = base.join("logs");
    let _ = create_dir_all(&logs);
    logs.join("desktop.log")
}

fn emit_status(app: &AppHandle, status: &str, state: &str) {
    let _ = app.emit("boot://status", json!({ "status": status, "state": state }));
}
fn emit_error(app: &AppHandle, title: &str, message: &str) {
    let _ = app.emit("boot://error", json!({ "title": title, "message": message }));
}

/// Navigate the main window to the live Creator Portal (or a specific creator path).
fn boot(app: AppHandle) {
    boot_to(app, CREATOR_PATH);
}

/// Navigate the main window from the splash to a creator path on the central API.
/// `path` MUST be a `/creator…` path; anything else falls back to `/creator`.
fn boot_to(app: AppHandle, path: &str) {
    let api = resolve_api_url();
    let safe_path = if path == CREATOR_PATH || path.starts_with("/creator/") {
        path
    } else {
        CREATOR_PATH
    };
    let target = format!("{api}{safe_path}");
    log(&app, &format!("boot.navigate host={} path={}", host_of(&api).unwrap_or_default(), safe_path));
    emit_status(&app, "Conectando a Partnera Creator…", "active");

    if let Some(win) = app.get_webview_window("main") {
        match target.parse() {
            Ok(u) => {
                let _ = win.navigate(u);
                let _ = win.set_focus();
            }
            Err(_) => emit_error(&app, "URL inválida", "No se pudo resolver la URL de la API central."),
        }
    }
}

/// Turn a raw `partnera-creator://…` deep link into a safe `/creator…` path.
///
/// Only the creator surface is reachable: the deep-link path must be `creator` or
/// `creator/…`. Query strings and fragments are dropped (no smuggling), and the
/// result is always a path on the configured API host — never another scope or
/// host. Returns `None` for anything that does not map to the creator surface.
fn deep_link_path(raw: &str) -> Option<String> {
    let rest = raw.trim().strip_prefix(DEEP_LINK_SCHEME)?;
    // Drop any authority slashes; we only care about the path portion.
    let rest = rest.trim_start_matches('/');
    // Strip query/fragment.
    let path_only = rest.split(['?', '#']).next().unwrap_or("").trim_end_matches('/');
    if path_only == "creator" || path_only.starts_with("creator/") {
        Some(format!("/{path_only}"))
    } else {
        None
    }
}

/// Route an incoming deep link (from any source) to the creator surface if valid.
fn handle_deep_link(app: &AppHandle, raw: &str) {
    match deep_link_path(raw) {
        Some(path) => {
            log(app, &format!("deeplink.accept path={path}"));
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.set_focus();
            }
            boot_to(app.clone(), &path);
        }
        None => log(app, "deeplink.reject not_creator_surface"),
    }
}

/// Focus the existing main window (used by single-instance + deep-link routing).
fn focus_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
}

/// Build the tray icon. This is the entry point for a **manual** update check:
/// the main window renders the remote Creator Portal full-bleed, so there is no
/// app chrome to hang a menu off, and the portal must never be able to drive the
/// updater itself.
fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Abrir Partnera Creator", true, None::<&str>)?;
    let updates = MenuItem::with_id(app, "updates", "Buscar actualizaciones…", true, None::<&str>)?;
    let logs = MenuItem::with_id(app, "logs", "Ver logs", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &updates, &logs, &sep, &quit])?;

    let mut tray = TrayIconBuilder::with_id("main-tray")
        .tooltip("Partnera Creator")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => focus_main(app),
            "updates" => updater::manual_check(app),
            "logs" => open_logs_dir(app.clone()),
            "quit" => app.exit(0),
            _ => {}
        });
    if let Some(icon) = app.default_window_icon().cloned() {
        tray = tray.icon(icon);
    }
    tray.build(app)?;
    Ok(())
}

#[tauri::command]
fn retry_boot(app: AppHandle) {
    log(&app, "boot.retry");
    boot(app);
}

#[tauri::command]
fn open_logs_dir(app: AppHandle) {
    let path = log_path(&app);
    if let Some(dir) = path.parent() {
        let _ = app.opener().open_path(dir.to_string_lossy().to_string(), None::<&str>);
    }
}

pub fn run() {
    tauri::Builder::default()
        // Single instance MUST be registered first. A second launch (including an
        // OS deep-link dispatch on Windows, where the URL arrives as an argv item)
        // is forwarded here instead of opening a new window.
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            log(app, "single_instance.second_launch");
            focus_main(app);
            if let Some(raw) = argv.iter().find(|a| a.starts_with(DEEP_LINK_SCHEME)) {
                handle_deep_link(app, raw);
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Runtime::default())
        .manage(updater::UpdateState::default())
        .invoke_handler(tauri::generate_handler![
            retry_boot,
            open_logs_dir,
            updater::updater_check,
            updater::updater_install,
            updater::updater_bootstrap
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            *handle.state::<Runtime>().log_file.lock().unwrap() = Some(log_path(&handle));
            let api = resolve_api_url();
            let api_host = host_of(&api);
            *handle.state::<Runtime>().api_host.lock().unwrap() = api_host.clone();
            log(&handle, "app.start");

            // Deep links received while the app is running (macOS/Linux; also
            // Windows via the plugin). Strictly routed to the creator surface.
            let dl_handle = handle.clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    handle_deep_link(&dl_handle, url.as_str());
                }
            });
            // Dev convenience: register the scheme for the current user so deep
            // links work before an installer has run. No-op / best-effort in prod.
            #[cfg(any(windows, target_os = "linux"))]
            {
                let _ = app.deep_link().register(DEEP_LINK_SCHEME.trim_end_matches(':'));
            }

            let nav_handle = handle.clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Partnera Creator")
                .inner_size(1360.0, 900.0)
                .min_inner_size(1040.0, 680.0)
                .resizable(true)
                .maximizable(true)
                .center()
                .on_navigation(move |url| {
                    let scheme = url.scheme();
                    let host = url.host_str().unwrap_or("").to_ascii_lowercase();
                    // In-window: the local splash…
                    if scheme == "tauri" {
                        return true;
                    }
                    // …and the configured central API host (exact or subdomain).
                    let api_host = nav_handle
                        .state::<Runtime>()
                        .api_host
                        .lock()
                        .ok()
                        .and_then(|g| g.clone())
                        .unwrap_or_default();
                    if (scheme == "https" || scheme == "http")
                        && !api_host.is_empty()
                        && (host == api_host || host.ends_with(&format!(".{api_host}")))
                    {
                        return true;
                    }
                    // Any other external http(s): open allowlisted hosts in the
                    // system browser; never load them inside the window.
                    if scheme == "http" || scheme == "https" {
                        if host_is_allowed(&host) {
                            let _ = nav_handle.opener().open_url(url.to_string(), None::<&str>);
                        }
                    }
                    false
                })
                .build()?;

            if let Err(e) = setup_tray(&handle) {
                // A missing tray only costs the manual-check entry point; the
                // automatic check below still runs, so this must not be fatal.
                log(&handle, &format!("tray.failed {e}"));
            }

            // Non-blocking automatic update check; no-ops until the release
            // channel is configured, and never gates the navigation below. When
            // an update is found it opens the updater window to inform the user,
            // who decides when to install — we never restart underneath an
            // active portal session.
            updater::spawn_startup_check(handle.clone());

            // If the app was cold-launched from a deep link (Windows argv), route
            // it; otherwise land on the Creator Portal home.
            if let Some(raw) = std::env::args().find(|a| a.starts_with(DEEP_LINK_SCHEME)) {
                handle_deep_link(&handle, &raw);
            } else {
                boot(handle);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Partnera Creator");
}
