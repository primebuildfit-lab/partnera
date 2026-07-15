# Partnera Internal OS — Windows Desktop Pilot Report

**Classification:** `PARTNERA INTERNAL OS DESKTOP PILOT COMPLETED`
**Date:** 2026-07-15 · **Branch:** `feat/partnera-admin-tauri` (local only; no push/merge)

## 1. Audited path
`D:\Partnera` — the Partnera monorepo (pnpm + turbo, 22 workspaces).

## 2. Real Internal OS workspace
The Internal OS is **not** a standalone app; it is the `/internal` route tree inside
`packages/web` (`@partnera/web`), rendered by `packages/web/src/pages/internal.tsx`
and guarded in `packages/web/src/app.tsx` (`scope === "internal"` ⇒ requires
`isPlatformOperator`). There was no `apps/*` directory before this work.

## 3. Baseline (before changes)
Tests **241 passed** (33 files) · `typecheck:clean` **0 errors** · lint **0 errors, 3
pre-existing warnings** (unused eslint-disable in `server.ts`) · web bundle OK.

## 4. Branch
`feat/partnera-admin-tauri`, created off `feat/creator-marketplace` to isolate from a
concurrent agent's uncommitted Phase-9 UI work.

## 5. Git state
A second agent had uncommitted edits to `packages/ui/*`, `packages/web/src/{app,nav,
shell,components,render,business}.*`, and root `CHANGELOG/ARCHITECTURE/BUILD_STATUS`.
Those files were **not touched**. My changes are confined to new files plus two
minimal, clean shared edits (`packages/web/src/server.ts`, `eslint.config.mjs`, and a
one-line `.env.example` addition).

## 6. Framework
Custom Node `http` host rendering React server-side (no Next/Vite). Local entry
`packages/web/src/server.ts`; prod entry `deploy/server-prod.ts` (Postgres, untouched).

## 7. Architecture chosen — **Option B (local runtime)**
A static export is impossible (server-side render + session store + persistence), so
Tauri spawns the existing Node host on loopback and loads it in the window. See
`PARTNERA_ADMIN_TAURI_ARCHITECTURE.md`.

## 8. Prerequisites (verified, not assumed)
Node 24.18 ✓ · pnpm 9.15.9 ✓ · Rust 1.97 (`x86_64-pc-windows-msvc`) ✓ · Cargo ✓
(in `~/.cargo/bin`, not on default PATH) · VS Build Tools 2022 + VC.Tools.x86.x64 ✓ ·
WebView2 Runtime 150.x ✓ · Git 2.54 ✓. **No blocking prerequisite.**

## 9. Tauri added
Tauri 2 (`tauri` 2.11, CLI 2.11.4) in a new workspace `apps/internal-desktop` wrapping
the existing web host. Plugins: `window-state`, `opener`.

## 10. Configuration
`src-tauri/tauri.conf.json`: product `Partnera Internal OS`, id `com.partnera.internal`,
`withGlobalTauri` (splash only), `frontendDist: ../ui`, `beforeBuildCommand:
pnpm prepare:runtime`, NSIS per-user installer, `resources/*` bundled.

## 11. Window
1540×960, min 1180×720, resizable, maximizable, not fullscreen, centered on first run.
Size/position/maximized remembered via `tauri-plugin-window-state`.

## 12. Runtime
Rust supervisor (`src-tauri/src/lib.rs`): reserve free `127.0.0.1:0` port → spawn bundled
`node.exe resources/server.cjs` (cwd = resources dir; `CREATE_NO_WINDOW`; stdio →
`runtime.log`) → poll `/ready` (≤30 s) → `window.navigate` to `/desktop` → kill child on
`RunEvent::Exit`.

## 13. Connections
Same services/persistence as the web host (it literally runs `server.ts`). Local mode
uses the JSON world in the per-user app-data dir; the same window can point at the
Postgres host unchanged. No DB duplicated, no wallet duplicated.

## 14. Authentication
Unchanged. `/desktop` pre-selects `scope=internal`; the `/internal` guard still enforces
`isPlatformOperator`. No auto-login from being installed.

## 15. Permissions
Deny-by-default preserved: business/creator/affiliate identities are rejected at
`/internal` (HTTP 403 "Access denied") — verified.

## 16. Security
Capabilities = `core:default` only. No `fs/shell/http/process` exposed to web content;
the loopback origin gets no Tauri IPC. External links → allowlist → system browser.
See `PARTNERA_ADMIN_DESKTOP_SECURITY.md`.

## 17. Revenue
`/internal/finance/revenue` renders unchanged (Bank A). Verified HTTP 200 + distinct.

## 18. Vault
`/internal/finance/vault` renders unchanged (Bank B). Verified HTTP 200 + distinct.

## 19. Financial protection
No frontend balance computation, no ledger edits, no new financial endpoints, no real
money. See `PARTNERA_ADMIN_FINANCIAL_SAFETY.md`.

## 20. External links
Allowlist (Rust `on_navigation`): shopify.com, myshopify.com, admin.shopify.com,
railway.app, up.railway.app, supabase.com, supabase.co, github.com, primebuildfit.com.
Non-loopback URLs never load in-window; allowlisted hosts open in the default browser.

## 21. Nexus deep-link protocol
**Designed & documented; not registered in this pilot** (Block 12 conditional). Proposed
scheme `partnera-admin://<path>` with a validated path allowlist — see below.

## 22. Logs
`%APPDATA%\com.partnera.internal\logs\{desktop.log, runtime.log}`. Secret-free.
"Open logs" button on the splash error state opens the folder.

## 23. Local storage
Window geometry, local world JSON, secret-free logs. No unencrypted balances/tokens/PII.

## 24. Error states
Splash shows staged progress; on failure a titled error + **Retry** + **Open logs**.
Failure categories: `runtime_missing`, `spawn_failed`, `child_exited`, `not_ready`.

## 25. Installer generated
NSIS `.exe` (per-user). MSI not enabled (documented how to add).

## 26. Exact path
`apps/internal-desktop/src-tauri/target/release/bundle/nsis/Partnera Internal OS_0.1.0_x64-setup.exe`

## 27. Size
Installer ≈ **24.5 MB** (LZMA-compressed; bundles the ~88 MB Node runtime). App exe 3.3 MB.

## 28. Typecheck
`typecheck:clean` → **0 errors** (after changes).

## 29. Lint
`eslint .` → **0 errors**, 3 pre-existing warnings (unchanged).

## 30. Tests
`vitest run` → **241 passed** (unchanged by these changes).

## 31. Web build
`@partnera/web` bundle OK; desktop CJS bundle (`server.cjs`) runs standalone under Node.

## 32. Tauri build
`cargo` release + NSIS bundle → exit 0.

## 33. Installation
Per-user NSIS installer; Start-menu entry + optional desktop shortcut + uninstaller.

## 34. Reopen
Runtime spawns per launch; window state restored; session re-established at `/desktop`
(in-memory session store resets across full restarts — documented).

## 35. Public portals not modified
Business/Creator/Affiliate portals untouched; `/business` verified HTTP 200. The only
shared edits are the isolated `/desktop` route + loopback bind in `server.ts`.

## 36. Files changed
**New:** `apps/internal-desktop/**`, `docs/desktop/**`.
**Edited (minimal, clean):** `packages/web/src/server.ts`, `eslint.config.mjs`,
`.env.example`.

## 37. Local commits
See §Commits in the build/report; local only, no push/merge.

## 38. Limitations
- Unsigned installer → SmartScreen "Unknown publisher" (expected; pilot).
- Sessions reset on full app restart (in-memory store; no auth change made).
- Deep-link protocol prepared but not OS-registered.
- Node runtime bundled (~88 MB) → larger install; self-contained by design.
- Orphaned-runtime safety relies on `RunEvent::Exit` kill (no Windows Job Object yet).

## 39. Next steps
Code signing + updater (internal channel), optional MSI target, register
`partnera-admin://` with single-instance handling, wire Shopify session-token SSO,
optional Windows Job Object for hard-kill safety.

## 40. Final classification
`PARTNERA INTERNAL OS DESKTOP PILOT COMPLETED`.

---

## Appendix — `partnera-admin://` deep-link design (prepared, not registered)

Format: `partnera-admin://<path>` where `<path>` is validated against an allowlist and
mapped to `/internal/<path>` **only after** the window is authenticated (deny-by-default;
never navigate to arbitrary admin routes from a link):

| Deep link | Internal route |
| --- | --- |
| `partnera-admin://companies` | `/internal/companies` |
| `partnera-admin://creators` | `/internal/creators` |
| `partnera-admin://finance/revenue` | `/internal/finance/revenue` |
| `partnera-admin://finance/vault` | `/internal/finance/vault` |
| `partnera-admin://system/health` | `/internal/health` |

To enable later: add `tauri-plugin-deep-link` + `tauri-plugin-single-instance`, register
the scheme in the NSIS installer, and validate the incoming path against the table above
before `window.navigate`. Nexus itself is **not** modified.
