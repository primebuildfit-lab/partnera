# Partnera Business — desktop thin client (Tauri 2)

Windows desktop wrapper for the **Partnera Business** consoles — the surface a
**company/tenant** uses to run its programs, offers, campaigns, linked affiliates
and creators, conversions, commissions, balances, payments, performance,
integrations and company settings.

It is a **thin client**: it bundles no Node runtime and no local database. On
launch it opens a native window and navigates to the Business entry of the
central Partnera API over HTTPS. The central API (`packages/web`, deployed on
Railway, `postgres` mode → shared Postgres) is the single source of truth, so the
console UI is always the live version.

```
Partnera Business (this app, webview)  ─HTTPS→  central API (/business)  ─→  shared Postgres
```

This is **not** Partnera Operations. Operations (`apps/operations-desktop`) loads
the platform-**operator** consoles (`/ops`, guarded by `isPlatformOperator`) that
span *all* tenants. Partnera Business loads only the tenant-scoped `/business`
surface — no global-operator tooling, no cross-tenant administration, and none of
the Affiliate- or Creator-only portals.

## Identity

| field        | value                    |
| ------------ | ------------------------ |
| productName  | `Partnera Business`      |
| identifier   | `com.partnera.business`  |
| package name | `@partnera/business-desktop` (app id `partnera-business`) |
| version      | `0.1.2`                  |

The identifier is distinct from Partnera Operations (`com.partnera.operations`),
so the two install and update independently.

## Configuration

- `PARTNERA_API_URL` — central API base URL. Defaults to
  `https://partnera-web-production.up.railway.app` when unset. No trailing slash.
- `PARTNERA_BUSINESS_PATH` — the in-window entry path. Defaults to
  `/desktop-business` (a business-scoped sign-in served by the central API). Set
  to `/business` to land directly on the dashboard against an API build that does
  not yet expose `/desktop-business`.

The configured API host is the only host allowed to load **inside** the window;
any other external link (Shopify admin, Railway, GitHub, …) opens in the system
browser via an allowlist. The web content gets **no** Tauri IPC.

## Build

```
pnpm --filter @partnera/business-desktop desktop:build   # NSIS installer
pnpm --filter @partnera/business-desktop desktop:dev      # dev run
```

`desktop:build` stamps `src-tauri/resources/build-info.json` (version, commit,
build id, target API URL) and produces the NSIS installer under
`src-tauri/target/release/bundle/nsis/`.

> Building requires the Rust toolchain. Installing the produced `.exe` is a
> separate, explicit step.

## Auto-update

The shell auto-updates via `tauri-plugin-updater` (see `src/updater.rs`): a
non-blocking check at launch downloads, **minisign-verifies**, installs, and
relaunches a newer **signed** shell. Because this is a thin client, only the
native shell is updated — the console UI refreshes instantly from the API.

### What the user sees

- **At launch** — a silent, non-blocking check. It surfaces itself *only* when
  there is something to install: the "Actualizaciones" window opens showing the
  new version, its release notes, and an **Instalar y reiniciar** button.
- **On demand** — menu **Partnera → Buscar actualizaciones…** (`Ctrl+U`). This
  reports *both* outcomes explicitly: a new version, or "la aplicación ya está
  actualizada".
- **While downloading** — a real progress bar with downloaded/total MB and a
  percentage (indeterminate if the server sends no `Content-Length`).
- **On failure** — a plain-language Spanish error stating that the current
  version is intact. Every outcome is appended to `desktop.log`.

The update UI lives in its **own local window** (`ui/updater.html`, capability
`updater-window`). This is deliberate: the main window loads remote content that
gets no Tauri IPC, so the remote console can neither observe nor drive the
updater.

### Signing

| item        | value                                                    |
| ----------- | -------------------------------------------------------- |
| public key  | `tauri.conf.json → plugins.updater.pubkey`, id `20B16525C8AD120B` |
| private key | `<repo>/.secrets-tauri/business-updater.key` (gitignored, no password) |

This keypair belongs to **Partnera Business only**. Never sign this product with
another product's key, and never let two products share a manifest.

Building a release requires `TAURI_SIGNING_PRIVATE_KEY_PATH` (or
`TAURI_SIGNING_PRIVATE_KEY`) to be set, otherwise no `.sig` is produced and
installed apps will reject the update.

### Release channel

Status: **live.** Verified with a real 0.1.1 → 0.1.2 update downloaded from
GitHub over HTTPS.

Host: **`primebuildfit-lab/partnera-releases`** (public — the updater downloads
unauthenticated, so a private repo cannot serve these assets). It holds signed
binaries only, no source.

Installed apps poll a **fixed channel tag**, not `releases/latest`:

```
partnera-business-channel-stable   business-latest.json   (repointed each release)
partnera-business-vX.Y.Z           installer + .sig       (immutable)
```

`releases/latest` is deliberately avoided: it resolves to the newest release of
the *whole repo*, so two products sharing this repo would shadow each other's
manifest. Same convention as Partnera Affiliate.

To publish a new version: bump the version, build with
`TAURI_SIGNING_PRIVATE_KEY` + `PARTNERA_UPDATE_OWNER=primebuildfit-lab` +
`PARTNERA_UPDATE_REPO=partnera-releases`, create the `partnera-business-vX.Y.Z`
release with the installer and `.sig`, then upload the regenerated
`business-latest.json` to `partnera-business-channel-stable` with `--clobber`.

The `release-partnera-business` workflow automates this, but needs the repo
secret `TAURI_SIGNING_PRIVATE_KEY` first — releases so far were **signed
locally**, so that secret does not exist yet.

For a controlled local end-to-end test, set `PARTNERA_UPDATE_ENDPOINT` to a
manifest URL at runtime — this is how the flow in
`PARTNERA_BUSINESS_UPDATER_REPORT.md` was verified.
