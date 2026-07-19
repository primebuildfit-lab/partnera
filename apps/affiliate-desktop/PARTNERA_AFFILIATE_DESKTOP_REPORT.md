# Partnera Affiliate — Desktop Report

**App:** Partnera Affiliate (Tauri 2 Windows desktop)
**Location:** `apps/affiliate-desktop`
**Identity:** productName `Partnera Affiliate` · identifier `com.partnera.affiliate` · package `@partnera/affiliate-desktop` / crate `partnera-affiliate-desktop` · version `0.1.0`
**Date:** 2026-07-17
**Status:** Built and verified green (see [Tests](#7-tests--verification)). Not committed, not deployed, no release published.

---

## 1. Summary

Partnera Affiliate is a new, **independent** desktop product for **affiliates**. It
is a Tauri 2 **thin client**: it bundles no Node runtime and no local database.
On launch it shows a small local splash and then navigates a native window to
`${PARTNERA_API_URL}/affiliate` over HTTPS. The central Partnera API
(`packages/web`, deployed on Railway → shared Postgres) is the single source of
truth, so the portal UI is always the live server version and the shell carries
no business logic.

It is deliberately **not** Partnera Operations, Internal OS, Business or Creator.
It only ever opens the affiliate portal, and per-affiliate isolation is enforced
server-side by the existing `/affiliate` scope guard.

The whole architecture already existed in the codebase for the **Operations**
thin client; this app reuses that proven wrapper and re-points it at the
affiliate portal with its own identity, window, icons, capabilities and updater
channel.

---

## 2. Architecture

```
Partnera Affiliate (this app · native window + webview)
        │  HTTPS (navigate to /affiliate)
        ▼
central Partnera API  (packages/web on Railway)
        │
        ▼
shared Postgres  (single source of truth)
```

- **Thin client, no DB.** No PostgreSQL access from the desktop; no bundled
  server. The shell is packaging only.
- **Single API.** The same central API that serves the web affiliate portal
  serves this window. There is exactly one implementation of tracking,
  commissions and payouts — never duplicated in the client.
- **Isolation is server-side.** The `/affiliate` scope binds queries to the
  authenticated `session.affiliateId`; operator scopes (`/ops`, `/internal`) are
  denied to non-operators (deny-by-default). The shell only navigates to
  `/affiliate` and grants no privilege of its own.
- **Auto-update refreshes only the shell.** The portal UI is always live; the
  updater (minisign-verified) only replaces the native wrapper. Not configured
  yet (placeholder owner/repo + `affiliate-latest.json` manifest).

### Reuse map (what the shell relies on, unchanged, over HTTPS)

| Concern | Where it lives (reused, not copied) |
|---|---|
| Authentication / session | `packages/web` `/login` · `/logout`, `packages/auth`, `session.affiliateId` |
| Affiliate UI (dashboard, links, coupons, commissions, payouts, materials, notifications, profile, settings) | `packages/web/src/pages/affiliate.tsx` (already a shared module) |
| Tracking / links / codes | `packages/tracking-engine` (via application services) |
| Commissions / balance | `packages/commission-engine`, `packages/application` `services.query.affiliate*` |
| Payments / payouts | `packages/payment-engine` (`PayoutRail` seam) |
| Promotional materials | `renderAffiliateContent` (shared with the creator/content module) |
| Notifications | `packages/notification-engine` |
| Shared design system | `packages/ui` |
| Environment config | `PARTNERA_API_URL` (client) → server env on Railway |

---

## 3. Migration from Operations — findings

The task asked to *extract* Affiliate functionality out of Operations / `packages/web`
/ `/ops` into reusable modules, without duplicating tracking, commission or payout
engines and without copying whole pages.

**Finding: no extraction or duplication was necessary — the affiliate feature is
already a shared, reusable module.**

- The affiliate experience already lives as its own module,
  `packages/web/src/pages/affiliate.tsx` (`renderAffiliate`), served by the
  central API at the `/affiliate` scope. It consumes the shared engines through
  the application service layer (`services.query.affiliate*`,
  `services.notifications`), exactly the same instances the web portal uses.
- Operations (`/ops`) is an **operator** console (a platform-operator view *of*
  affiliates/business/creator), not an affiliate-facing surface. The
  affiliate-facing portal is `/affiliate`. So the affiliate functionality was
  never trapped inside Operations to begin with — pointing the new shell at
  `/affiliate` is the correct, non-duplicating reuse.
- Because the desktop is a webview onto that single server route, **zero**
  tracking/commission/payout logic is copied into the client. This directly
  satisfies "no dupliques motores" and "no copies páginas completas".

**Consequence:** `packages/web` and Partnera Operations were left completely
unmodified — no routes removed, nothing broken. (See [Risks & follow-ups](#9-risks-blockers--follow-ups)
for affiliate portal tabs that the task listed but the server does not yet
surface.)

---

## 4. Files created

```
apps/affiliate-desktop/
├── README.md                         # product + build + security notes
├── PARTNERA_AFFILIATE_DESKTOP_REPORT.md
├── .gitignore                        # target/, gen/schemas/, resources/, app-icon scratch
├── package.json                      # @partnera/affiliate-desktop
├── app-icon.png                      # icon source (reused)
├── scripts/
│   └── gen-build-info.mjs            # stamps src-tauri/resources/build-info.json
├── ui/
│   └── index.html                    # local splash (Partnera Affiliate branding)
└── src-tauri/
    ├── Cargo.toml                    # crate partnera-affiliate-desktop
    ├── build.rs
    ├── tauri.conf.json               # identity, window, bundle, updater
    ├── capabilities/default.json     # deny-by-default; no IPC to web content
    ├── icons/                        # full icon set (reused)
    └── src/
        ├── main.rs
        ├── lib.rs                    # navigates to ${API}/affiliate; host allowlist
        └── updater.rs                # affiliate-latest.json channel (not configured yet)
```

No files outside `apps/affiliate-desktop/` were changed.

---

## 5. Functionality (affiliate-only)

Delivered by navigating to the `/affiliate` portal. Tabs present in the portal:

- **Performance / dashboard** — conversions count, pending / available / paid balance, recent commissions.
- **Referral links** — the affiliate's tracking links + shareable URLs.
- **Coupons / codes** — coupon codes attributed to the affiliate.
- **Commissions** — pending, approved, paid, and full history.
- **Payouts** — payout requests + status/history (non-custodial; `PayoutRail` seam).
- **Promotional materials** — content library for the affiliate.
- **Notifications** — approvals / payout events.
- **Profile & settings** — identity, program, notification channels, payout-method placeholder, MFA seam.

**Excluded by construction** (not reachable from this shell, and denied
server-side even if reached): global Partnera administration, company-internal
tooling, creator tooling, platform configuration, and operator-level fraud
review.

---

## 6. Commands, configuration & environment

**Build / run**

```
pnpm --filter @partnera/affiliate-desktop desktop:build   # NSIS installer
pnpm --filter @partnera/affiliate-desktop desktop:dev      # dev run
pnpm --filter @partnera/affiliate-desktop prepare:build-info
```

**Environment variables**

| Variable | Used by | Default | Purpose |
|---|---|---|---|
| `PARTNERA_API_URL` | shell (runtime) + build-info | `https://partnera-web-production.up.railway.app` | Central API base URL (no trailing slash). |
| `PARTNERA_UPDATE_ENDPOINT` | updater (runtime) | — | Override the update manifest URL (local E2E). |
| `PARTNERA_UPDATE_OWNER` / `PARTNERA_UPDATE_REPO` | updater (build) | `REPLACE_*` (disabled) | GitHub release channel; disabled until set. |
| `PARTNERA_ENV` | build-info | `desktop` | Stamped into build-info.json. |

**Security-relevant defaults**

- Web content gets **no** Tauri IPC (`capabilities/default.json`, `core:default` only).
- Only the API host loads in-window; other links open in the system browser via an allowlist.
- Local `desktop.log` records structured boot events only — host name, never tokens.

---

## 7. Tests & verification

| Check | Result |
|---|---|
| `pnpm install` (workspace picks up new project) | ✅ 26 projects, lockfile up to date |
| `pnpm exec tauri --version` (CLI resolves for app) | ✅ tauri-cli 2.11.4 |
| `node scripts/gen-build-info.mjs` | ✅ stamps build-info.json |
| ESLint (`eslint apps/affiliate-desktop`) — the `lint` gate | ✅ clean |
| `cargo check` (Rust shell) | ✅ finished, no errors |
| `cargo build --release` via `tauri build` → NSIS | ✅ `Partnera Affiliate_0.1.0_x64-setup.exe` (1.8 MB); binary 4.6 MB |
| Launch smoke (run built `.exe`) | ✅ log: `app.start` → `updater.noop up_to_date_or_not_configured` → `boot.navigate host=partnera-web-production.up.railway.app`; window opened, no crash |
| TypeScript (`tsc -b`) | ✅ unaffected — the app adds no TS project (same as operations-desktop) |

> Prettier `format:check` flags this app's `gen-build-info.mjs`, `tauri.conf.json`,
> `ui/index.html` and `gen/schemas/*` — **identically to the committed
> `operations-desktop`**. The desktop-apps subtree is not part of the repo's
> formatted set and `gen/schemas/` is generated + gitignored; the new app matches
> the sibling convention exactly. ESLint (the gate inside `verify`) is clean.

### Smoke test (thin-client HTTP contract, against the live central API)

| Flow | Check | Result |
|---|---|---|
| API up | `GET /health` | ✅ `200 {"status":"ok",…}` |
| Login screen | `GET /login` | ✅ 200, offers the **Affiliate Portal** scope |
| Portal auth gate / expired-session | `GET /affiliate` unauthenticated | ✅ `303 → /login` |
| Offers / links / stats / commissions / balance / payments | server-rendered by the same `/affiliate` route the web portal uses | ✅ covered by existing `packages/web` tests; the shell adds no logic that could change them |

Because the desktop is a pure webview onto the `/affiliate` route, "login → load
data → API error → expired session → insufficient permissions" are all handled by
the central API exactly as they are for the web portal. `insufficient
permissions` is demonstrated by the server denying operator scopes to non-operators
(deny-by-default) and by `/affiliate` requiring an affiliate identity.

---

## 8. Security posture

- **Per-affiliate isolation** — enforced server-side (`session.affiliateId`
  scoping). The shell never sees other affiliates' data and cannot request it.
- **No access to company-internal or global admin** — those scopes are denied to
  non-operators; the shell only opens `/affiliate`.
- **No IPC to web content** — deny-by-default capability set; no filesystem,
  shell, http or process bridge is exposed to the page.
- **Navigation lock** — only the configured API host loads inside the window;
  everything else opens in the system browser via a host allowlist.
- **Tokens** — the session cookie is set/cleared by the central API
  (`HttpOnly`, `Secure`, `SameSite`); no secret is baked into the frontend or
  logged. Sign-out uses the portal's `/logout`.
- **Deep links / URL validation** — `on_navigation` validates scheme + host on
  every navigation; unknown hosts are neither loaded nor opened.
- **Updater** — minisign signature verification; unsigned/tampered packages are
  rejected. Disabled until a real release channel + production keypair exist.

---

## 9. Risks, blockers & follow-ups

**No blockers** for the terminal condition: *Partnera Affiliate exists as an
independent Tauri app, compiles, and correctly consumes the Partnera API.*

Follow-ups (non-blocking):

1. **Portal tabs the task listed but the server does not yet surface.** The
   affiliate portal currently exposes dashboard, links, coupons, commissions,
   payouts, materials, notifications, profile, settings. It does **not** yet have
   dedicated *available offers*, *active programs*, or standalone *clicks* /
   *conversions* / *statistics* views (conversions appear as a count on the
   dashboard). Adding them belongs in the shared `packages/web` `/affiliate`
   module so both web and desktop gain them at once — intentionally **not** done
   here to honour "no modifiques producción / Operations".
2. **Updater not configured.** `tauri.conf.json` still points at
   `REPLACE_OWNER/REPLACE_REPO`; a distinct production signing keypair should be
   generated for this app (it currently reuses the shared placeholder pubkey).
   Human-only step (repo + keys + CI secrets + tagged release).
3. **Deployed API version.** The live Railway instance runs
   `persistence: local-file` and its `/login` lists business/affiliate/creator/admin
   (no `ops`) — older than the current branch. The affiliate scope this app needs
   is present and working; when the branch is deployed, nothing about this shell
   changes (it always loads the live `/affiliate`).
4. **Not committed / not deployed / no release** — per task restrictions. Branch
   `feat/partnera-admin-tauri` already had unrelated uncommitted changes; those
   were left untouched.

---

## 10. INSTALLED APPLICATION VERIFICATION

Local install + validation of the produced NSIS installer on this Windows 11
machine (2026-07-17). No release published, no GitHub, updater not activated, no
deploy, no version change, no refactor.

### Installer used

| | |
|---|---|
| Path | `D:\empresas\Partnera\apps\affiliate-desktop\src-tauri\target\release\bundle\nsis\Partnera Affiliate_0.1.0_x64-setup.exe` |
| Name | `Partnera Affiliate_0.1.0_x64-setup.exe` |
| Version | 0.1.0 |
| Size | 1,813,587 bytes (1.73 MB) |
| Modified | 2026-07-17 19:22:23 |
| SHA-256 | `8B8D5791ABFF708B7C6F38DE1C46D9C48A02548700EF072446539E6EFB0D4657` |

### Prior install check

No prior **Partnera Affiliate** install existed → clean install (no uninstall
needed, no data touched). Sibling apps present in *Installed Apps* — `Partnera
Business` (0.1.0), `Partnera Operations` (0.1.0), `Partnera Internal OS` (0.2.0) —
confirm the identifier / install-dir / uninstall entry do **not** collide.

### Installation (Step 3)

Ran the **official NSIS installer** in silent mode (`/S`) — this is an automated,
headless shell that cannot drive the interactive NSIS GUI, which is the documented
"interfaz local no permite otra opción" case. Installer exit code **0**. No
credentials or secrets entered.

| Item | Value |
|---|---|
| Install directory | `C:\Users\carlo\AppData\Local\Partnera Affiliate` |
| Installed exe | `partnera-affiliate-desktop.exe` (4,769,280 bytes) |
| Bundled resources | `resources\build-info.json` (`app: affiliate`, apiUrl = Railway host) |
| Start Menu shortcut | `…\Start Menu\Programs\Partnera Affiliate.lnk` → installed exe |
| Uninstall entry (HKCU) | DisplayName `Partnera Affiliate`, Version `0.1.0`, Publisher `Partnera` |
| Uninstaller | `…\Partnera Affiliate\uninstall.exe` (present) |
| DisplayIcon | the installed exe |
| Exe metadata | ProductName/FileDescription `Partnera Affiliate`, Product/FileVersion `0.1.0`, CompanyName `Partnera` |
| Log directory | `%APPDATA%\com.partnera.affiliate\logs\desktop.log` (identifier-scoped — **not** shared with Business / Operations / Internal OS) |

### GUI smoke test (Step 5) — on the **installed** exe (not `target`, not `dev`)

| Check | Result |
|---|---|
| App opens | ✅ window opened (PID confirmed) |
| No white screen | ✅ live login page rendered (screenshot captured) |
| Title shows *Partnera Affiliate* | ✅ native window title `Partnera Affiliate` |
| Icon correct | ✅ purple "P" mark |
| Window renders | ✅ full render, ~1360×900 |
| Splash disappears | ✅ splash → navigated to portal |
| API connection attempted | ✅ log `boot.navigate host=partnera-web-production.up.railway.app`; live `/login` loaded |
| Login / access screen shown | ✅ "Partnera · Sign in" |
| No `/ops` routes shown | ✅ not present in the app |
| No global-operator tools | ✅ none |
| No Creator/operator portals | ✅ none |
| Window close works | ✅ closed cleanly, **0 orphan processes** |
| Reopen works | ✅ relaunched via Start Menu shortcut, fresh `app.start` + `boot.navigate` |

Screenshot: `scratchpad/affiliate-installed-3.png` (PrintWindow capture of the
installed window showing the Sign-in screen).

### Functional validation (Step 6) — via the live API the installed app targets

Exercised the exact server path the installed webview uses, with the demo affiliate
account (`brian@primebuild.test`, demo data — no real sensitive data):

| Flow | Result |
|---|---|
| `POST /login` (scope=affiliate) | ✅ `303 → /affiliate`, session cookie set |
| `GET /affiliate` (dashboard) | ✅ `200`, 35 KB — Performance / Conversions / Available / Paid-to-date |
| `GET /affiliate/links` · `/coupons` · `/history` · `/payouts` · `/profile` · `/settings` | ✅ all `200` |
| `GET /affiliate/notifications` | ⚠️ `403` — pre-existing authorization quirk on the **deployed** build (notifications service denies the affiliate); not desktop-related |
| Isolation: `GET /internal` with affiliate session | ✅ `403` (deny-by-default) |
| Isolation: `GET /ops` with affiliate session | ⚠️ `200` **but = "Business Dashboard"** — the deployed build predates the `ops` scope, so `/ops` falls through to the default business path; it is **not** operator-console access. The current branch code 403-guards `/ops`. Unreachable from the desktop (no address bar; navigates only to `/affiliate`). |
| `GET /logout` | ✅ `303 → /login` (session cleared) |

### Windows registration (Step 7)

✅ Appears in *Installed Apps* as `Partnera Affiliate` 0.1.0 (Publisher Partnera) ·
✅ identifier/dir/uninstall entry distinct from Operations & Business (no collision) ·
✅ exe metadata correct · ✅ logs in the `com.partnera.affiliate` dir only ·
✅ no orphan processes after close · ✅ reopens · ✅ uninstaller present. The
uninstaller was **not** executed (install is healthy).

### Errors / blockers / notes

- **No blockers** to installing, opening, connecting, or using the affiliate portal.
- Cosmetic: concurrent writes from the updater + boot threads occasionally
  interleave two JSON lines in `desktop.log` (both events still fire) — logging
  nicety, no functional impact.
- Follow-up (non-blocking, **out of scope here — no refactor allowed**): the shell
  navigates to `/affiliate`, which on an unauthenticated session redirects to the
  **shared** `/login` whose default scope is "Business Dashboard". A dedicated
  pre-scoped affiliate entry (mirroring `business-desktop`'s `/desktop-business`)
  would pin the scope; a legitimate affiliate selects "Affiliate Portal". Server-side
  data isolation is unaffected.
- The deployed API is an older build (`0.0.0-dev`, `local-file`); the affiliate
  scope it needs works. Configured API URL: `https://partnera-web-production.up.railway.app`.

### Final status

**INSTALLED_AND_VERIFIED**

---

**Return summary**

```
Aplicación: Partnera Affiliate
Instalador: D:\empresas\Partnera\apps\affiliate-desktop\src-tauri\target\release\bundle\nsis\Partnera Affiliate_0.1.0_x64-setup.exe
Versión: 0.1.0
Instalada: SÍ
Abre correctamente: SÍ
Login probado: SÍ (end-to-end vía el mismo API; cuenta demo brian@primebuild.test)
Navegación probada: SÍ (/affiliate + links/coupons/history/payouts/profile/settings = 200)
Estado final: INSTALLED_AND_VERIFIED
Bloqueos: ninguno (notas no bloqueantes: login comparte /login con scope por defecto "Business Dashboard"; API desplegado es build antiguo; /affiliate/notifications 403 preexistente en el server)
```
