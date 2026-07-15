# Partnera Internal OS — Desktop Security

Private pilot build. This documents the security posture of the Tauri wrapper. The
application logic, authorization, and financial rules are **unchanged** from the web
Internal OS; the desktop only adds a container.

## Trust boundary

| Origin | Privilege | Notes |
| --- | --- | --- |
| `tauri://localhost` (splash `ui/index.html`) | Privileged: may listen to boot events and call the two app commands (`retry_boot`, `open_logs_dir`) | Static, bundled, no remote content |
| `http://127.0.0.1:<port>` (the Internal OS) | **Unprivileged**: `withGlobalTauri` injects the Tauri API only on `tauri://`, not on the loopback http origin, so the admin panel has **no** access to Tauri IPC | This is the key boundary: even though our own server is loaded, it cannot reach the OS through Tauri |

## Capabilities (deny-by-default)

`src-tauri/capabilities/default.json` grants **only** `core:default`. Explicitly **not**
enabled: `fs:*`, `shell:*`, `http:*`, `process:*`, arbitrary `opener` from web content.
The admin panel cannot:

- run PowerShell or any shell command;
- read/write the filesystem;
- make arbitrary HTTP requests through Tauri;
- spawn processes;
- open arbitrary URLs from web content;
- install dependencies.

The local runtime is spawned from **Rust** (`std::process::Command`), not through a
capability, so no `shell` permission is exposed to reach it.

## Network exposure

- The Node runtime binds **`127.0.0.1` only** (`server.ts` → `PARTNERA_HOST ?? "127.0.0.1"`).
  It is never reachable on the LAN.
- The port is an ephemeral free port chosen at launch (`TcpListener` on `127.0.0.1:0`).
- Readiness polling uses a std-only loopback HTTP GET — no networking crate is added.

## External links (allowlist)

Navigation is intercepted in Rust (`on_navigation`):

- `tauri://` and `http://127.0.0.1|localhost` load **in-window**;
- any other `http(s)` URL is **never** loaded in-window; if its host is on the
  allowlist it opens in the **system browser** via `tauri-plugin-opener`, otherwise it
  is blocked.

Allowlisted registrable domains (and subdomains): `shopify.com`, `myshopify.com`,
`admin.shopify.com`, `railway.app`, `up.railway.app`, `supabase.com`, `supabase.co`,
`github.com`, `primebuildfit.com`. No user-controlled scheme/URL can be opened.

## Secrets

The desktop never stores or logs secrets. Not exposed anywhere in the desktop layer:
`DATABASE_URL`, private keys, tokens, cookies, Shopify secrets, service roles, provider
keys, banking/payment data, future KYC. Secrets remain in the backend/host env. The
web host already redacts secrets from its own logs (`observability.ts`). Desktop logs
(see below) contain only structured, secret-free events.

## Local logs

`%APPDATA%\com.partnera.internal\logs\desktop.log` records: app start, boot spawn
(loopback port + app version only), readiness, retries, and failure categories
(`runtime_missing`, `spawn_failed`, `child_exited`, `not_ready`). A sibling
`runtime.log` captures the runtime's own stdout/stderr (the host already redacts
secrets there). Neither ever records
tokens, passwords, cookies, `DATABASE_URL`, balances, payment data, or personal data.
The **Open logs** button (splash error state) opens the log *folder* via the opener.

## Updates / signing

Pilot: manual updates only, no auto-updater, no Microsoft Store, no commercial
certificate. The installer is unsigned, so Windows SmartScreen shows
"Unknown publisher" — acceptable for a private pilot. No insecure SmartScreen bypass is
used. See `PARTNERA_ADMIN_DESKTOP_BUILD.md` for how to add signing/updater later.
