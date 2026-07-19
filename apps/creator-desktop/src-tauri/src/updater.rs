//! Automatic updates for the Partnera Creator desktop thin client (Tauri 2).
//!
//! This uses the **official** `tauri-plugin-updater` end to end: the manifest is
//! fetched over HTTPS, the downloaded package is verified against the minisign
//! public key baked into `tauri.conf.json`, and installation is performed by the
//! native NSIS installer. Nothing here re-implements download, verification or
//! installation.
//!
//! Because this app is a thin client, an update only refreshes the **shell** (the
//! native window + this Rust wrapper); the Creator Portal UI itself is always the
//! live version served by the central API.
//!
//! Flow and policy
//! ---------------
//! * A non-blocking check runs shortly after launch. It never gates startup.
//! * When a newer signed version exists the user is **informed** in a small local
//!   updater window and chooses when to install — we deliberately do not restart
//!   the app underneath an active portal session.
//! * A manual check is always available from the tray menu.
//! * Signature verification happens inside `Update::download`, before any bytes
//!   are handed to the installer. A tampered or unsigned package is rejected and
//!   never installed, so the working install is never left broken (rollback is
//!   simply "nothing was installed").
//! * Until a real release endpoint is configured the updater reports
//!   `not-configured` and does nothing.
//!
//! Windows install/restart note
//! ----------------------------
//! For NSIS the plugin launches the installer with `/P /R /UPDATE /ARGS …`. The
//! installer waits for this process to exit, installs, and then relaunches the
//! app itself (`/R`). So after `install()` succeeds we must simply **exit** — we
//! must not call `app.restart()`, which would race the installer by spawning the
//! old executable while it is being replaced.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder, Window};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::log;

/// Label of the small local window that renders update status.
pub const UPDATER_WINDOW: &str = "updater";

/// Event carrying every update phase to the updater window.
const UPDATER_EVENT: &str = "updater://state";

/// Fixed rolling release tag this app's manifest is published under.
///
/// Deliberately NOT `releases/latest/download/…`: Partnera is a multi-product
/// repo, where "latest" resolves to whichever product released last — so a
/// Business or Affiliate release would start serving its manifest to Creator
/// installs. A per-product tag that is re-pointed on each release keeps the
/// channels independent.
const RELEASE_CHANNEL_TAG: &str = "partnera-creator-channel-stable";

/// Shared updater state. `pending` holds the update found by the most recent
/// successful check so the user can install it without re-checking; `busy`
/// serialises the startup check against manual checks and installs.
#[derive(Default)]
pub struct UpdateState {
    pending: Mutex<Option<Update>>,
    busy: Mutex<bool>,
    /// The most recent phase we emitted. The startup check runs before the
    /// updater window exists, so its events have nowhere to land; the window
    /// replays this on open instead of showing a degraded placeholder.
    last: Mutex<Option<Phase>>,
}

impl UpdateState {
    /// Take the busy flag, or report that another run is already in flight.
    fn try_begin(&self) -> bool {
        let mut busy = match self.busy.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        if *busy {
            return false;
        }
        *busy = true;
        true
    }

    fn end(&self) {
        let mut busy = match self.busy.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        *busy = false;
    }

    fn set_pending(&self, update: Option<Update>) {
        if let Ok(mut g) = self.pending.lock() {
            *g = update;
        }
    }

    fn pending(&self) -> Option<Update> {
        self.pending.lock().ok().and_then(|g| g.clone())
    }
}

/// Every state the update UI can be in. Serialised as `{ "phase": "…", … }`.
#[derive(Serialize, Clone)]
#[serde(tag = "phase", rename_all = "kebab-case")]
enum Phase {
    /// No release endpoint is configured for this build.
    NotConfigured { current: String },
    Checking { current: String },
    UpToDate { current: String },
    Available {
        current: String,
        version: String,
        notes: Option<String>,
        date: Option<String>,
    },
    Downloading {
        version: String,
        downloaded: u64,
        total: Option<u64>,
        pct: Option<u8>,
    },
    /// Downloaded; minisign signature is being checked before anything is run.
    Verifying { version: String },
    Installing { version: String },
    /// Installer handed off; the app is about to exit so it can be replaced.
    Restarting { version: String },
    Failed { message: String },
}

/// The version this build reports, straight from `tauri.conf.json`.
fn current_version(app: &AppHandle) -> String {
    app.package_info().version.to_string()
}

fn emit(app: &AppHandle, phase: Phase) {
    if let Ok(mut last) = app.state::<UpdateState>().last.lock() {
        *last = Some(phase.clone());
    }
    let _ = app.emit_to(UPDATER_WINDOW, UPDATER_EVENT, phase);
}

/// GitHub owner/repo the installed app polls for releases. Baked at build time
/// from `PARTNERA_UPDATE_OWNER` / `PARTNERA_UPDATE_REPO` when present (set by the
/// release build), otherwise the app degrades honestly and reports
/// `not-configured`. A runtime `PARTNERA_UPDATE_ENDPOINT` override wins, used for
/// controlled end-to-end tests.
fn resolve_endpoint() -> Option<String> {
    endpoint_from(
        std::env::var("PARTNERA_UPDATE_ENDPOINT").ok().as_deref(),
        option_env!("PARTNERA_UPDATE_OWNER").unwrap_or(""),
        option_env!("PARTNERA_UPDATE_REPO").unwrap_or(""),
    )
}

/// Pure endpoint resolution, split out so it is testable without touching
/// process-global environment state.
fn endpoint_from(override_url: Option<&str>, owner: &str, repo: &str) -> Option<String> {
    if let Some(e) = override_url {
        let e = e.trim();
        if !e.is_empty() {
            return Some(e.to_string());
        }
    }
    let (owner, repo) = (owner.trim(), repo.trim());
    let placeholder =
        |s: &str| s.is_empty() || s.starts_with("REPLACE_") || s.starts_with("OWNER-REPO");
    if placeholder(owner) || placeholder(repo) {
        return None;
    }
    Some(format!(
        "https://github.com/{owner}/{repo}/releases/download/{RELEASE_CHANNEL_TAG}/creator-latest.json"
    ))
}

/// True when this build has a release channel to poll.
pub fn is_configured() -> bool {
    resolve_endpoint().is_some()
}

/// Show (creating if needed) the small local updater window.
///
/// `focus` is false for the automatic startup announcement. Stealing focus there
/// would drop a window whose primary action is destructive (it replaces the
/// executable and restarts the app) directly under the pointer, where a click the
/// user aimed at something else lands on "Instalar y reiniciar". The window still
/// appears and is clearly visible; it just does not grab input.
pub fn show_window(app: &AppHandle, focus: bool) {
    if let Some(win) = app.get_webview_window(UPDATER_WINDOW) {
        let _ = win.unminimize();
        let _ = win.show();
        if focus {
            let _ = win.set_focus();
        }
        return;
    }
    let built = WebviewWindowBuilder::new(
        app,
        UPDATER_WINDOW,
        WebviewUrl::App("updater.html".into()),
    )
    .title("Partnera Creator — Actualizaciones")
    .inner_size(520.0, 400.0)
    .min_inner_size(460.0, 360.0)
    .resizable(false)
    .maximizable(false)
    .center()
    .focused(focus)
    .build();
    if let Err(e) = built {
        log(app, &format!("updater.window_failed {e}"));
    }
}

/// Ask the plugin whether a newer signed release exists.
///
/// Returns the `Update` handle when one is available. Errors are strings that are
/// safe to show: they carry no secrets and no local paths.
async fn check(app: &AppHandle) -> Result<Option<Update>, String> {
    let endpoint = match resolve_endpoint() {
        Some(e) => e,
        None => return Ok(None),
    };
    let url = endpoint
        .parse()
        .map_err(|e| format!("Endpoint de actualización inválido ({e})."))?;

    let updater = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| format!("No se pudo configurar el updater ({e})."))?
        .build()
        .map_err(|e| format!("No se pudo inicializar el updater ({e})."))?;

    updater
        .check()
        .await
        .map_err(|e| format!("No se pudo comprobar actualizaciones ({e})."))
}

/// Run a check and report the outcome through `UPDATER_EVENT`.
///
/// `announce` controls whether an available update should pop the updater window
/// open (startup check) or merely update an already-visible one (manual check).
pub async fn run_check(app: AppHandle, announce: bool) {
    let state = app.state::<UpdateState>();
    if !state.try_begin() {
        return;
    }
    let current = current_version(&app);

    if !is_configured() {
        log(&app, "updater.not_configured");
        emit(&app, Phase::NotConfigured { current });
        state.end();
        return;
    }

    emit(
        &app,
        Phase::Checking {
            current: current.clone(),
        },
    );

    match check(&app).await {
        Ok(Some(update)) => {
            log(&app, &format!("updater.available version={}", update.version));
            emit(
                &app,
                Phase::Available {
                    current,
                    version: update.version.clone(),
                    notes: update.body.clone(),
                    date: update.date.map(|d| d.to_string()),
                },
            );
            state.set_pending(Some(update));
            if announce {
                // Announce without stealing focus: see show_window.
                show_window(&app, false);
            }
        }
        Ok(None) => {
            log(&app, "updater.up_to_date");
            emit(&app, Phase::UpToDate { current });
            state.set_pending(None);
        }
        Err(message) => {
            log(&app, &format!("updater.check_failed {message}"));
            emit(&app, Phase::Failed { message });
            state.set_pending(None);
        }
    }
    state.end();
}

/// Download → verify signature → install the pending update, then exit so the
/// NSIS installer can replace this executable and relaunch it.
async fn run_install(app: AppHandle) {
    let state = app.state::<UpdateState>();
    let update = match state.pending() {
        Some(u) => u,
        None => {
            emit(
                &app,
                Phase::Failed {
                    message: "No hay ninguna actualización pendiente.".into(),
                },
            );
            return;
        }
    };
    if !state.try_begin() {
        return;
    }

    let version = update.version.clone();
    log(&app, &format!("updater.download_start version={version}"));

    let mut downloaded: u64 = 0;
    let progress_app = app.clone();
    let progress_version = version.clone();

    let bytes = update
        .download(
            move |chunk, total| {
                downloaded += chunk as u64;
                let pct = total.filter(|t| *t > 0).map(|t| {
                    ((downloaded.min(t) as f64 / t as f64) * 100.0).round() as u8
                });
                emit(
                    &progress_app,
                    Phase::Downloading {
                        version: progress_version.clone(),
                        downloaded,
                        total,
                        pct,
                    },
                );
            },
            || {},
        )
        .await;

    // NOTE: `download` verifies the minisign signature before returning, so any
    // error here means nothing was installed and the current install is intact.
    let bytes = match bytes {
        Ok(b) => b,
        Err(e) => {
            let message = format!("Fallo al descargar o verificar la actualización ({e}).");
            log(&app, &format!("updater.download_failed {e}"));
            emit(&app, Phase::Failed { message });
            state.end();
            return;
        }
    };

    log(
        &app,
        &format!("updater.verified version={version} bytes={}", bytes.len()),
    );
    emit(
        &app,
        Phase::Verifying {
            version: version.clone(),
        },
    );
    emit(
        &app,
        Phase::Installing {
            version: version.clone(),
        },
    );

    if let Err(e) = update.install(bytes) {
        let message = format!("Fallo al instalar la actualización ({e}).");
        log(&app, &format!("updater.install_failed {e}"));
        emit(&app, Phase::Failed { message });
        state.end();
        return;
    }

    log(&app, &format!("updater.installed version={version} exiting"));
    emit(&app, Phase::Restarting { version });
    state.end();

    // The NSIS installer is waiting for this process to exit; it then installs
    // and relaunches the app (`/R`). Do NOT call `restart()` here.
    app.exit(0);
}

/// Fire the non-blocking check right after launch.
pub fn spawn_startup_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        run_check(app, true).await;
    });
}

/// Open the updater window and kick off a manual check (tray entry point).
pub fn manual_check(app: &AppHandle) {
    show_window(app, true);
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        run_check(app, false).await;
    });
}

/// Reject IPC that did not come from our own local updater window. The main
/// window loads remote content from the central API, and it must never be able
/// to drive an install.
fn assert_updater_window(window: &Window) -> Result<(), String> {
    if window.label() == UPDATER_WINDOW {
        Ok(())
    } else {
        Err("forbidden".into())
    }
}

/// Re-check on demand from the updater window's "Buscar actualizaciones" button.
#[tauri::command]
pub async fn updater_check(app: AppHandle, window: Window) -> Result<(), String> {
    log(&app, &format!("updater.check_requested from={}", window.label()));
    assert_updater_window(&window)?;
    run_check(app, false).await;
    Ok(())
}

/// Install the pending update (updater window's "Instalar y reiniciar").
#[tauri::command]
pub async fn updater_install(app: AppHandle, window: Window) -> Result<(), String> {
    log(&app, &format!("updater.install_requested from={}", window.label()));
    assert_updater_window(&window)?;
    run_install(app).await;
    Ok(())
}

/// Initial paint for the updater window. Returns the last phase we emitted, so a
/// window opened *after* the startup check still shows that check's real result
/// (including release notes) rather than a placeholder.
#[tauri::command]
pub fn updater_bootstrap(app: AppHandle, window: Window) -> Result<serde_json::Value, String> {
    assert_updater_window(&window)?;
    let state = app.state::<UpdateState>();
    let last = state
        .last
        .lock()
        .ok()
        .and_then(|g| g.clone())
        .and_then(|p| serde_json::to_value(p).ok());
    Ok(serde_json::json!({
        "current": current_version(&app),
        "configured": is_configured(),
        "last": last,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Placeholder or empty build-time values must never be turned into a URL —
    /// that is what keeps an unconfigured build honest instead of polling a
    /// nonexistent repo.
    #[test]
    fn placeholder_owner_repo_yields_no_endpoint() {
        assert_eq!(endpoint_from(None, "", ""), None);
        assert_eq!(endpoint_from(None, "REPLACE_OWNER", "REPLACE_REPO"), None);
        assert_eq!(endpoint_from(None, "partnera", ""), None);
        assert_eq!(endpoint_from(None, "", "creator"), None);
    }

    /// A configured build points at this product's own rolling channel tag —
    /// never `releases/latest`, which in a multi-product repo would hand Creator
    /// installs whichever product released most recently.
    #[test]
    fn configured_owner_repo_builds_channel_url() {
        let url = endpoint_from(None, "acme", "desktop").unwrap();
        assert_eq!(
            url,
            "https://github.com/acme/desktop/releases/download/partnera-creator-channel-stable/creator-latest.json"
        );
        assert!(!url.contains("releases/latest"));
    }

    /// The runtime override is what makes a controlled end-to-end test possible,
    /// and it must win over a baked-in endpoint.
    #[test]
    fn runtime_override_wins() {
        assert_eq!(
            endpoint_from(Some("https://example.test/creator-latest.json"), "acme", "desktop")
                .as_deref(),
            Some("https://example.test/creator-latest.json")
        );
    }

    /// A blank/whitespace override must fall through, not disable updates.
    #[test]
    fn blank_override_falls_through() {
        assert_eq!(endpoint_from(Some("   "), "", ""), None);
        assert!(endpoint_from(Some("  "), "acme", "desktop")
            .unwrap()
            .contains("partnera-creator-channel-stable"));
    }
}
