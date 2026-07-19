//! Automatic updates for the Partnera Internal OS desktop wrapper (Tauri 2).
//!
//! Driven entirely from Rust via `UpdaterExt`, so the loaded web content (the
//! admin panel on loopback, which gets NO Tauri IPC) never receives the raw
//! updater surface. Downloads and minisign signature verification happen
//! natively inside the official plugin; an unsigned or tampered package is
//! rejected and never installed, so the working install is never left broken.
//!
//! Policy:
//!   * a single non-blocking check runs shortly after launch. It is SILENT when
//!     there is nothing to do — the operator is only interrupted when a real
//!     signed update exists;
//!   * installing is never automatic. The operator sees the version, the notes
//!     and a live progress bar, and clicks to install. This app supervises a
//!     local runtime an operator may be mid-task in; yanking it away
//!     unannounced is not acceptable;
//!   * a manual check is always available from the tray menu, and reports
//!     "up to date" / errors explicitly.
//!
//! Until a real release endpoint + production public key are configured, the
//! updater reports `not_configured` and does nothing.

use std::sync::Mutex;

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_updater::{Update, UpdaterExt};

use crate::log;

/// Label of the dedicated updater window. It lives on `tauri://` (trusted), so
/// it may use IPC — unlike the loopback admin panel in the `main` window.
pub(crate) const UPDATER_WINDOW: &str = "updater";

/// Event the updater window listens on. One event, one payload shape.
const STATE_EVENT: &str = "updater://state";

/// Shared updater state: the checked-but-not-yet-installed update, the last
/// phase (so a freshly opened window can be resynced), and a guard so two
/// checks/installs can never overlap.
#[derive(Default)]
pub(crate) struct UpdaterState {
    pending: Mutex<Option<Update>>,
    last: Mutex<Option<Phase>>,
    busy: Mutex<bool>,
}

/// Everything the UI can be told, as a single tagged union. `detail` carries the
/// technical cause for the log/diagnostics line; `message` is operator-facing.
#[derive(Serialize, Clone, Debug)]
#[serde(tag = "phase", rename_all = "snake_case")]
pub(crate) enum Phase {
    Checking,
    UpToDate { current: String },
    Available { current: String, version: String, notes: Option<String>, date: Option<String> },
    Downloading { received: u64, total: Option<u64> },
    Installing,
    Restarting,
    NotConfigured { current: String },
    Error { message: String, detail: String },
}

/// Fixed GitHub tag that always carries this product's update manifest.
/// Kept in sync with `.github/workflows/release-partnera-internal.yml`.
const CHANNEL_TAG: &str = "partnera-internal-channel-stable";

/// GitHub owner/repo the installed app polls for releases. Baked at build time
/// from `PARTNERA_UPDATE_OWNER` / `PARTNERA_UPDATE_REPO` when present (set by
/// CI), otherwise the documented placeholder so the app degrades honestly until
/// the release channel exists. A runtime `PARTNERA_UPDATE_ENDPOINT` override
/// wins, used for controlled end-to-end tests against a local manifest.
///
/// The source repo is PRIVATE, so releases must be published to a separate
/// PUBLIC repo: the updater downloads unauthenticated and cannot read private
/// release assets.
///
/// The manifest is pinned to the fixed rolling tag
/// `partnera-internal-channel-stable` rather than `releases/latest/download/`.
/// Several Partnera products ship out of the same releases repository, so "the
/// latest release" is whichever product published most recently — an Internal OS
/// client polling that URL would 404, or worse read a sibling product's
/// manifest, as soon as another app cut a release. The channel tag carries only
/// this product's manifest and is repointed on every Internal OS release; the
/// download URLs inside it point at the immutable per-version release assets.
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
        "https://github.com/{owner}/{repo}/releases/download/{CHANNEL_TAG}/internal-latest.json"
    ))
}

/// Map a raw plugin error to a short operator-facing Spanish message. The raw
/// text is kept separately as `detail` — never lost, just not shown as the
/// headline.
fn friendly(detail: &str) -> String {
    let d = detail.to_ascii_lowercase();
    if d.contains("signature") || d.contains("minisign") || d.contains("verif") {
        "La firma de la actualización no es válida. No se instaló nada."
    } else if d.contains("dns") || d.contains("connect") || d.contains("timed out")
        || d.contains("timeout") || d.contains("network") || d.contains("unreachable")
    {
        "No se pudo conectar con el servidor de actualizaciones."
    } else if d.contains("404") || d.contains("not found") {
        "No se encontró el manifiesto de versiones en el servidor."
    } else if d.contains("permission") || d.contains("denied") || d.contains("os error 5") {
        "Windows bloqueó la instalación. Ejecuta la app de nuevo y reintenta."
    } else {
        "No se pudo completar la comprobación de actualizaciones."
    }
    .to_string()
}

fn current_version(app: &AppHandle) -> String {
    app.package_info().version.to_string()
}

/// Record the phase and push it to the updater window (if open).
fn emit(app: &AppHandle, phase: Phase) {
    if let Some(state) = app.try_state::<UpdaterState>() {
        if let Ok(mut last) = state.last.lock() {
            *last = Some(phase.clone());
        }
    }
    let _ = app.emit_to(UPDATER_WINDOW, STATE_EVENT, phase);
}

/// Log + emit an error in one step, so no failure path can surface to the user
/// without also landing in the desktop log.
fn fail(app: &AppHandle, stage: &str, detail: String) {
    log(app, &format!("updater.error stage={stage} detail={}", detail.replace('"', "'")));
    emit(app, Phase::Error { message: friendly(&detail), detail });
}

/// Create (or focus) the updater window. Small, centred, always on top of the
/// console so a pending update is not lost behind the main window.
pub(crate) fn open_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window(UPDATER_WINDOW) {
        let _ = win.show();
        let _ = win.set_focus();
        return;
    }
    let built = WebviewWindowBuilder::new(app, UPDATER_WINDOW, WebviewUrl::App("updater.html".into()))
        .title("Actualizaciones — Partnera Internal OS")
        .inner_size(460.0, 340.0)
        .resizable(false)
        .minimizable(false)
        .maximizable(false)
        .center()
        .build();
    if let Err(e) = built {
        log(app, &format!("updater.window_failed {e}"));
    }
}

// ---------------------------------------------------------------------------
// Core flow
// ---------------------------------------------------------------------------

/// Try to acquire the single-flight guard. Returns false when a check or an
/// install is already running.
fn acquire(app: &AppHandle) -> bool {
    match app.try_state::<UpdaterState>() {
        Some(state) => match state.busy.lock() {
            Ok(mut busy) if !*busy => {
                *busy = true;
                true
            }
            _ => false,
        },
        None => false,
    }
}

fn release(app: &AppHandle) {
    if let Some(state) = app.try_state::<UpdaterState>() {
        if let Ok(mut busy) = state.busy.lock() {
            *busy = false;
        }
    }
}

/// Check the manifest. Stores the update when one is available and returns
/// whether it found anything. Emits every outcome.
async fn check(app: &AppHandle) -> bool {
    let current = current_version(app);

    let endpoint = match resolve_endpoint() {
        Some(e) => e,
        None => {
            log(app, "updater.not_configured no_release_channel");
            emit(app, Phase::NotConfigured { current });
            return false;
        }
    };

    emit(app, Phase::Checking);

    let url = match endpoint.parse() {
        Ok(u) => u,
        Err(e) => {
            fail(app, "endpoint", format!("bad_endpoint {e}"));
            return false;
        }
    };

    // The public key comes from tauri.conf.json. Signature verification is done
    // by the plugin against that key; we never hand-roll crypto.
    //
    // `on_before_exit` is essential here: on Windows the NSIS installer takes
    // over and the plugin ends this process with `std::process::exit(0)`, so
    // `RunEvent::Exit` never runs. Without stopping the bundled Node runtime
    // first it survives as an orphan holding `resources/node.exe` open, which
    // blocks the installer from replacing that file and from relaunching us.
    let exit_handle = app.clone();
    let updater = match app.updater_builder().endpoints(vec![url]).and_then(|b| {
        b.on_before_exit(move || {
            crate::log(&exit_handle, "updater.stopping_runtime_before_install");
            crate::stop_runtime(&exit_handle);
        })
        .build()
    }) {
        Ok(u) => u,
        Err(e) => {
            fail(app, "builder", e.to_string());
            return false;
        }
    };

    match updater.check().await {
        Ok(Some(update)) => {
            log(app, &format!("updater.available version={} current={current}", update.version));
            emit(
                app,
                Phase::Available {
                    current,
                    version: update.version.clone(),
                    notes: update.body.clone(),
                    date: update.date.map(|d| d.to_string()),
                },
            );
            if let Some(state) = app.try_state::<UpdaterState>() {
                if let Ok(mut pending) = state.pending.lock() {
                    *pending = Some(update);
                }
            }
            true
        }
        Ok(None) => {
            log(app, &format!("updater.up_to_date version={current}"));
            emit(app, Phase::UpToDate { current });
            false
        }
        Err(e) => {
            fail(app, "check", e.to_string());
            false
        }
    }
}

/// Download → verify → install → restart. Progress is streamed to the window.
async fn install(app: &AppHandle) {
    let update = match app.try_state::<UpdaterState>().and_then(|s| s.pending.lock().ok().and_then(|mut p| p.take())) {
        Some(u) => u,
        None => {
            fail(app, "install", "no_pending_update".into());
            return;
        }
    };

    log(app, &format!("updater.download_start version={}", update.version));
    emit(app, Phase::Downloading { received: 0, total: None });

    // Accumulate chunk sizes; the plugin reports the content length alongside.
    // Chunks arrive in the low tens of KB, so a ~40 MB package would fire
    // thousands of events: throttle to ~15/s (plus a final one at 100%) to keep
    // the bar smooth without flooding the IPC channel.
    const PROGRESS_INTERVAL_MS: u128 = 66;
    let progress_app = app.clone();
    let counter = std::sync::Arc::new(std::sync::atomic::AtomicU64::new(0));
    let last_emit = std::sync::Arc::new(Mutex::new(0u128));

    let finished_app = app.clone();
    let outcome = update
        .download_and_install(
            move |chunk: usize, total: Option<u64>| {
                let got = counter.fetch_add(chunk as u64, std::sync::atomic::Ordering::Relaxed)
                    + chunk as u64;
                let complete = total.is_some_and(|t| got >= t);
                let now = crate::now_millis();
                let due = match last_emit.lock() {
                    Ok(mut at) if complete || now.saturating_sub(*at) >= PROGRESS_INTERVAL_MS => {
                        *at = now;
                        true
                    }
                    _ => false,
                };
                if due {
                    emit(&progress_app, Phase::Downloading { received: got, total });
                }
            },
            move || {
                // Download complete: the plugin now verifies the minisign
                // signature and runs the NSIS installer.
                log(&finished_app, "updater.download_done verifying_signature");
                emit(&finished_app, Phase::Installing);
            },
        )
        .await;

    if let Err(e) = outcome {
        // Nothing was installed — the existing install is untouched. This is the
        // rollback path: a bad signature or a failed download simply aborts.
        fail(app, "install", e.to_string());
        return;
    }

    log(app, "updater.installed relaunching");
    emit(app, Phase::Restarting);
    // On Windows the NSIS installer takes over and terminates this process; the
    // restart below is the cross-platform fallback and does not return.
    app.restart();
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/// Non-blocking check right after launch. Silent unless an update exists: on
/// "up to date", "not configured" or any error it only writes the desktop log,
/// so a routine start never nags the operator.
pub fn spawn_startup_check(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if !acquire(&app) {
            return;
        }
        let found = check(&app).await;
        if found {
            open_window(&app);
            // Verification seam: `PARTNERA_UPDATE_UNATTENDED=1` skips the consent
            // click so the full download → verify → install → restart path can be
            // exercised end-to-end without a human (see UPDATER.md). It is OFF
            // unless explicitly set, and its use is logged.
            if std::env::var("PARTNERA_UPDATE_UNATTENDED").is_ok_and(|v| v == "1") {
                log(&app, "updater.unattended installing_without_consent");
                install(&app).await;
            }
        }
        release(&app);
    });
}

/// How often the app re-checks while it stays open. This is a supervision
/// console an operator can leave running for days, so a startup-only check
/// would mean a machine that is never restarted never sees an update.
/// `PARTNERA_UPDATE_INTERVAL_SECS` overrides it (used by the tests and for
/// controlled verification); 0 disables periodic checking entirely.
const DEFAULT_INTERVAL_SECS: u64 = 6 * 60 * 60;

fn interval_secs() -> u64 {
    match std::env::var("PARTNERA_UPDATE_INTERVAL_SECS") {
        Ok(raw) => raw.trim().parse().unwrap_or(DEFAULT_INTERVAL_SECS),
        Err(_) => DEFAULT_INTERVAL_SECS,
    }
}

/// Re-check on a timer for the lifetime of the process. Silent when there is
/// nothing to do; opens the window only when a real update appears, so a
/// long-running console never nags but never goes stale either. Never installs
/// on its own — that still needs the operator's click.
pub fn spawn_periodic_check(app: AppHandle) {
    let secs = interval_secs();
    if secs == 0 {
        log(&app, "updater.periodic disabled");
        return;
    }
    log(&app, &format!("updater.periodic every={secs}s"));
    // A plain thread rather than an async task: sleeping for hours inside the
    // shared async runtime would tie up one of its worker threads, and this
    // crate does not depend on tokio directly for a timer.
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(secs));
        // Skip this tick if a check or install is already running rather than
        // queueing up behind it.
        if !acquire(&app) {
            continue;
        }
        let found = tauri::async_runtime::block_on(check(&app));
        release(&app);
        if found {
            open_window(&app);
        }
    });
}

/// Manual check from the tray. Always opens the window first, so every outcome
/// — including "ya está actualizada" and errors — is visible.
pub fn spawn_manual_check(app: AppHandle) {
    open_window(&app);
    tauri::async_runtime::spawn(async move {
        if !acquire(&app) {
            return;
        }
        check(&app).await;
        release(&app);
    });
}

// ---------------------------------------------------------------------------
// IPC — app-owned commands, callable only from the trusted updater window
// ---------------------------------------------------------------------------

/// Re-send the current phase; called by the window once it has mounted so it
/// never shows a blank panel after being opened by the startup check.
#[tauri::command]
pub fn updater_sync(app: AppHandle) {
    let last = app
        .try_state::<UpdaterState>()
        .and_then(|s| s.last.lock().ok().and_then(|l| l.clone()));
    match last {
        Some(phase) => emit(&app, phase),
        None => emit(&app, Phase::UpToDate { current: current_version(&app) }),
    }
}

#[tauri::command]
pub fn updater_check(app: AppHandle) {
    spawn_manual_check(app);
}

#[tauri::command]
pub fn updater_install(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if !acquire(&app) {
            return;
        }
        install(&app).await;
        release(&app);
    });
}

#[tauri::command]
pub fn updater_close(app: AppHandle) {
    if let Some(win) = app.get_webview_window(UPDATER_WINDOW) {
        let _ = win.close();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `resolve_endpoint` reads process-wide env, so these cases must not run
    /// concurrently with each other. One test, asserted in sequence.
    #[test]
    fn endpoint_resolution() {
        // No override + the documented REPLACE_ sentinels baked in at compile
        // time: the app must degrade honestly rather than poll a bogus URL.
        std::env::remove_var("PARTNERA_UPDATE_ENDPOINT");
        assert!(resolve_endpoint().is_none(), "placeholders must yield no endpoint");

        // A runtime override wins and is trimmed (used for E2E tests).
        std::env::set_var("PARTNERA_UPDATE_ENDPOINT", "  http://127.0.0.1:877/latest.json  ");
        assert_eq!(
            resolve_endpoint().as_deref(),
            Some("http://127.0.0.1:877/latest.json")
        );

        // A blank override is ignored, not treated as a valid endpoint.
        std::env::set_var("PARTNERA_UPDATE_ENDPOINT", "   ");
        assert!(resolve_endpoint().is_none(), "blank override must be ignored");

        std::env::remove_var("PARTNERA_UPDATE_ENDPOINT");
    }

    /// Also env-driven, so it shares the serial-execution constraint above.
    #[test]
    fn periodic_interval_resolution() {
        std::env::remove_var("PARTNERA_UPDATE_INTERVAL_SECS");
        assert_eq!(interval_secs(), DEFAULT_INTERVAL_SECS);

        std::env::set_var("PARTNERA_UPDATE_INTERVAL_SECS", " 90 ");
        assert_eq!(interval_secs(), 90, "override should win and be trimmed");

        // 0 is meaningful (disable), not a parse failure.
        std::env::set_var("PARTNERA_UPDATE_INTERVAL_SECS", "0");
        assert_eq!(interval_secs(), 0);

        // Garbage must not disable checking or panic — fall back to the default.
        std::env::set_var("PARTNERA_UPDATE_INTERVAL_SECS", "nonsense");
        assert_eq!(interval_secs(), DEFAULT_INTERVAL_SECS);

        std::env::remove_var("PARTNERA_UPDATE_INTERVAL_SECS");
    }

    #[test]
    fn signature_failures_are_reported_as_signature_failures() {
        let msg = friendly("Error: signature verification failed for bundle");
        assert!(msg.contains("firma"), "got: {msg}");
    }

    #[test]
    fn network_failures_are_distinguished_from_signature_failures() {
        assert!(friendly("failed to connect to host").contains("conectar"));
        assert!(friendly("operation timed out").contains("conectar"));
    }

    #[test]
    fn unknown_failures_fall_back_to_a_generic_message() {
        let msg = friendly("something entirely unexpected");
        assert!(msg.contains("No se pudo completar"), "got: {msg}");
    }
}
