# @partnera/internal-desktop

Windows desktop wrapper (**Tauri 2**) for the **Partnera Internal OS** — the private
platform-operations console. **Packaging only:** it runs the existing web host
(`packages/web`) on loopback and loads the `/internal` route tree. No redesign, no
economy/Revenue/Vault/commission/payment changes, no changes to the public portals.

## Quick start

```bash
# from the repo root, once:
pnpm install

# dev (spawns the runtime, opens the window):
cd apps/internal-desktop
export PATH="$HOME/.cargo/bin:$PATH"   # cargo lives here on this machine
pnpm desktop:dev

# build the installer:
pnpm desktop:build
# → src-tauri/target/release/bundle/nsis/Partnera Internal OS_0.1.0_x64-setup.exe
```

## How it works

Tauri picks a free `127.0.0.1` port, spawns a **bundled** `node.exe` running
`resources/server.cjs` (an esbuild CJS bundle of `packages/web/src/server.ts`), waits for
`/ready`, then navigates the window to `/desktop` (Internal OS sign-in, platform
operators only). The runtime is killed on exit.

## Docs

See `docs/desktop/` at the repo root: architecture, security, financial safety, build,
Windows installation, and the pilot report.
