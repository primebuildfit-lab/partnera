# BUILD_STATUS

Single source of truth for **where Partnera is right now**.

---

## Current phase

**Mega Module 3 — Persistence & Money Spine: COMPLETE (awaiting review).**

The pure-domain foundation is now a **persistent platform**. A repository layer
behind clean ports (over an invariant-enforcing relational store), a new Payment
Engine, a permission-aware application/API layer, and a dependency-free HTTP
delivery surface make the money spine work end-to-end: attribute → convert →
commission (append-only ledger) → approve → payout → paid, with fraud gating,
clawbacks, idempotency, optimistic concurrency, and tenant isolation — all tested.

The canonical production database is authored as `packages/persistence/prisma/
schema.prisma` + `sql/0001_init.sql`; wiring a live Postgres/Prisma and a NestJS
host is the remaining, mechanical deploy step (behind the same ports).

**Last updated:** 2026-07-12

## Verification (this module)

| Gate | Result |
|---|---|
| Typecheck (`tsc -b`, 16 packages) | ✅ pass |
| Lint (ESLint 9 flat) | ✅ pass |
| Build (`turbo run build`) | ✅ 16/16 packages |
| Tests (Vitest) | ✅ 84 passed / 15 files (47 → 84) |

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
- `@partnera/http-api` — **(new)** dependency-free HTTP delivery adapter over the
  application services; NestJS host is the documented deploy wrapper.
- `@partnera/testing` — deterministic ids, fixed clock, money helpers, in-memory
  repo/bus.
- `@partnera/ui` — theme-aware design tokens (light/dark) + reusable React
  components (Button, Input, Textarea, Select, Field, Card, Alert, Badge, Tag,
  Progress, Spinner, Table, Dialog, Drawer, EmptyState).

**Docs**: product 00–21 plus engineering [docs/22-engineering.md](docs/22-engineering.md),
[TESTING.md](TESTING.md), [CONTRIBUTING.md](CONTRIBUTING.md).

## What does NOT exist yet (intentionally)

- ❌ Live database — the canonical model exists (`prisma/schema.prisma` +
  `sql/0001_init.sql`); generating the client + running migrations is the deploy
  step (D-207/D-101). The tested runtime uses the in-memory relational store.
- ❌ NestJS/Express host — the HTTP surface exists (`@partnera/http-api`); the
  framework wrapper is the thin remaining delivery step (D-210).
- ❌ The three apps (Admin/Business/Affiliate) — design system is ready for them.
- ❌ Auth provider (login, token issuance, MFA/SSO) — RBAC + principal
  resolution exist; the provider is D-104.
- ❌ Commerce integrations / Shopify adapter (tracking ingests normalized orders).
- ❌ Real payment providers — the payout abstraction exists; rails are empty (D-105).

## Newly decided (see [DECISIONS.md](DECISIONS.md))

D-200 TS + pnpm + Turborepo · D-201 framework-agnostic domain core ·
D-202 tsc/Vitest/ESLint · D-203 Bundler resolution · D-204 Postgres+Prisma /
NestJS+Next targets · D-205 data-driven RBAC.

## Next milestone

Review this module, then **Mega Module 4 — Delivery Activation & Pilot Surfaces**:
provide the Prisma-backed store (activate the schema), a NestJS/Express host over
`@partnera/http-api`, an auth provider (D-104), the first Shopify commerce
adapter, and the minimal Business/Affiliate surfaces — proving one real
PrimeBuild conversion → payout on live infrastructure.

## Change log

| Date | Change |
|---|---|
| 2026-07-11 | Phase 0 documentation set created (design only). |
| 2026-07-11 | Mega Module 2 — Platform Foundation built & verified (12 packages, 47 tests). |
| 2026-07-12 | Mega Module 3 — Persistence & Money Spine built & verified (16 packages, 84 tests): persistence layer, Payment Engine, application/API, HTTP delivery, canonical DB model. |
