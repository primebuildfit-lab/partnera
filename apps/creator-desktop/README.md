# Partnera Creator — desktop thin client

**Partnera Creator** is a standalone Windows desktop app (Tauri 2) for **creators**.
It is a separate product from Partnera Operations, Partnera Business, Partnera
Affiliate and the Partnera Internal OS.

It is a **thin client**: it bundles no runtime and no database. On launch it
navigates to the **Creator Portal** (`/creator`) served by the central Partnera
API over HTTPS. The central API is the single source of truth
(`packages/web` → shared Postgres), so the creator UI is always the live version;
the auto-updater only refreshes this native shell.

## What a creator gets

The loaded Creator Portal (`/creator`) is the creator-only surface already built
into the central app — profile, discover companies, my work (campaigns/jobs,
briefs, deliverables, file evidence, submissions), earnings/commissions/balance,
and account. Business-, admin-, operator- and affiliate-only surfaces are **not**
reachable: they live under different scopes the creator identity cannot open, and
in-window navigation is locked to the configured API host.

## Architecture

- **Reuse, not duplication.** No campaign/commission/tracking logic is copied. The
  desktop reuses the live central app's Creator Portal, so authentication, the API,
  domain types, shared UI, permissions, configuration, error handling and sessions
  all come from the central app.
- **No direct database.** The app never talks to Postgres. It only loads the
  configured HTTPS API host in-window.
- **Secure shell.** Web content gets **no** Tauri IPC (deny-by-default
  capabilities). Only the configured API host loads in-window; any other link opens
  in the system browser via a host allowlist. A custom `partnera-creator://` deep
  link is accepted only for `/creator…` paths on the configured host.

## Configuration (env vars)

| Variable | Default | Purpose |
| --- | --- | --- |
| `PARTNERA_API_URL` | `https://partnera-web-production.up.railway.app` | Central API base URL (the only in-window host). |
| `PARTNERA_UPDATE_ENDPOINT` | — | Runtime override for the updater manifest URL (local e2e). |
| `PARTNERA_UPDATE_OWNER` / `PARTNERA_UPDATE_REPO` | — | Baked at **build** time to form the GitHub releases endpoint. Unset ⇒ the app honestly reports "updates not configured". |

## Auto-update

Uses the official `tauri-plugin-updater` end to end — no custom updater. The
installed app polls

```
https://github.com/<owner>/<repo>/releases/download/partnera-creator-channel-stable/creator-latest.json
```

verifies the downloaded package against the minisign public key in
`tauri.conf.json`, and installs via the native NSIS installer.

The endpoint deliberately uses a **fixed per-product channel tag**, not
`releases/latest/download/…`: Partnera is a multi-product repo, where "latest"
resolves to whichever product released last, so a Business or Affiliate release
would start serving its manifest to Creator installs. Re-point the
`partnera-creator-channel-stable` tag at each Creator release.

Behaviour:

- **On launch** a non-blocking check runs. It never gates startup.
- When a newer version exists the user is **informed** in a small local updater
  window (current → new version, release notes, download progress, signature
  verification, install). The app is never restarted underneath an active portal
  session — the user chooses when.
- **Manual check** any time from the tray icon → *Buscar actualizaciones…*, which
  also states clearly when the app is already up to date.
- A tampered or unsigned package is rejected before installation, so a failed
  update leaves the working install untouched.

Only the desktop **shell** is updated; the Creator Portal UI is always the live
version served by the central API.

### Cutting a release

The endpoint is baked at build time, so a release needs the owner/repo and the
signing key. `TAURI_SIGNING_PRIVATE_KEY` must hold the **key contents** — the
bundler ignores `TAURI_SIGNING_PRIVATE_KEY_PATH` at this step.

```bash
# 1. bump `version` in src-tauri/tauri.conf.json (and Cargo.toml)
# 2. build a signed installer + detached .sig
export TAURI_SIGNING_PRIVATE_KEY="$(cat /path/to/creator-updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
export PARTNERA_UPDATE_OWNER=<owner> PARTNERA_UPDATE_REPO=<repo>
pnpm --filter @partnera/creator-desktop desktop:build

# 3. build the manifest the installed apps poll
pnpm --filter @partnera/creator-desktop release:manifest \
  --base-url https://github.com/<owner>/<repo>/releases/download/partnera-creator-channel-stable

# 4. publish `Partnera Creator_<version>_x64-setup.exe` and `creator-latest.json`
#    as assets on the `partnera-creator-channel-stable` release, re-pointing that
#    tag at this commit
```

The private key lives at `.secrets-tauri/creator-updater.key` (gitignored) and
must never be committed. Its public half is already in `tauri.conf.json`; if the
key is ever rotated, previously installed apps can no longer update themselves.

## Develop / build

```bash
pnpm --filter @partnera/creator-desktop desktop:dev     # run against the central API
pnpm --filter @partnera/creator-desktop desktop:build   # NSIS installer
```

Point at a local central app for development:

```bash
# terminal 1 — central app
pnpm --filter @partnera/web serve
# terminal 2 — desktop shell
PARTNERA_API_URL=http://localhost:4000 pnpm --filter @partnera/creator-desktop desktop:dev
```

## Identity

- productName: **Partnera Creator**
- identifier: `com.partnera.creator`
- package: `@partnera/creator-desktop`
- version: `0.1.1`
