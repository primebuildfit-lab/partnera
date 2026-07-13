# Changelog

All notable changes to Partnera. Milestones only; full history in git + [DECISIONS.md](DECISIONS.md).

## [Unreleased] — 2026-07-12 — Creator Marketplace: architecture lock (docs only)

Documentation-only. Architecture-locked **future expansion**; **implementation not started**;
no code, migrations, dependencies, providers, or deployment. Existing app behaviour and tests
are untouched.

### Added
- **`docs/creator-marketplace/`** — a 33-document architecture package for a **Creator Economy
  & Content Marketplace**: a second economic system where creators are paid per **approved
  deliverable** (transparent **2%–4%** platform fee) alongside the affiliate system, reusing the
  existing tenancy/identity/**append-only ledger** (new *reasons*, not a new ledger)/`PayoutRail`/
  fraud/notification/persistence/web spine. Covers product definition, roles, workflows + state
  machines, deliverables, human + AI-assisted review, content library + rank unlocks + access
  security, data model, payments/fees, monetization/entitlements, trust-safety/disputes,
  permissions/security, API + events, page builder + storefront/Shopify adapters, analytics,
  notifications, UX/navigation, legal-review checklist, CM0–CM16 roadmap, architecture
  reconciliation, decisions/open-questions, self-audit + risk register. Start at
  [docs/creator-marketplace/README.md](docs/creator-marketplace/README.md).

### Decisions
- **D-300–D-320** locked (+ provisional D-330–D-336). Notably: AI never silently releases
  payment (D-307); one ledger, new reasons (D-315); providers move money, no card storage
  (D-313); Shopify is an adapter (D-314); creators never pay to earn (D-312). See
  [DECISIONS.md](DECISIONS.md) and the module log.

### Not changed / not built (by design)
- No engine, schema, or behaviour changed. Not "Mega Module 5 — Live Infrastructure & Pilot".
  No payment provider connected; no real creator data stored.

## [0.4.2] — 2026-07-12 — Windows desktop integration

Makes Partnera launch like a normal Windows app.

### Added
- **Application icon** — `scripts/make-icon.ps1` generates `assets/partnera.ico`
  (shortcuts) and `packages/web/src/brand-icon.ts` (base64 PNG for web).
- **Desktop + Start Menu shortcuts** — `partnera.ps1 install-desktop` /
  `remove-desktop` (WScript.Shell `.lnk`, correct icon/name/working-dir, `open` target).
- **`open` command** — start (if needed), wait until ready, launch the browser.
- **PWA** — web manifest + icon/favicon routes + head links (theme-color, apple/
  ms meta) so the app is installable as a standalone windowed desktop app.
- 3 PWA delivery tests (manifest, icon bytes, head links). 102 -> 105.

### Changed / hardened
- Launcher: ASCII-safe (PS 5.1 encoding), prerequisite checks (node/pnpm),
  friendly errors, explicit exit codes, try/catch wrapper. Unix launcher gains `open`.
- Server serves binary asset bodies (icon PNG).
- Windows QA audited: fresh/existing install, update, restart, shutdown, multiple
  launches, missing/invalid config, missing deps -> friendly messages.
- Docs: `INSTALL.md` (desktop/Start Menu/PWA, removal, Windows limitations),
  `BUILD_STATUS`, `PROJECT_CONTEXT`, `TECHNICAL_HANDOFF`, `DECISIONS` (D-221).

## [0.4.1] — 2026-07-12 — Installation Phase: local install & daily use

Makes Partnera installable and usable locally, with no external services.

### Added
- **Durable local persistence** — the relational store snapshots to a single JSON
  file (`.partnera/data.json`), saved after every mutation and on shutdown (atomic
  write, Date-aware serializer). First run seeds the demo through the real
  services; later runs load from the file. Local runtime uses a real clock + UUID
  ids (`@partnera/persistence` `serializeStore`/`deserializeStore`; web `createLocalWorld`).
- **Launcher scripts** — `scripts/partnera.ps1` (Windows), `scripts/partnera.sh`
  (Unix), `partnera.cmd` shortcut: install/start/stop/restart/status/update/logs/reset.
- **`INSTALL.md`** — first-run, startup/shutdown, update, configuration,
  persistence/recovery, and troubleshooting.
- 4 persistence tests (store snapshot round-trip; load-or-seed + change survival).
  98 → 102.

### Changed
- Graceful shutdown saves state; server config by env (`PORT`, `PARTNERA_DATA`).
- Docs: `BUILD_STATUS`, `PROJECT_CONTEXT`, `DECISIONS` (D-219/D-220), `CHANGELOG`.

### Not connected (by design)
- No Shopify, no database server, no cloud, no deploy, no external credentials.

## [0.4.0] — 2026-07-12 — Mega Module 4: Delivery Activation & First UX

The first usable Partnera experience. Three server-rendered React apps over the
existing services — the domain stays the single source of truth; the UI is thin.
No engine or architecture redesign; every gate green.

### Added
- **`@partnera/web`** — delivery/presentation package:
  - **Business Dashboard**: Overview, Analytics, Offers (+ detail/versions),
    Campaigns, Tracking, Conversions, Commissions, Balances, Fraud,
    Notifications, Configuration, Audit, Organization.
  - **Affiliate Portal**: Performance, Profile, Links, Coupons, Pending/Approved/
    Paid commission, History, Payouts, Notifications, Settings.
  - **Admin Console** (operational structure): Overview, Health, Logs,
    Organizations, Users, Permissions, Offers, Tracking, Fraud, Feature Flags,
    Configuration, Audit.
  - Responsive, accessible **app shell** (sidebar/desktop, `<details>` menu/mobile,
    app switcher, skip link, ARIA landmarks, `aria-current`).
  - **Workflows** through the services: create/activate/duplicate/archive offer,
    approve/reject commission, review fraud case, update configuration.
  - **Analytics** computed from the ledger/repositories.
  - **Auth preparation**: `WebSession` + permission/tenant context + protected-route
    guard + `DevAuthProvider` placeholder; OAuth/SSO/MFA seams documented.
  - Rendered via `react-dom/server` (no bundler/hydration); node HTTP host +
    `createDemoWorld()` seeded through the **real money spine** (not faked).
  - 14 delivery tests (login, real data, workflows, RBAC, accessibility). 84 → 98.
- **`QueryService`** added to `@partnera/application` — permission-gated reads for
  the UI (holds no business logic); plus repository read helpers.
- Offer workflow support: `OfferService.archive` / `duplicate`.
- `docs/24-delivery-ux.md`.

### Changed
- Docs: `PROJECT_CONTEXT`, `BUILD_STATUS`, `ROADMAP`, `DECISIONS` (D-215–D-218),
  `ARCHITECTURE`, `TECHNICAL_HANDOFF` updated.

### Unchanged (deliberately)
- Every domain engine and its public contracts. The UI consumes only services.

### Not yet built (documented, behind seams)
- Live Postgres/Prisma wiring, NestJS/Next production host + client hydration,
  real auth provider, Shopify commerce adapter, real payout rails.

## [0.3.0] — 2026-07-12 — Mega Module 3: Persistence & Money Spine

The pure-domain foundation becomes a **persistent platform**. The append-only
commission ledger is now the centre of the implementation, with everything
integrating around it. No product or architecture redesign; every gate green.

### Added
- **`@partnera/persistence`** — repository layer behind clean ports over an
  in-memory relational store that enforces append-only tables, unique-constraint
  idempotency, optimistic concurrency, atomic transactions, and tenant scoping.
  Repositories: identity, offer (+ versions), tracking, ledger, payout, fraud,
  notification, extension, config, audit, idempotency.
- **Canonical database model** — `packages/persistence/prisma/schema.prisma`
  (all tables: tenants, organizations, users, memberships, roles, offers, offer
  versions, tracking links, coupons, sessions, clicks, orders, conversions,
  refunds, ledger events, payout events, balance snapshots, fraud signals/scores/
  cases, notifications, extensions, configuration, audit, idempotency keys) and
  `sql/0001_init.sql` (append-only triggers, money integrity, RLS template).
- **`@partnera/payment-engine`** — new pure-domain engine: append-only payout
  event stream + state machine + provider-less `PayoutRail` abstraction
  (non-custodial; no real provider ships).
- **`@partnera/application`** — permission-aware use-case services
  (organizations, offers, tracking/money-spine, ledger, payments, fraud,
  notifications, configuration). Tenant + actor always from the request context;
  deny-by-default authorization; audited.
- **`@partnera/http-api`** — dependency-free HTTP delivery adapter over the
  application services, with domain-error → HTTP-status mapping.
- **Money spine, end to end** — attribute → convert → commission → approve →
  payout → paid, with fraud gating, clawbacks/reversals, idempotency, optimistic
  concurrency, and separation of duties. 37 new tests (47 → 84).

### Changed
- Docs: `PROJECT_CONTEXT`, `BUILD_STATUS`, `ROADMAP`, `DECISIONS` updated;
  added `docs/23-persistence.md`, `ARCHITECTURE.md`, `TECHNICAL_HANDOFF.md`.

### Unchanged (deliberately)
- Every existing engine package and its public contracts. The persistence and
  delivery layers sit entirely behind them.

### Not yet built (documented, behind contracts)
- Live Postgres/Prisma wiring, NestJS host, auth provider, real commerce
  adapter, real payout rails.

## [0.2.0] — 2026-07-11 — Mega Module 2: Platform Foundation
- 12-package pure-domain TypeScript monorepo; verified green (47 tests).

## [0.1.0] — 2026-07-11 — Phase 0: Product Design
- 26-document product + engineering design set.
