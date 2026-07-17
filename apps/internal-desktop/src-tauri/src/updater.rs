//! Automatic updates for the Partnera Internal OS desktop wrapper (Tauri 2).
//!
//! Driven entirely from Rust via `UpdaterExt`, so the loaded web content (the
//! admin panel on loopback, which gets NO Tauri IPC) never receives the raw
//! updater surface — no new capability is required. Downloads and minisign
//! signature verification happen natively; an unsigned or tampered package is
//! rejected and never installed, so the working install is never left broken.
//!
//! Policy: a single non-blocking check runs shortly after launch. When a newer
//! signed version exists it is downloaded, verified, installed, and the app
//! relaunches into it. Until a real release endpoint + production public key are
//! configured, the updater reports "not configured" and does nothing.

use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

use crate::log;

/// GitHub owner/repo the installed app polls for releases. Baked at build time
/// from `PARTNERA_UPDATE_OWNER` / `PARTNERA_UPDATE_REPO` when present (set by
/// CI), otherwise the documented placeholder so the app degrades honestly until
/// the release channel exists. A runtime `PARTNERA_UPDATE_ENDPOINT` override
/// wins, used for controlled local end-to-end tests.
fn resolve_endpoint() -> Option<String> {
    if let Ok(e) = std::env::var("PARTNERA_UPDATE_ENDPOINT") {
        let e = e.trim().to_string();
        if !e.is_empty() {
            return Some(e);
        }
    }
    let owner = option_env!("PARTNERA_UPDATE_OWNER").unwrap_or("REPLACE_OWNER");
    let repo = option_env!("PARTNERA_UPDATE_REPO").unwrap_or("REPLACE_REPO");
    if owner.starts_with("REPLACE_") || repo.starts_with("REPLACE_") {
        return None;
    }
    Some(format!(
        "https://github.com/{owner}/{repo}/releases/latest/download/latest.json"
    ))
}

/// Fire a non-blocking update check right after launch. Never gates startup or
/// the runtime boot: on any problem it logs to the desktop log and returns.
pub fn spawn_startup_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        match run_update_flow(&app).await {
            Ok(false) => log(&app, "updater.noop up_to_date_or_not_configured"),
            Ok(true) => {} // restarting into the new version; unreachable in practice
            Err(e) => log(&app, &format!("updater.skip {e}")),
        }
    });
}

/// Check → download → verify → install → relaunch. Returns `Ok(true)` only when
/// an update was actually applied (the app is then restarting).
async fn run_update_flow(app: &AppHandle) -> Result<bool, String> {
    let endpoint = match resolve_endpoint() {
        Some(e) => e,
        None => return Ok(false),
    };

    // The public key comes from tauri.conf.json; a placeholder/invalid key
    // surfaces here as an error we log and swallow rather than crash.
    let url = endpoint.parse().map_err(|e| format!("bad_endpoint {e}"))?;
    let updater = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| format!("builder {e}"))?
        .build()
        .map_err(|e| format!("build {e}"))?;

    let update = match updater.check().await {
        Ok(Some(u)) => u,
        Ok(None) => return Ok(false),
        Err(e) => return Err(format!("check_failed {e}")),
    };

    log(app, &format!("updater.available version={}", update.version));

    update
        .download_and_install(|_chunk, _total| {}, || {})
        .await
        .map_err(|e| format!("install_failed {e}"))?;

    log(app, "updater.installed relaunching");
    // `restart` diverges (`-> !`), so it never returns past this point.
    app.restart()
}
