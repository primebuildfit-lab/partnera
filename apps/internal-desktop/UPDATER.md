# Partnera Internal OS — automatic updates (desktop)

The `apps/internal-desktop` Tauri 2 app updates itself through the **official
Tauri updater plugin**. On launch it checks a signed release manifest; when a
newer version exists the operator is shown what it is and installs it with one
click, with a live progress bar. The minisign signature is verified before
anything is installed — a tampered or unsigned package is rejected and the
working install is left untouched.

## Behaviour

| Situation | What the operator sees |
|---|---|
| Startup, nothing new | Nothing. Silent; logged as `updater.up_to_date`. |
| Still open 6h later | Silent re-check. Only surfaces if something new appeared. |
| Startup, update available | Updates window: version, notes, **Instalar ahora** / **Más tarde**. |
| Manual check (tray) | Window opens immediately and reports every outcome, including "La aplicación está actualizada". |
| Downloading | Real percentage + MB when the server sends `content-length`; animated bar and byte count when it does not. |
| Bad signature / network error | Plain-Spanish cause, expandable technical detail, **Reintentar**. Nothing installed. |
| No release channel configured | "Actualizaciones no configuradas" (honest, not a fake error). |

**Installing is never automatic.** This app supervises a local runtime an
operator may be mid-task in, so the update is downloaded and installed only
after an explicit click. The *check* is automatic; the *install* is consented.

**Checks repeat every 6 hours** while the app stays open — this console is
routinely left running for days, so a startup-only check would mean a machine
that is never restarted never learns about an update. Override with
`PARTNERA_UPDATE_INTERVAL_SECS` (`0` disables periodic checking).

## Architecture
- **Rust-driven** (`src-tauri/src/updater.rs`). The whole check → download →
  verify → install → restart flow runs natively. `Phase` is emitted to the UI on
  `updater://state`.
- **The updater plugin surface is never exposed to web content.** The main
  window loads the admin panel over loopback and has NO Tauri IPC. The updates
  window is a separate trusted `tauri://` page (`ui/updater.html`) that can only
  call four app-owned commands: `updater_sync`, `updater_check`,
  `updater_install`, `updater_close`.
- **Tray menu** (`build_tray` in `lib.rs`) is the manual entry point, precisely
  because the loopback panel cannot invoke commands.
- Single-flight guard: a check and an install can never overlap.

## Release channel — LIVE

- **Code:** `primebuildfit-lab/partnera` (private).
- **Releases:** `primebuildfit-lab/partnera-releases` (**public — required**: the
  updater downloads unauthenticated and cannot read private release assets).
- **Clients poll:** `partnera-internal-channel-stable` → `internal-latest.json`.
  NOT `releases/latest/download/` — several products share that repo, so
  "latest" is whichever product shipped most recently.
- CI bakes owner/repo in via `PARTNERA_UPDATE_OWNER` / `PARTNERA_UPDATE_REPO`.
  A build without them keeps the `REPLACE_*` sentinels and reports
  "no configurado" rather than polling a dead URL — do not "fix" them by hand.
- `PARTNERA_UPDATE_ENDPOINT` overrides at runtime (used for local tests).

Verified end-to-end over HTTPS: an installed 0.2.1 updated itself to the
published 0.2.2 straight from GitHub, relaunched, and kept its local data.

## Signing
- Public key: `src-tauri/tauri.conf.json → plugins.updater.pubkey`.
- Private key: `C:\Users\carlo\.partnera\updater.key` — **outside the repo**,
  git-ignored, no password. Keep an offline backup: losing it means no existing
  install can ever be updated again.
- Verified: the committed public key matches this private key.

## Building signed artifacts
`createUpdaterArtifacts` lives in the CI overlay `tauri.conf.release.json`
(merged with `--config`), so a plain local `pnpm desktop:build` stays keyless:

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.partnera/updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
pnpm desktop:build:signed
```
Produces `*-setup.exe`, `*-setup.nsis.zip` and `*-setup.nsis.zip.sig`.

## Verifying the updater locally (no GitHub needed)
`scripts/local-update-channel.mjs` serves the freshly built, freshly signed
artifacts as a real Tauri channel:

```bash
pnpm update:channel                 # serves latest.json + payload on :8787
pnpm update:channel -- --tamper     # corrupts the payload, keeps the signature
```
Then launch the *installed older build* with
`PARTNERA_UPDATE_ENDPOINT=http://127.0.0.1:8787/latest.json`.
The `--tamper` run must fail signature verification and leave the install intact.

Tauri **refuses plain-HTTP updater endpoints** (`The configured updater endpoint
must use a secure protocol like https`). The loopback channel above is therefore
only reachable by a build made with the test overlay
`src-tauri/tauri.conf.e2e.json`, which sets
`plugins.updater.dangerousInsecureTransportProtocol`:

```bash
pnpm exec tauri build --config src-tauri/tauri.conf.e2e.json
```

That flag exists **only** in the E2E overlay — never in `tauri.conf.json` and
never in the CI release overlay, so shipped builds can only ever fetch updates
over HTTPS. Everything else in the flow (manifest parsing, version comparison,
download, minisign verification, NSIS install, restart) is identical between the
E2E build and a release build.

`PARTNERA_UPDATE_UNATTENDED=1` additionally skips the consent click, so the whole
download → verify → install → restart chain can be driven without a human. It is
a **verification seam only** — off unless explicitly set, and logged as
`updater.unattended` when used. Never set it in a real deployment: consent before
install is the point.

## Publish a release
Secrets are already set (`PARTNERA_INTERNAL_SIGNING_KEY`, `PARTNERA_RELEASES_TOKEN`).
One step:

1. Bump the version in **all three** of `package.json`, `src-tauri/Cargo.toml`
   and `src-tauri/tauri.conf.json`, then commit. (CI refuses a tag that
   disagrees with them.)
2. `git tag partnera-internal-vX.Y.Z && git push origin partnera-internal-vX.Y.Z`

`release-partnera-internal.yml` then builds, signs, publishes the immutable
versioned release, repoints the rolling channel, and verifies the manifest is
publicly reachable. Installed clients pick it up on their next launch.

## Tags
`partnera-internal-vX.Y.Z` (exclusive). A different Partnera Tauri app must get
its OWN key, workflow and tag prefix — never share a manifest between products.

## Data safety
Local data lives in the app data dir (`data.json`, `logs/`), which the NSIS
installer does not touch. Updating preserves it. Verified end-to-end.

## Rollback
Tauri has no automatic downgrade. The real safety net is that a failed
verification installs **nothing**, so a bad package cannot break a working
install. To undo a bad *published* release, publish a higher version carrying
the previous good payload.

## Diagnostics
- Desktop log: app data dir `logs/desktop.log` (secret-free). Every updater
  outcome is logged: `updater.up_to_date`, `updater.available`,
  `updater.download_start`, `updater.download_done`, `updater.installed`,
  `updater.not_configured`, `updater.error stage=… detail=…`.
- Tray → **Abrir registro** opens that folder.
