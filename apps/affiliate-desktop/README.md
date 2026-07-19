# Partnera Affiliate — desktop thin client (Tauri 2)

Windows desktop wrapper for the **Partnera Affiliate** portal. It is a **thin
client**: it bundles no Node runtime and no local database. On launch it opens a
native window and navigates to `${PARTNERA_API_URL}/affiliate` over HTTPS. The
central Partnera API (`packages/web`, deployed on Railway, `postgres` mode →
shared Postgres) is the single source of truth, so the portal UI is always the
live version.

```
Partnera Affiliate (this app, webview)  ─HTTPS→  central API (/affiliate)  ─→  shared Postgres
```

This is a **separate desktop product** from Partnera Operations, Partnera
Internal OS, Partnera Business and Partnera Creator. It is aimed only at
**affiliates**: the portal surfaces performance/dashboard, referral links,
coupon codes, commissions (pending / approved / paid / history), balance,
payouts, promotional materials, notifications, profile and settings — and
nothing else. Administration, company-internal tooling, creator tooling and
platform configuration are **not** reachable from this shell.

## Identity

| | |
|---|---|
| productName | `Partnera Affiliate` |
| identifier  | `com.partnera.affiliate` |
| package     | `@partnera/affiliate-desktop` / crate `partnera-affiliate-desktop` |
| version     | `0.1.0` |

## Configuration

- `PARTNERA_API_URL` — central API base URL. Defaults to
  `https://partnera-web-production.up.railway.app` when unset. No trailing slash.

The configured API host is the only host allowed to load **inside** the window;
any other external link (GitHub, Shopify admin, …) opens in the system browser
via an allowlist. The web content gets **no** Tauri IPC.

## Security — affiliate isolation

Per-affiliate data isolation is enforced **server-side**, not by this shell:

- The `/affiliate` scope binds every query to the authenticated
  `session.affiliateId`, so an affiliate only ever sees their own links,
  commissions, balance and payouts.
- The operator scopes (`/ops`, `/internal`) are denied to non-operators
  (`isPlatformOperator`, deny-by-default). This shell only navigates to
  `/affiliate` and grants no privilege of its own.
- No secrets are baked into the frontend or written to logs (the local
  `desktop.log` carries only structured boot events — a host name, never a
  token). Sign-out uses the portal's own `/logout`.

## Build

```
pnpm --filter @partnera/affiliate-desktop desktop:build   # NSIS installer
pnpm --filter @partnera/affiliate-desktop desktop:dev      # dev run
```

`desktop:build` stamps `src-tauri/resources/build-info.json` (version, commit,
build id, target API URL) and produces the NSIS installer under
`src-tauri/target/release/bundle/nsis/`.

> Building requires the Rust toolchain. Installing the produced `.exe` is a
> separate, explicit step.

## Auto-update

Uses the **official** `tauri-plugin-updater`. The updater refreshes only this
native shell (the portal UI is always the live server version).

**What the user sees**

- On launch, a non-blocking check runs. If nothing is available the app stays
  silent; if there is a new version, a small window opens, downloads it with a
  progress bar, and offers **Reiniciar e instalar**.
- **Ayuda → Buscar actualizaciones…** checks on demand and always reports an
  outcome, including "La aplicación ya está actualizada." (Once the window has
  navigated to the remote portal, this menu is the only in-app entry point.)
- Every outcome is written to `desktop.log` (`Ayuda → Ver logs`).

**Signing.** This app has its **own** keypair (minisign `9365EE8087376568`).
Never reuse another Partnera app's key here: a shared key lets one product's
package be accepted by another product's client. The private half lives only in
`.secrets-tauri/affiliate-updater.key` (gitignored) and in the CI secret
`PARTNERA_AFFILIATE_SIGNING_KEY`. `Update::download` verifies the signature
before the bytes ever reach the installer, so a tampered package fails the
download step and the working install is left untouched.

**Release.** Tag `partnera-affiliate-v<version>` →
`.github/workflows/release-partnera-affiliate.yml` builds with
`src-tauri/tauri.conf.release.json` (which enables `createUpdaterArtifacts`),
publishes the versioned release, then repoints the rolling channel tag
`partnera-affiliate-channel-stable`, which is what installed clients poll.

**Still dormant** until the repo has a GitHub remote and the signing secret is
set: `PARTNERA_UPDATE_OWNER`/`PARTNERA_UPDATE_REPO` default to `REPLACE_*`
sentinels, and while they are in place the updater honestly reports "not
configured" instead of pretending to work.

| Env var | When | Purpose |
|---|---|---|
| `PARTNERA_UPDATE_ENDPOINT` | runtime | Override the manifest URL (local E2E tests). |
| `PARTNERA_UPDATE_AUTOINSTALL` | runtime | `1` installs a verified update without waiting for a click (managed deployments). The signature check is **not** skipped. |
| `PARTNERA_UPDATE_OWNER` / `PARTNERA_UPDATE_REPO` | build | Bake the GitHub release channel (set by CI). |

See `src-tauri/src/updater.rs` and `PARTNERA_AFFILIATE_UPDATER_REPORT.md`.
