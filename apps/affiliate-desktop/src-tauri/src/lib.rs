//! Partnera Affiliate — desktop thin client (Tauri 2).
//!
//! This is *packaging only*, and like the Operations wrapper it bundles **no
//! runtime**: there is no local Node server and no local database. On launch we:
//!   1. resolve the central API base URL (env `PARTNERA_API_URL`, else the
//!      documented Railway default),
//!   2. show a tiny local splash,
//!   3. navigate the window to `${API}/affiliate` (the affiliate portal) over HTTPS.
//!
//! The central API is the single source of truth (packages/web → shared Postgres),
//! so the portal UI is always the live version; the auto-updater only refreshes
//! this native shell.
//!
//! Security posture (affiliate isolation):
//!   * The loaded web content gets NO Tauri IPC (see capabilities) — no filesystem,
//!     shell, http, or process access is exposed to the page.
//!   * Only the configured API host may load **inside** the window; any other
//!     external link opens in the system browser via a host allowlist.
//!   * Per-affiliate data isolation is enforced **server-side**: the `/affiliate`
//!     scope binds every query to `session.affiliateId`, and the operator scopes
//!     (`/ops`, `/internal`) are denied to non-operators (deny-by-default). This
//!     shell only ever navigates to `/affiliate`; it grants no privilege of its own.
//!   * No secrets are baked into the frontend or logged (logs carry only structured,
//!     non-sensitive boot events — host name, not tokens).

mod updater;

use std::fs::{create_dir_all, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::json;
use tauri::menu::{Menu, MenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

/// Menu item ids (the manual entry points that stay reachable once the window
/// has navigated to the remote portal).
const MENU_CHECK_UPDATES: &str = "check-updates";
const MENU_OPEN_LOGS: &str = "open-logs";

/// The default central API base URL when `PARTNERA_API_URL` is not set. This is
/// the deployed Partnera web host on Railway (the same one the Shopify pilot uses).
const DEFAULT_API_URL: &str = "https://partnera-web-production.up.railway.app";

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
    let path = app
        .state::<Runtime>()
        .log_file
        .lock()
        .ok()
        .and_then(|g| g.clone());
    if let Some(path) = path {
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
            let _ = writeln!(f, "{{\"at\":{},\"msg\":\"{}\"}}", now_millis(), msg);
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
        .unwrap_or_else(|_| std::env::temp_dir().join("partnera-affiliate"));
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

/// Navigate the main window from the splash to the live affiliate portal.
fn boot(app: AppHandle) {
    let api = resolve_api_url();
    let target = format!("{api}/affiliate");
    log(&app, &format!("boot.navigate host={}", host_of(&api).unwrap_or_default()));
    emit_status(&app, "Conectando a Partnera Affiliate…", "active");

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

/// The "Ayuda" menu on the main window. Once the window has navigated to the
/// remote portal the local splash is gone, so this menu is the only in-app way
/// to reach the manual update check and the logs.
fn build_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let check = MenuItem::with_id(
        app,
        MENU_CHECK_UPDATES,
        "Buscar actualizaciones…",
        true,
        None::<&str>,
    )?;
    let logs = MenuItem::with_id(app, MENU_OPEN_LOGS, "Ver logs", true, None::<&str>)?;
    let help = Submenu::with_items(app, "Ayuda", true, &[&check, &logs])?;
    Menu::with_items(app, &[&help])
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
            updater::updater_state,
            updater::updater_check,
            updater::updater_install,
            updater::updater_dismiss
        ])
        .setup(|app| {
            let handle = app.handle().clone();

            *handle.state::<Runtime>().log_file.lock().unwrap() = Some(log_path(&handle));
            let api = resolve_api_url();
            let api_host = host_of(&api);
            *handle.state::<Runtime>().api_host.lock().unwrap() = api_host.clone();
            log(&handle, "app.start");

            let nav_handle = handle.clone();
            let menu = build_menu(&handle)?;
            let menu_handle = handle.clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Partnera Affiliate")
                .menu(menu)
                .on_menu_event(move |_win, event| match event.id().as_ref() {
                    MENU_CHECK_UPDATES => {
                        log(&menu_handle, "updater.manual_check");
                        updater::check_manual(menu_handle.clone());
                    }
                    MENU_OPEN_LOGS => open_logs_dir(menu_handle.clone()),
                    _ => {}
                })
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

            // Non-blocking automatic update check; no-ops until the release
            // channel is configured, and never gates the navigation below.
            updater::spawn_startup_check(handle.clone());

            boot(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Partnera Affiliate");
}
