# Changelog

All notable changes to Partnera. Milestones only; full history in git + [DECISIONS.md](DECISIONS.md).

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
