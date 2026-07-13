# BUILD_STATUS

Single source of truth for **where Partnera is right now**.

---

## Current phase

**Mega Module 4 — Delivery Activation & First User Experience: COMPLETE (awaiting review).**

Partnera now has a **usable, navigable product**. A new `@partnera/web` package
delivers three server-rendered React apps over the existing services — Business
Dashboard, Affiliate Portal, and Admin Console — with a responsive/accessible
shell, real workflows (create/activate/duplicate/archive offer, approve/reject
commission, review fraud), analytics computed from the ledger, and auth
preparation (no provider connected). Every dashboard number is derived from the
real money spine via a seeded demo world (not faked). Run it with
`pnpm --filter @partnera/web serve`.

**Last updated:** 2026-07-12

## Verification (this module)

| Gate | Result |
|---|---|
| Typecheck (`tsc -b`, 17 packages) | ✅ pass |
| Lint (ESLint 9 flat) | ✅ pass |
| Build (`turbo run build`) | ✅ 17/17 packages |
| Tests (Vitest) | ✅ 105 passed / 18 files |
| Delivery/dashboard/workflow/permission/a11y/PWA | ✅ 17 web tests |
| Local install (startup/shutdown/update/config/first-run/persistence/recovery) | ✅ verified; 4 persistence tests |
| Windows integration (icon/Desktop+Start Menu shortcuts/launch/QA) | ✅ verified on Windows 11 (launched via shortcut) |

## Local installation (Installation + Windows Integration)

The app is installable and usable locally with no external services. Data persists
to `.partnera/data.json` (saved after each change + on shutdown); restart recovers
it exactly. **Windows desktop integration**: `install-desktop` adds Desktop +
Start Menu shortcuts (generated icon) that launch the app in the browser; the app
is also PWA-installable as a standalone window. Launcher: `scripts/partnera.ps1`
(Windows) / `scripts/partnera.sh` (Unix) — `open / install / start / stop /
restart / status / update / logs / reset / install-desktop / remove-desktop`.
Windows QA audited (fresh/existing/update/restart/multiple-launch/invalid-config/
missing-deps -> friendly errors + exit codes). See [INSTALL.md](INSTALL.md).

## What exists now

**Tooling**: pnpm workspaces, Turborepo, strict TS project references, ESLint,
Prettier, Vitest, GitHub Actions CI (`pnpm verify`).

**Packages (`packages/*`)**
- `@partnera/core` — kernel: `Money` (bigint), `Result`, branded ids, tenancy,
  `Clock`, `EventBus`, errors, pagination.
- `@partnera/auth` — identity/tenancy/session models + data-driven RBAC engine
  (10 system roles, wildcard grants, deny-by-default).
- `@partnera/offer-engine` — offer blocks (scope/condition/calc/reward/schedule/
  limit) + deterministic, explainable evaluator + validators + templates.
- `@partnera/tracking-engine` — touch/order/refund records + configurable
  attribution resolver (last/first touch, window, precedence).
- `@partnera/commission-engine` — append-only ledger, lifecycle state machine,
  derived balances, append-guard.
- `@partnera/fraud-engine` — signals, weighted risk scoring, bands→actions,
  hard floors, review cases.
- `@partnera/notification-engine` — channels, templates, preferences, retry/
  backoff → dead-letter.
- `@partnera/extension-engine` — manifest, scope/hook allow-lists, validation,
  approval lifecycle, engine compatibility.
- `@partnera/analytics` — KPIs, funnels, reports/dashboards contracts.
- `@partnera/platform` — feature flags/entitlements, immutable audit, config
  framework, navigation registries (admin/business/affiliate).
- `@partnera/payment-engine` — **(new)** append-only payout event stream, state
  machine, and a provider-less `PayoutRail` abstraction (non-custodial).
- `@partnera/persistence` — **(new)** repository ports + in-memory relational
  store enforcing append-only, unique/idempotency, optimistic concurrency,
  atomic transactions, and tenant scoping; canonical `prisma/schema.prisma` +
  `sql/0001_init.sql`.
- `@partnera/application` — **(new)** permission-aware use-case services
  (organizations, offers, tracking/money-spine, ledger, payments, fraud,
  notifications, configuration) — the API core.
- `@partnera/http-api` — dependency-free HTTP delivery adapter over the
  application services; NestJS host is the documented deploy wrapper.
- `@partnera/web` — **(M4)** three server-rendered React apps (Business
  Dashboard, Affiliate Portal, Admin Console) reusing `@partnera/ui`, over the
  application services; responsive/accessible shell, workflows, analytics, auth
  preparation, and a node HTTP host with a real-data demo world.
- `@partnera/testing` — deterministic ids, fixed clock, money helpers, in-memory
  repo/bus.
- `@partnera/ui` — theme-aware design tokens (light/dark) + reusable React
  components (Button, Input, Textarea, Select, Field, Card, Alert, Badge, Tag,
  Progress, Spinner, Table, Dialog, Drawer, EmptyState).

**Docs**: product 00–21 plus engineering [docs/22-engineering.md](docs/22-engineering.md),
[TESTING.md](TESTING.md), [CONTRIBUTING.md](CONTRIBUTING.md). Plus an **architecture-locked
future expansion** — [docs/creator-marketplace/](docs/creator-marketplace/README.md) (Creator
Economy & Content Marketplace) — **documentation only, not built** (see below).

## What does NOT exist yet (intentionally)

- ❌ Live database — the canonical model exists (`prisma/schema.prisma` +
  `sql/0001_init.sql`); generating the client + running migrations is the deploy
  step (D-207/D-101). The tested runtime uses the in-memory relational store.
- ❌ Production host — the three apps render server-side over a node HTTP host
  (`@partnera/web`); the NestJS/Next production wrapper + client enhancement are
  the remaining delivery step (D-210).
- ✅ The three apps (Business/Affiliate/Admin) now exist (`@partnera/web`, SSR).
- ❌ Auth provider (login, token issuance, MFA/SSO) — RBAC + principal
  resolution + session/permission context + seams exist; the real provider is D-104.
- ❌ Commerce integrations / Shopify adapter (tracking ingests normalized orders).
- ❌ Real payment providers — the payout abstraction exists; rails are empty (D-105).

## Newly decided (see [DECISIONS.md](DECISIONS.md))

D-200 TS + pnpm + Turborepo · D-201 framework-agnostic domain core ·
D-202 tsc/Vitest/ESLint · D-203 Bundler resolution · D-204 Postgres+Prisma /
NestJS+Next targets · D-205 data-driven RBAC.

## Next milestone

Review this module, then **Mega Module 5 — Live Infrastructure & Pilot**: a
Prisma-backed store (activate the schema over live Postgres), a NestJS/Express
host over `@partnera/web`/`@partnera/http-api`, a real auth provider (D-104), the
first Shopify commerce adapter (D-114), and client-side enhancement/telemetry —
proving one real PrimeBuild conversion → payout on live infrastructure through
the UI.

## Future expansion (documented, not built)

**Creator Economy & Content Marketplace** — a second economic system where creators are paid
per **approved deliverable** (transparent 2%–4% platform fee) beside the affiliate system,
reusing the existing ledger/RBAC/payout/fraud/persistence/web spine. Fully documented and
**architecture-locked** in [docs/creator-marketplace/](docs/creator-marketplace/README.md);
**implementation not started**, **not** Mega Module 5, and **not required** for current local
usability. Its own CM0–CM16 plan gates all money/rights work on counsel + explicit go-ahead.

## Change log

| Date | Change |
|---|---|
| 2026-07-11 | Phase 0 documentation set created (design only). |
| 2026-07-12 | Creator Marketplace architecture lock — 33-doc future-expansion package (docs only; no code). |
| 2026-07-11 | Mega Module 2 — Platform Foundation built & verified (12 packages, 47 tests). |
| 2026-07-12 | Mega Module 3 — Persistence & Money Spine built & verified (16 packages, 84 tests): persistence layer, Payment Engine, application/API, HTTP delivery, canonical DB model. |
| 2026-07-12 | Mega Module 4 — Delivery & First UX built & verified (17 packages, 98 tests): `@partnera/web` — Business/Affiliate/Admin apps (SSR React over the services), workflows, analytics, auth prep, demo world. |
