# Partnera Internal OS — Desktop Build

## Prerequisites (verified on the build machine)

| Tool | Required | Notes |
| --- | --- | --- |
| Node.js | ≥ 20 (built with 24.x) | also bundled into the installer as the runtime |
| pnpm | 9.15.x | monorepo package manager |
| Rust + Cargo | stable `x86_64-pc-windows-msvc` | `~/.cargo/bin` must be on PATH |
| VS Build Tools 2022 | "Desktop development with C++" (VC.Tools.x86.x64) | MSVC linker for Rust |
| WebView2 Runtime | present on Windows 10/11 | the app renders in WebView2 |
| Git | any recent | — |

> On this machine cargo is installed but **not on the default shell PATH**. Prefix the
> build with `export PATH="$HOME/.cargo/bin:$PATH"` (bash) or prepend
> `$env:USERPROFILE\.cargo\bin` to `$env:PATH` (PowerShell).

## Layout

```
apps/internal-desktop/
├── package.json          # scripts below
├── scripts/copy-node.mjs # copies node.exe → src-tauri/resources/
├── ui/index.html         # splash / error screen (frontendDist)
└── src-tauri/
    ├── Cargo.toml, build.rs, tauri.conf.json
    ├── capabilities/default.json
    ├── icons/            # committed, generated from the brand PNG
    ├── resources/        # gitignored: node.exe + server.cjs (staged at build)
    └── src/{main.rs, lib.rs}
```

## Scripts

| Script | Does |
| --- | --- |
| `pnpm bundle:server` | esbuild-bundles `packages/web/src/server.ts` → `src-tauri/resources/server.cjs` (CJS, React inlined, `pg` external) |
| `pnpm prepare:node` | copies the building `node.exe` → `src-tauri/resources/node.exe` (override with `PARTNERA_NODE_EXE`) |
| `pnpm prepare:runtime` | runs both of the above (also runs automatically via `beforeBuildCommand`) |
| `pnpm desktop:dev` | stage runtime + `tauri dev` |
| `pnpm desktop:build` | stage runtime + `tauri build` → installer |

## Build

```bash
cd apps/internal-desktop
export PATH="$HOME/.cargo/bin:$PATH"
pnpm install            # once, from repo root
pnpm exec tauri build   # beforeBuildCommand stages resources automatically
```

Output installer:

```
apps/internal-desktop/src-tauri/target/release/bundle/nsis/Partnera Internal OS_0.1.0_x64-setup.exe
```

The standalone app executable is `target/release/Partnera Internal OS.exe` (needs the
`resources/` folder next to it; the installer wires this up).

## Why CommonJS for the runtime bundle

`react-dom`'s server renderer does a dynamic `require("stream")`. esbuild's **ESM**
output cannot satisfy dynamic requires of Node built-ins ("Dynamic require … is not
supported"). Emitting **CJS** (`server.cjs`) lets `require` resolve built-ins natively,
so the bundle runs under plain `node.exe` with no external `node_modules`.

## Regenerating icons

```bash
cd apps/internal-desktop
pnpm exec tauri icon <source-512.png> -o src-tauri/icons
```

The current icons were generated from the Partnera brand icon extracted from
`packages/web/src/brand-icon.ts`.

## Adding signing / auto-update later (not in this pilot)

1. **Code signing** — obtain an EV/OV cert; set `bundle.windows.certificateThumbprint`
   (and `signCommand`/`timestampUrl`) in `tauri.conf.json`. Removes the "Unknown
   publisher" SmartScreen warning.
2. **Updater** — add `@tauri-apps/plugin-updater`, host a signed `latest.json` on an
   internal channel, and gate rollout to employees. Keep it an **internal** channel; no
   public auto-update for this pilot.
3. **MSI** — add `"msi"` to `bundle.targets` (WiX). NSIS `.exe` is the primary target.
