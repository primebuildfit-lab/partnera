# Partnera Internal OS — automatic updates (desktop)

The `apps/internal-desktop` Tauri 2 app updates itself: on launch it checks a
signed release manifest, and if a newer version exists it downloads it, verifies
the minisign signature, installs it, and relaunches. A tampered/unsigned package
is rejected and the working install is left intact.

## Architecture
- **Rust-driven** (`src-tauri/src/updater.rs`): `spawn_startup_check` runs a
  non-blocking check after launch; never gates the local-runtime boot. The web
  content (admin panel on loopback) gets NO IPC — no new capability needed.
- Plugin: `tauri-plugin-updater` v2, registered in `src/lib.rs`.

## Release channel — REQUIRES A REMOTE (human step)
- This repo has **no GitHub remote yet**. The updater degrades honestly
  ("no configurado") until one exists.
- **Suggested repo:** a dedicated `partnera-desktop` (or the future Partnera repo).
- Endpoint is built from CI env `PARTNERA_UPDATE_OWNER/REPO` (set automatically
  from the repo by the workflow). Tag prefix keeps it product-scoped.

## Signing
- Public key: `src-tauri/tauri.conf.json → plugins.updater.pubkey` (production).
- Private key: `C:\Users\carlo\.partnera\updater.key` — **outside the repo**,
  git-ignored (`.partnera/`), **no password**. Keep an offline backup.

## Tags
`partnera-internal-vX.Y.Z` (exclusive). If a separate **Partnera Operations**
Tauri app is ever added, give it its OWN key, workflow, and `partnera-operations-v*`
tag/channel — never share a manifest between two products. (Today only Internal OS
exists as a Tauri app.)

## Publish a release
1. Create/attach the GitHub remote and push the branch.
2. Add repo secret `TAURI_SIGNING_PRIVATE_KEY` = full contents of
   `C:\Users\carlo\.partnera\updater.key` (no password secret needed).
3. `git tag partnera-internal-v0.2.1 && git push origin partnera-internal-v0.2.1`
4. The `release-partnera-internal` workflow builds the app (bundled Node runtime),
   signs the updater artifacts (CI overlay `tauri.conf.release.json`), and
   publishes a GitHub Release with the installer, `.sig`, and `latest.json`.

## First install
The current build has no updater — install the first workflow-published release
by hand; later releases auto-update.

## Rollback
Publish a higher version carrying the previous good payload, or unset "latest" on
a bad release. No automatic downgrade.

## Artifact paths (CI)
`apps/internal-desktop/src-tauri/target/release/bundle/nsis/*-setup.exe`,
`*-setup.nsis.zip`, `*-setup.nsis.zip.sig`, `latest.json`.

## Diagnostics & common errors
- Desktop log: app data dir `.../logs/desktop.log` (secret-free).
- "No configurado": no remote/owner-repo yet (expected until the repo exists).
- Signature error: release signed with a key not matching the config pubkey.
- Offline: endpoint unreachable; app stays on the current version.
