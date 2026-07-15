# Partnera Internal OS — Desktop (Tauri 2) Architecture

**Scope:** desktop *packaging only* of the existing **Partnera Internal OS** (the private
platform-operations console). No redesign, no new features, no changes to Revenue,
Vault, commissions, plans, billing, AI, or integrations. Public portals (Business,
Creator, Affiliate) are untouched.

## 1. What the Internal OS is (audited)

The Internal OS is **not** a standalone app in the monorepo. It is the `/internal`
route tree inside the existing web package:

| Item | Value |
| --- | --- |
| Workspace | `packages/web` (`@partnera/web`) |
| Framework | Custom Node HTTP host (`node:http`) rendering React server-side — **no** Next.js/Vite |
| Entry (local) | `packages/web/src/server.ts` |
| Entry (prod) | `packages/web/deploy/server-prod.ts` (Postgres; unchanged, not used by desktop) |
| Internal OS page | `packages/web/src/pages/internal.tsx` (`renderInternal`, `internalAccessDenied`) |
| Router / guard | `packages/web/src/app.tsx` — `scope === "internal"` requires `ctx.session.isPlatformOperator` (deny-by-default) |
| Routes | `/internal` (home), `/internal/companies`, `/internal/finance/revenue`, `/internal/finance/vault`, `/internal/alerts`, `/internal/health`, + placeholders |
| Auth | Cookie session `pt_session`, `InMemorySessionStore`, roles resolved per request |
| Data (local) | JSON world at `PARTNERA_DATA` (default `./.partnera/data.json`) |
| Health / ready | `GET /health`, `GET /ready` (public, no secrets) |
| Default port | `PORT` (4000) |

Because the host is a real Node server (server-side render + session store +
persistence), a static export is impossible. The desktop therefore uses a
**local runtime** composition (Option B).

## 2. Composition (Option B — local runtime)

```
Partnera Internal OS.exe  (Tauri 2 / WebView2)
  └─ splash window (ui/index.html, tauri:// origin, privileged)
       │  1. reserve a free 127.0.0.1 port
       │  2. spawn bundled Node runtime:  node.exe  resources/server.cjs
       │        PORT=<free>  PARTNERA_HOST=127.0.0.1  PARTNERA_DATA=<appdata>/data.json
       │  3. poll GET /ready until {"ready":true}
       │  4. window.navigate → http://127.0.0.1:<port>/desktop
       ▼
  Internal OS (http://127.0.0.1 origin, UNPRIVILEGED — no Tauri IPC)
       └─ /desktop → sign in (scope=internal) → /internal … all existing routes
  on exit: child runtime is killed (RunEvent::Exit)
```

- **Loopback only.** `server.ts` now binds `PARTNERA_HOST ?? "127.0.0.1"` — never the LAN.
- **Self-contained.** `node.exe` (~88 MB) and `server.cjs` (esbuild CJS bundle of
  `server.ts`, React inlined) ship as Tauri **resources**. The target machine does
  **not** need Node installed.
- **The runtime is spawned from Rust** with `std::process::Command` (+ `CREATE_NO_WINDOW`
  so no console flashes). No shell plugin, so no `shell:*` capability is exposed.

## 3. The `/desktop` entry (only shared-code change of substance)

`server.ts` gained a desktop-only `GET /desktop` route that renders a minimal
Internal-OS sign-in which posts `scope=internal`. This lets a platform operator land
directly in the Internal OS. It is **isolated in `server.ts`** — the shared web login
(`pages/login.tsx`) and every public portal are unchanged. It grants no privilege: the
`/internal` guard still enforces `isPlatformOperator`, so a business/creator/affiliate
identity submitted at `/desktop` is rejected at `/internal` (deny-by-default).

## 4. Why a separate `apps/internal-desktop` workspace

The monorepo had no `apps/*` yet, and the Internal OS is a *route* inside the shared
web server, not a standalone frontend. A dedicated wrapper workspace keeps all
desktop-only code (Rust crate, Tauri config, runtime staging) out of `packages/web`,
minimizing conflicts with concurrent work on the web app. `pnpm-workspace.yaml`
already globs `apps/*`.

```
apps/internal-desktop/
├── package.json            # scripts: bundle:server, prepare:node, desktop:dev/build
├── scripts/copy-node.mjs   # stages node.exe into resources
├── ui/index.html           # splash + error/retry screen (frontendDist)
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json
    ├── capabilities/default.json   # minimal: core:default only
    ├── icons/                       # generated from the Partnera brand PNG
    ├── resources/  (gitignored)     # node.exe + server.cjs, regenerated
    └── src/{main.rs, lib.rs}         # runtime supervisor
```

## 5. Data & services

The desktop consumes the **same** application/services/persistence code as the web
host — it literally runs `server.ts`. In local mode the source of truth is the JSON
world under the per-user app-data dir. For a real deployment the same window can point
at the Postgres-backed host (`server-prod.ts`) unchanged; no database is duplicated and
no financial logic is altered. See `PARTNERA_ADMIN_FINANCIAL_SAFETY.md`.

## 6. Identity

| Field | Value |
| --- | --- |
| Product name | `Partnera Internal OS` |
| Window title | `Partnera Internal OS` |
| Bundle identifier | `com.partnera.internal` |
| Icon | generated from the existing Partnera brand icon (`packages/web/src/brand-icon.ts`) |

Replaceable from one place: regenerate `src-tauri/icons/` from a single source PNG via
`pnpm exec tauri icon <png>`.
