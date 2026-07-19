//! Automatic updates for the Partnera Business desktop thin client (Tauri 2).
//!
//! Uses the **official** `tauri-plugin-updater` end to end: it fetches a signed
//! release manifest, verifies the minisign signature of the package natively,
//! installs it and relaunches. Nothing here is a hand-rolled updater — this
//! module only drives the plugin and reports progress to a local UI.
//!
//! Because this app is a thin client, the updater only refreshes the **shell**
//! (the native window + this Rust wrapper); the console UI itself is always the
//! live version served by the central API.
//!
//! ## Why a separate window
//! The main window navigates to remote content (the central API), which by
//! design gets **no Tauri IPC**. So the update UI lives in its own local
//! `updater` window (`tauri://` scheme, own capability). Remote content can
//! neither observe nor drive the updater.
//!
//! ## Safety
//! An unsigned or tampered package fails minisign verification inside the
//! plugin, is never installed, and the working install is left untouched — that
//! is the rollback path (see `PARTNERA_BUSINESS_UPDATER_REPORT.md`). Every
//! outcome is written to the secret-free desktop log.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::log;

/// Label of the local update window. Kept in sync with `capabilities/updater.json`.
pub(crate) const UPDATER_WINDOW: &str = "updater";

/// Fixed release tag that carries *only* this product's manifest, repointed on
/// every Business release. Using a fixed tag instead of `releases/latest` is what
/// lets several Partnera desktop products share one releases repo: `latest`
/// resolves to the newest release of the whole repo, so two products would
/// shadow each other's manifest. The download URLs inside the manifest point at
/// the immutable per-version release assets. Matches the Affiliate channel
/// convention (`partnera-affiliate-channel-stable`).
const CHANNEL_TAG: &str = "partnera-business-channel-stable";

/// Holds the update discovered by the last successful check, so the "Instalar"
/// button can install exactly what the user was shown (no second network check).
#[derive(Default)]
pub struct UpdaterState {
    pending: Mutex<Option<Update>>,
    /// Guards against overlapping check/install runs (menu spam, double click).
    busy: Mutex<bool>,
    /// Last status emitted. The window is created at the same time the check
    /// starts, so an early terminal status (e.g. "ya actualizada") can land
    /// before the page registers its listener; the page replays this on mount.
    last: Mutex<Option<Status>>,
}

/// One snapshot of the updater lifecycle, pushed to the update window.
#[derive(Serialize, Clone, Default)]
struct Status {
    /// `disabled` | `checking` | `available` | `uptodate` | `downloading`
    /// | `installing` | `error`
    phase: String,
    /// Version currently installed (from the bundle, single source of truth).
    current: String,
    /// Version offered by the manifest, when one is available.
    version: Option<String>,
    notes: Option<String>,
    downloaded: u64,
    total: Option<u64>,
    /// 0..100, only while downloading and only when the server sent a length.
    percent: Option<f64>,
    /// Human-readable Spanish message for the UI.
    message: Option<String>,
}

fn emit(app: &AppHandle, status: Status) {
    if let Some(state) = app.try_state::<UpdaterState>() {
        *state.last.lock().unwrap() = Some(status.clone());
    }
    // Targeted at the local update window only: the remote console must not
    // observe updater state.
    let _ = app.emit_to(UPDATER_WINDOW, "updater://status", status);
}

fn current_version(app: &AppHandle) -> String {
    app.package_info().version.to_string()
}

fn status(app: &AppHandle, phase: &str, message: &str) -> Status {
    Status {
        phase: phase.into(),
        current: current_version(app),
        message: Some(message.into()),
        ..Default::default()
    }
}

/// GitHub owner/repo the installed app polls for releases. Baked at build time
/// from `PARTNERA_UPDATE_OWNER` / `PARTNERA_UPDATE_REPO` when present (set by
/// CI), otherwise the documented placeholder so the app degrades honestly until
/// the release channel exists. A runtime `PARTNERA_UPDATE_ENDPOINT` override
/// wins, used for controlled local end-to-end tests.
pub(crate) fn resolve_endpoint() -> Option<String> {
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
        "https://github.com/{owner}/{repo}/releases/download/{CHANNEL_TAG}/business-latest.json"
    ))
}

/// Create the local update window on demand (hidden windows are not kept around
/// so the app starts with exactly one window, as before).
pub(crate) fn show_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window(UPDATER_WINDOW) {
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }
    let built = WebviewWindowBuilder::new(app, UPDATER_WINDOW, WebviewUrl::App("updater.html".into()))
        .title("Actualizaciones — Partnera Business")
        .inner_size(460.0, 340.0)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .center()
        .build();
    if let Err(e) = built {
        log(app, &format!("updater.window_failed {e}"));
    }
}

/// Run a check. `manual` opens the update window and reports *both* outcomes
/// (new version / already up to date); the silent startup check only surfaces
/// itself when there is something to install.
async fn check(app: AppHandle, manual: bool) {
    {
        let state = app.state::<UpdaterState>();
        let mut busy = state.busy.lock().unwrap();
        if *busy {
            log(&app, "updater.check skipped_busy");
            return;
        }
        *busy = true;
    }
    let result = run_check(&app, manual).await;
    *app.state::<UpdaterState>().busy.lock().unwrap() = false;

    if let Err(e) = result {
        log(&app, &format!("updater.check_failed {e}"));
        if manual {
            emit(
                &app,
                status(
                    &app,
                    "error",
                    &format!("No se pudo comprobar si hay actualizaciones. Detalle: {e}"),
                ),
            );
        }
    }
}

async fn run_check(app: &AppHandle, manual: bool) -> Result<(), String> {
    let endpoint = match resolve_endpoint() {
        Some(e) => e,
        None => {
            log(app, "updater.disabled no_release_channel");
            if manual {
                emit(
                    app,
                    status(
                        app,
                        "disabled",
                        "El canal de actualizaciones aún no está configurado en esta compilación. \
                         La aplicación seguirá funcionando con normalidad.",
                    ),
                );
            }
            return Ok(());
        }
    };

    if manual {
        emit(app, status(app, "checking", "Buscando actualizaciones…"));
    }
    log(app, "updater.check start");

    let url = endpoint.parse().map_err(|e| format!("bad_endpoint {e}"))?;
    let updater = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| format!("builder {e}"))?
        .build()
        .map_err(|e| format!("build {e}"))?;

    match updater.check().await {
        Ok(Some(update)) => {
            log(app, &format!("updater.available version={}", update.version));
            emit(
                app,
                Status {
                    phase: "available".into(),
                    current: current_version(app),
                    version: Some(update.version.clone()),
                    notes: update.body.clone(),
                    message: Some(format!(
                        "Hay una nueva versión disponible: {}.",
                        update.version
                    )),
                    ..Default::default()
                },
            );
            *app.state::<UpdaterState>().pending.lock().unwrap() = Some(update);
            // An available update is always worth surfacing, even on the silent
            // startup check — the user decides whether to install it.
            show_window(app);
            Ok(())
        }
        Ok(None) => {
            log(app, "updater.uptodate");
            if manual {
                emit(
                    app,
                    status(
                        app,
                        "uptodate",
                        "La aplicación ya está actualizada. No hay ninguna versión nueva.",
                    ),
                );
            }
            Ok(())
        }
        Err(e) => Err(format!("check {e}")),
    }
}

/// Download → verify → install → relaunch the update found by the last check.
async fn install(app: AppHandle) {
    {
        let state = app.state::<UpdaterState>();
        let mut busy = state.busy.lock().unwrap();
        if *busy {
            return;
        }
        *busy = true;
    }

    let update = app.state::<UpdaterState>().pending.lock().unwrap().take();
    let Some(update) = update else {
        *app.state::<UpdaterState>().busy.lock().unwrap() = false;
        emit(
            &app,
            status(
                &app,
                "error",
                "No hay ninguna actualización pendiente. Vuelve a buscar actualizaciones.",
            ),
        );
        return;
    };

    let version = update.version.clone();
    let current = current_version(&app);
    log(&app, &format!("updater.download start version={version}"));

    let progress_app = app.clone();
    let progress_version = version.clone();
    let mut downloaded: u64 = 0;

    let result = update
        .download_and_install(
            move |chunk, total| {
                downloaded += chunk as u64;
                let percent = total.map(|t| {
                    if t == 0 {
                        0.0
                    } else {
                        (downloaded as f64 / t as f64 * 100.0).clamp(0.0, 100.0)
                    }
                });
                emit(
                    &progress_app,
                    Status {
                        phase: "downloading".into(),
                        current: progress_app.package_info().version.to_string(),
                        version: Some(progress_version.clone()),
                        downloaded,
                        total,
                        percent,
                        message: Some("Descargando la actualización…".into()),
                        ..Default::default()
                    },
                );
            },
            || {},
        )
        .await;

    match result {
        Ok(()) => {
            log(
                &app,
                &format!("updater.installed from={current} to={version} relaunching"),
            );
            emit(
                &app,
                Status {
                    phase: "installing".into(),
                    current,
                    version: Some(version),
                    percent: Some(100.0),
                    message: Some(
                        "Actualización verificada e instalada. Reiniciando la aplicación…".into(),
                    ),
                    ..Default::default()
                },
            );
            // The NSIS installer (passive mode) takes over and relaunches the
            // app; `restart` is the explicit, supported fallback path.
            app.restart();
        }
        Err(e) => {
            *app.state::<UpdaterState>().busy.lock().unwrap() = false;
            // Signature mismatch, tampered package, or a broken download all land
            // here. Nothing was installed: the current version stays intact.
            log(&app, &format!("updater.install_failed {e}"));
            emit(
                &app,
                status(
                    &app,
                    "error",
                    &format!(
                        "No se pudo instalar la actualización. La versión actual sigue intacta. \
                         Detalle: {e}"
                    ),
                ),
            );
        }
    }
}

/// Fire a non-blocking update check right after launch. Never gates startup.
pub fn spawn_startup_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move { check(app, false).await });
}

/// Manual "Buscar actualizaciones" from the app menu / update window.
#[tauri::command]
pub fn updater_check(app: AppHandle) {
    show_window(&app);
    tauri::async_runtime::spawn(async move { check(app, true).await });
}

/// Install the update the user was just shown.
#[tauri::command]
pub fn updater_install(app: AppHandle) {
    tauri::async_runtime::spawn(async move { install(app).await });
}

/// Report the state the window should render when it first opens.
#[tauri::command]
pub fn updater_current_version(app: AppHandle) -> String {
    current_version(&app)
}

/// Replay the last emitted status, so a window that opened mid-check still
/// renders the outcome instead of spinning forever.
#[tauri::command]
pub fn updater_last_status(app: AppHandle) -> Option<serde_json::Value> {
    app.state::<UpdaterState>()
        .last
        .lock()
        .unwrap()
        .clone()
        .and_then(|s| serde_json::to_value(s).ok())
}

/// Close the update window without touching the main window.
#[tauri::command]
pub fn updater_close(app: AppHandle) {
    if let Some(win) = app.get_webview_window(UPDATER_WINDOW) {
        let _ = win.close();
    }
}

