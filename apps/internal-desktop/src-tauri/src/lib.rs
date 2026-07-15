//! Partnera Internal OS — desktop supervisor (Tauri 2).
//!
//! This is *packaging only*. The private admin panel is the existing Partnera
//! local web host (`packages/web/src/server.ts`, bundled to `resources/server.cjs`).
//! On launch we:
//!   1. pick a free loopback port,
//!   2. spawn a bundled Node runtime serving that host on 127.0.0.1 (never LAN),
//!   3. poll `/ready` until the store answers,
//!   4. navigate the window from the splash to `/desktop` (Internal OS sign-in),
//!   5. kill the runtime cleanly on exit.
//!
//! Security posture: the loaded web content gets NO Tauri IPC (see capabilities);
//! external links open in the system browser via a host allowlist; secrets never
//! reach the local logs.

use std::fs::{create_dir_all, OpenOptions};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

/// Hosts whose links may be opened in the system browser (Block 10 allowlist).
/// Exact host or any subdomain of these registrable domains.
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

/// Shared runtime state: the child process and the chosen loopback port.
#[derive(Default)]
struct Runtime {
    child: Mutex<Option<Child>>,
    port: Mutex<u16>,
    log_file: Mutex<Option<PathBuf>>,
}

// ---------------------------------------------------------------------------
// Small helpers (std-only; no network crate pulled in)
// ---------------------------------------------------------------------------

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

/// Append a line to the local desktop log. NEVER logs secrets/tokens/URLs with
/// query strings — callers pass only safe, structured messages.
fn log(app: &AppHandle, msg: &str) {
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

/// Reserve a free port on loopback, then release it for the child to bind.
fn free_loopback_port() -> Option<u16> {
    let listener = TcpListener::bind("127.0.0.1:0").ok()?;
    listener.local_addr().ok().map(|a| a.port())
}

/// Minimal HTTP/1.0 GET against the loopback runtime. Returns (status, body).
fn http_get(port: u16, path: &str) -> Option<(u16, String)> {
    let mut stream = TcpStream::connect(("127.0.0.1", port)).ok()?;
    stream.set_read_timeout(Some(Duration::from_secs(3))).ok()?;
    stream.set_write_timeout(Some(Duration::from_secs(3))).ok()?;
    let req = format!(
        "GET {} HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n",
        path
    );
    stream.write_all(req.as_bytes()).ok()?;
    let mut buf = String::new();
    stream.read_to_string(&mut buf).ok()?;
    let status = buf
        .lines()
        .next()
        .and_then(|l| l.split_whitespace().nth(1))
        .and_then(|c| c.parse::<u16>().ok())?;
    let body = buf.splitn(2, "\r\n\r\n").nth(1).unwrap_or("").to_string();
    Some((status, body))
}

fn host_is_allowed(host: &str) -> bool {
    let host = host.to_ascii_lowercase();
    EXTERNAL_ALLOWLIST
        .iter()
        .any(|d| host == *d || host.ends_with(&format!(".{d}")))
}

// ---------------------------------------------------------------------------
// Resource + directory resolution
// ---------------------------------------------------------------------------

/// Resolve the bundled node.exe + server.cjs. Prefers the installed resource
/// dir; falls back to the crate's `resources/` in dev.
fn runtime_paths(app: &AppHandle) -> Result<(PathBuf, PathBuf), String> {
    if let Ok(res) = app.path().resource_dir() {
        let node = res.join("resources").join("node.exe");
        let server = res.join("resources").join("server.cjs");
        if node.exists() && server.exists() {
            return Ok((node, server));
        }
    }
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources");
    let node = dev.join("node.exe");
    let server = dev.join("server.cjs");
    if node.exists() && server.exists() {
        return Ok((node, server));
    }
    Err("bundled runtime (node.exe / server.cjs) was not found".into())
}

/// The per-user data + log directory. Data is the local world JSON (source of
/// truth remains the backend for real deployments); logs are secret-free.
fn data_and_log(app: &AppHandle) -> (PathBuf, PathBuf) {
    let base = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| std::env::temp_dir().join("partnera-internal"));
    let _ = create_dir_all(&base);
    let logs = base.join("logs");
    let _ = create_dir_all(&logs);
    (base.join("data.json"), logs.join("desktop.log"))
}

// ---------------------------------------------------------------------------
// Runtime lifecycle
// ---------------------------------------------------------------------------

const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn spawn_runtime(
    node: &PathBuf,
    server: &PathBuf,
    port: u16,
    data_file: &PathBuf,
    version: &str,
) -> Result<Child, String> {
    // Run node from the resources dir and pass the bare script name. Passing an
    // absolute Windows path as an argument via std::process::Command can make node
    // mis-resolve its main module (observed: `EISDIR lstat 'D:'`); a relative name
    // resolved against an explicit cwd is robust.
    let res_dir = server.parent().ok_or("bad server path")?;
    let script = server.file_name().ok_or("bad server path")?;
    let mut cmd = Command::new(node);
    cmd.arg(script)
        .current_dir(res_dir)
        .env("PORT", port.to_string())
        .env("PARTNERA_HOST", "127.0.0.1")
        .env("PARTNERA_DATA", data_file)
        .env("PARTNERA_BUILD", version)
        // NOTE: NODE_ENV is deliberately NOT "production" — that would mark the
        // session cookie Secure, which a browser drops over plain http loopback.
        .stdin(Stdio::null());
    // Capture the runtime's own stdout/stderr to a secret-free runtime log so a
    // failed boot is diagnosable (Block 14). The host redacts secrets in its logs.
    let runtime_log = data_file
        .parent()
        .map(|base| base.join("logs").join("runtime.log"));
    match runtime_log.and_then(|p| std::fs::File::create(p).ok()) {
        Some(file) => match file.try_clone() {
            Ok(err) => {
                cmd.stdout(Stdio::from(file)).stderr(Stdio::from(err));
            }
            Err(_) => {
                cmd.stdout(Stdio::from(file)).stderr(Stdio::null());
            }
        },
        None => {
            cmd.stdout(Stdio::null()).stderr(Stdio::null());
        }
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.spawn().map_err(|e| e.to_string())
}

fn emit_status(app: &AppHandle, status: &str, step: &str, state: &str) {
    let _ = app.emit("boot://status", json!({ "status": status, "step": step, "state": state }));
}

fn emit_error(app: &AppHandle, title: &str, message: &str) {
    let _ = app.emit("boot://error", json!({ "title": title, "message": message }));
}

/// Kill any running child, then start the runtime and, once ready, navigate the
/// main window into the Internal OS. Runs on a background thread.
fn boot(app: AppHandle) {
    std::thread::spawn(move || {
        // Stop a previous instance if this is a retry.
        if let Some(mut guard) = app.state::<Runtime>().child.lock().ok() {
            if let Some(mut child) = guard.take() {
                let _ = child.kill();
            }
        }

        emit_status(&app, "Checking secure runtime…", "runtime", "active");
        let version = app.package_info().version.to_string();

        let (node, server) = match runtime_paths(&app) {
            Ok(p) => p,
            Err(e) => {
                log(&app, "boot.error runtime_missing");
                emit_error(
                    &app,
                    "Runtime missing",
                    &format!("The bundled Partnera runtime could not be located. {e}"),
                );
                return;
            }
        };

        let (data_file, _log_file) = data_and_log(&app);
        let port = match free_loopback_port() {
            Some(p) => p,
            None => {
                emit_error(&app, "No free port", "Could not reserve a local port on 127.0.0.1.");
                return;
            }
        };
        *app.state::<Runtime>().port.lock().unwrap() = port;

        emit_status(&app, "Connecting to Partnera services…", "runtime", "done");
        emit_status(&app, "Connecting to Partnera services…", "services", "active");

        let child = match spawn_runtime(&node, &server, port, &data_file, &version) {
            Ok(c) => c,
            Err(e) => {
                log(&app, "boot.error spawn_failed");
                emit_error(
                    &app,
                    "Runtime failed to start",
                    &format!("The local Partnera service could not be launched. {e}"),
                );
                return;
            }
        };
        *app.state::<Runtime>().child.lock().unwrap() = Some(child);
        log(&app, &format!("boot.spawn port={port} version={version}"));

        // Poll readiness for up to ~30s (60 × 500ms).
        let mut ready = false;
        for attempt in 0..60 {
            // If the child died, stop early.
            if let Ok(mut guard) = app.state::<Runtime>().child.lock() {
                if let Some(child) = guard.as_mut() {
                    if let Ok(Some(_)) = child.try_wait() {
                        emit_error(
                            &app,
                            "Runtime stopped",
                            "The local Partnera service exited unexpectedly. Check the logs and retry.",
                        );
                        log(&app, "boot.error child_exited");
                        return;
                    }
                }
            }
            if let Some((status, body)) = http_get(port, "/ready") {
                if status == 200 && body.contains("\"ready\":true") {
                    ready = true;
                    break;
                }
            }
            if attempt == 6 {
                emit_status(&app, "Loading permissions…", "services", "done");
                emit_status(&app, "Loading permissions…", "permissions", "active");
            }
            std::thread::sleep(Duration::from_millis(500));
        }

        if !ready {
            emit_error(
                &app,
                "Services unavailable",
                "Partnera services did not become ready in time. Verify the runtime and retry.",
            );
            log(&app, "boot.error not_ready");
            return;
        }

        emit_status(&app, "Loading permissions…", "permissions", "done");
        log(&app, "boot.ready");

        // Navigate the window into the Internal OS sign-in.
        if let Some(win) = app.get_webview_window("main") {
            let url = format!("http://127.0.0.1:{port}/desktop");
            match url.parse() {
                Ok(u) => {
                    let _ = win.navigate(u);
                    let _ = win.set_focus();
                }
                Err(_) => emit_error(&app, "Internal error", "Could not resolve the app URL."),
            }
        }
    });
}

// ---------------------------------------------------------------------------
// IPC commands (app-defined; used only by the trusted splash on tauri://)
// ---------------------------------------------------------------------------

#[tauri::command]
fn retry_boot(app: AppHandle) {
    log(&app, "boot.retry");
    boot(app);
}

#[tauri::command]
fn open_logs_dir(app: AppHandle) {
    let (_data, log_file) = data_and_log(&app);
    if let Some(dir) = log_file.parent() {
        let _ = app.opener().open_path(dir.to_string_lossy().to_string(), None::<&str>);
    }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .manage(Runtime::default())
        .invoke_handler(tauri::generate_handler![retry_boot, open_logs_dir])
        .setup(|app| {
            let handle = app.handle().clone();

            // Record the log path up-front so early failures are captured.
            let (_data, log_file) = data_and_log(&handle);
            *handle.state::<Runtime>().log_file.lock().unwrap() = Some(log_file);
            log(&handle, "app.start");

            // Build the single window on the splash, with external-link control.
            let nav_handle = handle.clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Partnera Internal OS")
                .inner_size(1540.0, 960.0)
                .min_inner_size(1180.0, 720.0)
                .resizable(true)
                .maximizable(true)
                .center()
                .on_navigation(move |url| {
                    let scheme = url.scheme();
                    let host = url.host_str().unwrap_or("");
                    // In-window: only the splash and the loopback runtime.
                    if scheme == "tauri" {
                        return true;
                    }
                    if scheme == "http" && (host == "127.0.0.1" || host == "localhost") {
                        return true;
                    }
                    // External http(s): open allowlisted hosts in the system
                    // browser; never load them inside the window.
                    if scheme == "http" || scheme == "https" {
                        if host_is_allowed(host) {
                            let _ = nav_handle
                                .opener()
                                .open_url(url.to_string(), None::<&str>);
                        }
                    }
                    false
                })
                .build()?;

            boot(handle);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building Partnera Internal OS")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<Runtime>() {
                    if let Ok(mut guard) = state.child.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
