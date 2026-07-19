# @partnera/internal-desktop

Windows desktop wrapper (**Tauri 2**) for the **Partnera Internal OS** — the private
platform-operations console. **Packaging only:** it runs the existing web host
(`packages/web`) on loopback and loads the `/internal` route tree. No redesign, no
economy/Revenue/Vault/commission/payment changes, no changes to the public portals.

> **This is a labeled local demo build.** The Internal OS runs on a seeded local
> world (JSON file, `dev-insecure` auth) — every screen is honestly labeled
> _simulado / mock / local demo_. There is no external backend wired into the
> desktop app. The environment chip reads **"Local demo"**, never "Production".

## Quick start

```bash
# from the repo root, once:
pnpm install

# dev (spawns the runtime, opens the window):
cd apps/internal-desktop
export PATH="$HOME/.cargo/bin:$PATH"   # cargo lives here on this machine
pnpm desktop:dev
```

## Release — one command, full chain

```bash
# from the repo root:
pnpm partnera:desktop:release
# (or: cd apps/internal-desktop && pnpm desktop:release)
```

`desktop:release` enforces the correct order and **fails fast** — Tauri can never be
packaged on a stale frontend or a red gate:

```
clean → typecheck → lint → test → desktop:build → verify installer
                                     │
        desktop:build = prepare:runtime (build-info → bundle server →
        copy node → validate-runtime) → tauri build → NSIS installer
```

On success it prints the verifiable artifact identity (version, build id, commit,
installer path, size, **sha256**). The output installer is:

```
src-tauri/target/release/bundle/nsis/Partnera Internal OS_<version>_x64-setup.exe
```

## Build identity — how to tell which build is running

Every build stamps `src-tauri/resources/build-info.json` (version + git commit +
build time + a unique `buildId`) **into the bundle**. That descriptor is the single
source of "which build is this?":

- **In the app:** Internal OS → _Salud del sistema_ → **Diagnóstico de compilación**
  shows version, build id, commit, compile time, environment, platform, persistence.
- **In the boot log:** `%APPDATA%/com.partnera.internal/logs/desktop.log` records
  `boot.spawn … build=<buildId>` on every launch.
- **In `/health`:** the JSON includes the full `build` object.

Because the `buildId` embeds the short commit + compile timestamp, two different
builds can never look identical — the previous "everything says 0.1.0" ambiguity is
gone.

### Single source of version truth

`src-tauri/tauri.conf.json` `version` is authoritative. `gen-build-info.mjs` reads it
and `validate-runtime.mjs` fails the build if `build-info.json` disagrees with it.
**Bump the version in `tauri.conf.json`** (and keep `Cargo.toml` + `package.json` in
step) for each release.

## Why an "old build" could appear (root cause + fix)

The build pipeline already regenerated `server.cjs` on every build, so the *content*
was not actually stale — but **nothing proved it**: the version was a hand-typed
`0.1.0` that never changed, and no commit/date/build-id was shown anywhere. Every
build looked identical, so a genuinely-updated app was indistinguishable from an old
one. Fixed by: (1) a stamped, verifiable build identity surfaced in-app + logs +
`/health`; (2) a `validate-runtime` gate that aborts the build if the bundled
`server.cjs`/`node.exe`/`build-info.json` are missing, too small, or version-mismatched;
(3) a `clean` step that deletes old installers so a stale `setup.exe` can't be shipped.

## How it works

Tauri picks a free `127.0.0.1` port, spawns a **bundled** `node.exe` running
`resources/server.cjs` (an esbuild CJS bundle of `packages/web/src/server.ts`), waits for
`/ready`, then navigates the window to `/desktop` (Internal OS sign-in, platform
operators only). The runtime is killed on exit.

## Update / rollback

- **Update:** run `pnpm partnera:desktop:release`, then run the new
  `…_<version>_x64-setup.exe`. NSIS installs per-user with a stable identifier
  (`com.partnera.internal`) and `installMode: currentUser`, so a new version
  **replaces** the previous install (same product name + identifier) rather than
  creating a parallel copy. Confirm the new build via the Diagnóstico panel.
- **Rollback:** re-run the installer built from the previous tagged commit (check out
  that commit, `pnpm partnera:desktop:release`). Local user data in
  `%APPDATA%/com.partnera.internal` is preserved across versions.
- **Auto-update:** not configured. The Tauri updater plugin is intentionally absent —
  there is no update server, signing key, or manifest. See “Pending” below.

## Pending / not implemented (honest gaps)

- **Auto-update pipeline** — needs an update server/endpoint, a generated signing
  keypair (private key kept out of the repo), a `latest.json` manifest, and the
  `tauri-plugin-updater` wired in. Not started.
- **Real backend** — the desktop runs the seeded local demo world; connecting it to a
  hosted Postgres/API is a separate activation (see `deploy/server-prod.ts`, which is
  the **live** hosted path and must not be changed casually).

## Docs

See `docs/desktop/` at the repo root: architecture, security, financial safety, build,
Windows installation, and the pilot report.
