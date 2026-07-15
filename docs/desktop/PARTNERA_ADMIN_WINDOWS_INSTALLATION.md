# Partnera Internal OS — Windows Installation

Private pilot. The installer is unsigned; Windows SmartScreen will show
"Unknown publisher" — this is expected for a private pilot. Do not use any insecure
method to bypass SmartScreen; click **More info → Run anyway** to proceed.

## Install

1. Run `Partnera Internal OS_0.1.0_x64-setup.exe` (NSIS, per-user install — no admin
   rights required).
2. The app installs for the current user, adds a **Start menu** entry and (optionally) a
   **desktop shortcut**, and registers an uninstaller in *Apps & features*.
3. Launch **Partnera Internal OS** from the Start menu.

## First launch

- A splash shows: *Checking secure runtime… → Connecting to Partnera services… →
  Loading permissions…* while the bundled Node runtime starts on `127.0.0.1`.
- You land on the **Partnera Internal OS sign-in** (platform operators only). Sign in
  with a platform-operator identity (e.g. `admin@partnera.test` in the local build).
- Business/Creator/Affiliate identities are **denied** at `/internal` (deny-by-default).

## What it stores

| Path | Contents |
| --- | --- |
| `%APPDATA%\com.partnera.internal\data.json` | local world (dev data) |
| `%APPDATA%\com.partnera.internal\logs\desktop.log` | secret-free supervisor log |
| `%APPDATA%\com.partnera.internal\logs\runtime.log` | the runtime's own stdout/stderr (secret-redacted by the host) |
| window-state file (Tauri) | window size/position/maximized |

The window remembers its size, position and maximized state between launches.

## Sessions

Sessions are held in the runtime's in-memory store, which starts fresh each time the app
launches (the runtime is a child process started on launch and stopped on exit). Within
a run the session persists; **after fully quitting and relaunching you sign in again.**
This matches the existing local host and is intentional for the pilot (no auth change).

## Uninstall

Uninstall from *Settings → Apps → Partnera Internal OS*, or via the bundled uninstaller.
Your data folder (`%APPDATA%\com.partnera.internal`) is left in place unless you
remove it manually — the uninstaller does not delete data without confirmation.

## Requirements on the target machine

- Windows 10/11 x64 with the **WebView2 Runtime** (present by default on Windows 11).
- **No Node.js install required** — the runtime is bundled.
