//! Automatic updates for the Partnera Affiliate desktop thin client (Tauri 2).
//!
//! This uses the **official** `tauri-plugin-updater` end to end — there is no
//! custom download or install logic here. What this module adds is the policy
//! and the user-facing surface around the official plugin:
//!
//!   * a non-blocking check shortly after launch (never gates the portal),
//!   * a manual "Buscar actualizaciones" entry (Ayuda menu),
//!   * a small local window that reports every phase and download progress,
//!   * structured logging of every outcome to the desktop log.
//!
//! Because this app is a thin client, the updater only replaces the **shell**
//! (the native window + this Rust wrapper); the portal UI itself is always the
//! live version served by the central API.
//!
//! ## Safety / rollback
//!
//! `Update::download` verifies the minisign signature over the downloaded bytes
//! **before** returning them, and `install` is only ever called with those
//! verified bytes. An unsigned, tampered, or wrong-key package therefore fails
//! at the download step and is never handed to the installer: the working
//! install is left exactly as it was. That is the rollback story — we never put
//! the machine in a half-updated state to recover from.
//!
//! ## Install & restart
//!
//! On Windows the plugin hands the verified NSIS package to the installer with
//! `/UPDATE /ARGS` (passive mode, see `tauri.conf.json`) and then terminates
//! this process via `std::process::exit(0)`. The installer relaunches the app
//! when it finishes, so nothing after `install()` runs — the `on_before_exit`
//! hook below is the last chance to log, and it is used for exactly that.
//! Per-user data (logs, window state, cookies/session under the app data dir)
//! lives outside the install directory and is preserved across the upgrade.
//!
//! ## Signing key
//!
//! `plugins.updater.pubkey` in `tauri.conf.json` is the public half of a keypair
//! **dedicated to this app** (minisign `9365EE8087376568`). It is deliberately
//! not shared with any other Partnera desktop app: a shared key would let one
//! product's signed package be accepted by another product's client. The private
//! half lives only in `.secrets-tauri/affiliate-updater.key` (gitignored) and in
//! the CI secret `PARTNERA_AFFILIATE_SIGNING_KEY`.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use serde_json::{json, Value};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::log;

/// Label of the small local window that reports update state.
const UPDATER_WINDOW: &str = "updater";

/// Fixed GitHub tag that always carries this product's update manifest.
/// Kept in sync with `.github/workflows/release-partnera-affiliate.yml`.
const CHANNEL_TAG: &str = "partnera-affiliate-channel-stable";

/// Event carrying the current updater state to the updater window.
const EVENT_STATE: &str = "updater://state";

/// A checked, downloaded and signature-verified package waiting for the user to
/// confirm installation.
struct Pending {
    update: Update,
    bytes: Vec<u8>,
}

/// Updater runtime state. `busy` serialises checks so a manual click during the
/// startup check cannot start a second download.
#[derive(Default)]
pub struct UpdaterState {
    busy: AtomicBool,
    pending: Mutex<Option<Pending>>,
    /// Last state emitted, so a window that opens mid-flow can catch up.
    last: Mutex<Option<Value>>,
}

/// Resolve the release manifest URL the installed app polls.
///
/// Baked at build time from `PARTNERA_UPDATE_OWNER` / `PARTNERA_UPDATE_REPO`
/// (set by CI, see `.github/workflows/release-partnera-affiliate.yml`). The
/// `REPLACE_*` defaults are deliberate sentinels: while they are in place the
/// updater reports "not configured" instead of pretending to work. A runtime
/// `PARTNERA_UPDATE_ENDPOINT` override wins, and is what the documented local
/// end-to-end test uses.
///
/// These point at the **public releases repository**
/// (`primebuildfit-lab/partnera-releases`), not at the private source repo.
/// GitHub serves release assets of a private repo only to authenticated
/// callers, and the updater downloads with no credentials — so the channel has
/// to live somewhere public. That repo holds only signed installers and
/// manifests; no source code.
///
/// The manifest is pinned to the fixed rolling tag `partnera-affiliate-channel-stable`
/// rather than `releases/latest/download/`. Several Partnera products ship out of
/// the same repository, so "the latest release" is whichever product published
/// most recently — an affiliate client polling that URL would 404 (or worse, read
/// another product's manifest) as soon as a sibling app cut a release. The rolling
/// channel tag holds only this product's manifest and is repointed on every
/// affiliate release; the download URLs inside it point at the immutable
/// per-version release assets.
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
        "https://github.com/{owner}/{repo}/releases/download/{CHANNEL_TAG}/affiliate-latest.json"
    ))
}

/// Unattended install policy. When `PARTNERA_UPDATE_AUTOINSTALL=1`, a verified
/// package is installed as soon as it is ready instead of waiting for the user
/// to confirm. Intended for managed/kiosk deployments; also what the end-to-end
/// update test uses so the full install→restart path runs without a human. The
/// signature check is NOT skipped — only the confirmation click is.
fn autoinstall_enabled() -> bool {
    matches!(
        std::env::var("PARTNERA_UPDATE_AUTOINSTALL").as_deref(),
        Ok("1") | Ok("true")
    )
}

/// Publish a state to the updater window (and remember it for late openers).
fn emit(app: &AppHandle, state: Value) {
    if let Ok(mut g) = app.state::<UpdaterState>().last.lock() {
        *g = Some(state.clone());
    }
    let _ = app.emit(EVENT_STATE, state);
}

fn phase(p: &str, message: &str) -> Value {
    json!({ "phase": p, "message": message })
}

/// Open (or focus) the local updater window.
fn show_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window(UPDATER_WINDOW) {
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }
    let built = WebviewWindowBuilder::new(
        app,
        UPDATER_WINDOW,
        WebviewUrl::App("updater.html".into()),
    )
    .title("Actualizaciones — Partnera Affiliate")
    .inner_size(460.0, 300.0)
    .resizable(false)
    .maximizable(false)
    .minimizable(false)
    .center()
    .build();
    if let Err(e) = built {
        log(app, &format!("updater.window_failed {e}"));
    }
}

/// Manual check, triggered from the Ayuda menu. Opens the window immediately so
/// the user always gets feedback, including "ya está actualizada".
pub fn check_manual(app: AppHandle) {
    show_window(&app);
    spawn_flow(app, true);
}

/// Non-blocking automatic check right after launch. Stays silent unless there is
/// something to show, so a normal start is never interrupted.
pub fn spawn_startup_check(app: AppHandle) {
    spawn_flow(app, false);
}

fn spawn_flow(app: AppHandle, manual: bool) {
    tauri::async_runtime::spawn(async move {
        let state = app.state::<UpdaterState>();
        if state
            .busy
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            log(&app, "updater.skip already_running");
            return;
        }
        run_flow(&app, manual).await;
        app.state::<UpdaterState>().busy.store(false, Ordering::SeqCst);
    });
}

/// check → (download + verify) → hold for the user to install.
async fn run_flow(app: &AppHandle, manual: bool) {
    // If a verified package is already waiting, don't re-download it.
    let already_ready = app
        .state::<UpdaterState>()
        .pending
        .lock()
        .map(|g| g.is_some())
        .unwrap_or(false);
    if already_ready {
        if manual {
            show_window(app);
        }
        return;
    }

    emit(app, phase("checking", "Buscando actualizaciones…"));

    let endpoint = match resolve_endpoint() {
        Some(e) => e,
        None => {
            log(app, "updater.disabled no_release_channel");
            if manual {
                emit(
                    app,
                    phase(
                        "disabled",
                        "El canal de actualizaciones todavía no está configurado para esta instalación.",
                    ),
                );
            }
            return;
        }
    };

    let update = match check(app, &endpoint).await {
        Ok(Some(u)) => u,
        Ok(None) => {
            log(app, "updater.up_to_date");
            if manual {
                emit(
                    app,
                    json!({
                        "phase": "up-to-date",
                        "message": "La aplicación ya está actualizada.",
                        "version": app.package_info().version.to_string(),
                    }),
                );
            }
            return;
        }
        Err(e) => {
            log(app, &format!("updater.check_failed {e}"));
            if manual {
                emit(
                    app,
                    json!({
                        "phase": "error",
                        "message": "No se pudo comprobar si hay actualizaciones.",
                        "error": e,
                    }),
                );
            }
            return;
        }
    };

    let version = update.version.clone();
    let notes = update.body.clone().unwrap_or_default();
    log(app, &format!("updater.available version={version}"));
    // From here on the user gets the window whether or not they asked, because
    // there is something actionable to report.
    show_window(app);
    emit(
        app,
        json!({
            "phase": "available",
            "message": format!("Nueva versión {version} disponible."),
            "version": version,
            "notes": notes,
        }),
    );

    match download(app, &update, &version).await {
        Ok(bytes) => {
            let size = bytes.len();
            if let Ok(mut g) = app.state::<UpdaterState>().pending.lock() {
                *g = Some(Pending { update, bytes });
            }
            log(
                app,
                &format!("updater.verified version={version} bytes={size}"),
            );
            // Unattended policy for managed installs (and what the documented
            // end-to-end test drives): install as soon as the package is
            // verified, without waiting for a click. Off by default — a normal
            // user always gets the choice.
            if autoinstall_enabled() {
                log(app, "updater.autoinstall enabled");
                let install_app = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = updater_install(install_app);
                });
                return;
            }
            emit(
                app,
                json!({
                    "phase": "ready",
                    "message": format!("La versión {version} está lista para instalarse."),
                    "version": version,
                    "notes": notes,
                }),
            );
        }
        Err(e) => {
            // Signature mismatch lands here: nothing was installed and the
            // current install is untouched.
            log(app, &format!("updater.download_failed version={version} {e}"));
            emit(
                app,
                json!({
                    "phase": "error",
                    "message": "No se pudo descargar o verificar la actualización. La aplicación no ha sido modificada.",
                    "version": version,
                    "error": e,
                }),
            );
        }
    }
}

async fn check(app: &AppHandle, endpoint: &str) -> Result<Option<Update>, String> {
    let url = endpoint
        .parse()
        .map_err(|e| format!("bad_endpoint {e}"))?;
    let updater = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| format!("builder {e}"))?
        .on_before_exit(|| {
            // Last code that runs in this process before the installer takes
            // over (the plugin calls `std::process::exit(0)` right after).
            eprintln!("[partnera-affiliate] updater.exit_for_install");
        })
        .build()
        .map_err(|e| format!("build {e}"))?;
    updater
        .check()
        .await
        .map_err(|e| format!("check_failed {e}"))
}

/// Download with progress reporting. The plugin verifies the minisign signature
/// over the completed bytes before returning them.
async fn download(app: &AppHandle, update: &Update, version: &str) -> Result<Vec<u8>, String> {
    let progress_app = app.clone();
    let version_owned = version.to_string();
    let mut downloaded: u64 = 0;
    let mut last_percent: i64 = -1;

    update
        .download(
            move |chunk, total| {
                downloaded += chunk as u64;
                let percent = total
                    .filter(|t| *t > 0)
                    .map(|t| ((downloaded as f64 / t as f64) * 100.0).round() as i64)
                    .unwrap_or(-1);
                // Only emit on a whole-percent change (or when the total is
                // unknown, at most once per chunk) to keep the IPC quiet.
                if percent != last_percent {
                    last_percent = percent;
                    emit(
                        &progress_app,
                        json!({
                            "phase": "downloading",
                            "message": "Descargando actualización…",
                            "version": version_owned,
                            "downloaded": downloaded,
                            "total": total,
                            "percent": percent,
                        }),
                    );
                }
            },
            || {},
        )
        .await
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Commands (invoked by ui/updater.html)
// ---------------------------------------------------------------------------

/// Replay the current state to a window that just opened.
#[tauri::command]
pub fn updater_state(app: AppHandle) -> Value {
    app.state::<UpdaterState>()
        .last
        .lock()
        .ok()
        .and_then(|g| g.clone())
        .unwrap_or_else(|| phase("idle", "Sin comprobaciones todavía."))
}

/// "Buscar actualizaciones" from inside the updater window.
#[tauri::command]
pub fn updater_check(app: AppHandle) {
    spawn_flow(app, true);
}

/// Install the verified package and restart. On Windows this does not return:
/// the plugin launches the installer and exits the process, and the installer
/// relaunches the app.
#[tauri::command]
pub fn updater_install(app: AppHandle) -> Result<(), String> {
    let pending = app
        .state::<UpdaterState>()
        .pending
        .lock()
        .map_err(|_| "state_poisoned".to_string())?
        .take();

    let Some(Pending { update, bytes }) = pending else {
        return Err("no_pending_update".into());
    };

    log(&app, &format!("updater.installing version={}", update.version));
    emit(
        &app,
        json!({
            "phase": "installing",
            "message": "Instalando y reiniciando…",
            "version": update.version,
        }),
    );

    update.install(bytes).map_err(|e| {
        let msg = e.to_string();
        log(&app, &format!("updater.install_failed {msg}"));
        emit(
            &app,
            json!({
                "phase": "error",
                "message": "No se pudo instalar la actualización. La versión actual sigue intacta.",
                "error": msg,
            }),
        );
        msg
    })
}

/// Close the updater window ("Más tarde"). Any verified package stays in memory
/// for this session, so reopening offers to install it without re-downloading.
#[tauri::command]
pub fn updater_dismiss(app: AppHandle) {
    if let Some(win) = app.get_webview_window(UPDATER_WINDOW) {
        let _ = win.close();
    }
}
