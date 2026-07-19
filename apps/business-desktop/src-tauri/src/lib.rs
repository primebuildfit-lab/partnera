//! Partnera Business — desktop thin client (Tauri 2).
//!
//! This is *packaging only*, and like the Operations wrapper it bundles **no
//! runtime**: there is no local Node server and no local database. On launch we:
//!   1. resolve the central API base URL (env `PARTNERA_API_URL`, else the
//!      documented Railway default),
//!   2. resolve the Business entry path (env `PARTNERA_BUSINESS_PATH`, else
//!      `/desktop-business`),
//!   3. show a tiny local splash,
//!   4. navigate the window to `${API}${PATH}` (the tenant Business consoles)
//!      over HTTPS.
//!
//! The central API is the single source of truth (packages/web → shared Postgres),
//! so the console UI is always the live version; the auto-updater only refreshes
//! this native shell.
//!
//! Scope: this shell targets only the tenant-scoped `/business` surface. It is not
//! Partnera Operations — it carries no platform-operator tooling and no
//! cross-tenant administration; those live behind the operator-only `/ops` guard.
//!
//! Security posture: the loaded web content gets NO Tauri IPC (see capabilities).
//! Only the configured API host loads inside the window; any other external link
//! opens in the system browser via a host allowlist.

mod updater;

use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::json;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

/// The default central API base URL when `PARTNERA_API_URL` is not set. This is
/// the deployed Partnera web host on Railway (the same one the Shopify pilot uses).
const DEFAULT_API_URL: &str = "https://partnera-web-production.up.railway.app";

/// The default in-window Business entry path when `PARTNERA_BUSINESS_PATH` is not
/// set. `/desktop-business` is a business-scoped sign-in served by the central API
/// (parallel to the Internal OS `/desktop`); it hands off to `/business`.
const DEFAULT_BUSINESS_PATH: &str = "/desktop-business";

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
pub(crate) fn log(app: &AppHandle, msg: &str) {
    // The lock is held across the write on purpose: the updater logs from its own
    // async task while boot logs from the main thread, and separate append
    // handles interleave mid-line, producing corrupt JSON.
    let Some(state) = app.try_state::<Runtime>() else {
        return;
    };
    let Ok(guard) = state.log_file.lock() else {
        return;
    };
    let Some(path) = guard.as_ref() else {
        return;
    };
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{{\"at\":{},\"msg\":\"{}\"}}", now_millis(), msg);
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

/// Resolve the in-window Business entry path (always begins with `/`). Env
/// override wins so an operator can point at `/business` directly against an API
/// build that does not yet expose `/desktop-business`.
fn resolve_business_path() -> String {
    let raw = std::env::var("PARTNERA_BUSINESS_PATH").unwrap_or_else(|_| DEFAULT_BUSINESS_PATH.into());
    let trimmed = raw.trim().to_string();
    if trimmed.is_empty() {
        DEFAULT_BUSINESS_PATH.into()
    } else if trimmed.starts_with('/') {
        trimmed
    } else {
        format!("/{trimmed}")
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
        .unwrap_or_else(|_| std::env::temp_dir().join("partnera-business"));
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

/// Navigate the main window from the splash to the live Business consoles.
fn boot(app: AppHandle) {
    let api = resolve_api_url();
    let path = resolve_business_path();
    let target = format!("{api}{path}");
    log(&app, &format!("boot.navigate host={}", host_of(&api).unwrap_or_default()));
    emit_status(&app, "Conectando a Partnera Business…", "active");

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
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(Runtime::default())
        .manage(updater::UpdaterState::default())
        .invoke_handler(tauri::generate_handler![
            retry_boot,
            open_logs_dir,
            updater::updater_check,
            updater::updater_install,
            updater::updater_current_version,
            updater::updater_last_status,
            updater::updater_close,
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            *handle.state::<Runtime>().log_file.lock().unwrap() = Some(log_path(&handle));
            let api = resolve_api_url();
            let api_host = host_of(&api);
            *handle.state::<Runtime>().api_host.lock().unwrap() = api_host.clone();
            log(&handle, "app.start");

            // The main window loads remote content that gets no IPC, so the only
            // way to offer a *manual* update check is a native menu on the shell.
            let check_item = MenuItem::with_id(
                app,
                "updater:check",
                "Buscar actualizaciones…",
                true,
                Some("CmdOrCtrl+U"),
            )?;
            let logs_item =
                MenuItem::with_id(app, "app:logs", "Ver registro", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[&Submenu::with_items(
                    app,
                    "Partnera",
                    true,
                    &[
                        &check_item,
                        &logs_item,
                        &PredefinedMenuItem::separator(app)?,
                        &PredefinedMenuItem::quit(app, Some("Salir"))?,
                    ],
                )?],
            )?;

            let menu_handle = handle.clone();
            let nav_handle = handle.clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .menu(menu)
                .on_menu_event(move |_win, event| match event.id().as_ref() {
                    "updater:check" => updater::updater_check(menu_handle.clone()),
                    "app:logs" => open_logs_dir(menu_handle.clone()),
                    _ => {}
                })
                .title("Partnera Business")
                .inner_size(1540.0, 960.0)
                .min_inner_size(1180.0, 720.0)
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

            // Non-blocking automatic update check; no-ops until the release
            // channel is configured, and never gates the navigation below.
            updater::spawn_startup_check(handle.clone());

            boot(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Partnera Business");
}
