# BUILD_STATUS

Single source of truth for **where Partnera is right now**.

---

## Current phase

**Mega Module 2 — Platform Foundation: COMPLETE (awaiting review).**

The technical foundation exists as a verified TypeScript monorepo of pure-domain
engine packages plus a design system. No database, API, app runtime, or commerce
integration is wired yet — by design (those are later modules).

**Last updated:** 2026-07-11

## Verification (this module)

| Gate | Result |
|---|---|
| Typecheck (`tsc -b`, 12 packages) | ✅ pass |
| Lint (ESLint 9 flat) | ✅ pass |
| Build (`turbo run build`) | ✅ 12/12 packages |
| Tests (Vitest) | ✅ 47 passed / 10 files |

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
- `@partnera/testing` — deterministic ids, fixed clock, money helpers, in-memory
  repo/bus.
- `@partnera/ui` — theme-aware design tokens (light/dark) + reusable React
  components (Button, Input, Textarea, Select, Field, Card, Alert, Badge, Tag,
  Progress, Spinner, Table, Dialog, Drawer, EmptyState).

**Docs**: product 00–21 plus engineering [docs/22-engineering.md](docs/22-engineering.md),
[TESTING.md](TESTING.md), [CONTRIBUTING.md](CONTRIBUTING.md).

## What does NOT exist yet (intentionally)

- ❌ Database / Prisma schema / migrations (persistence is a later module).
- ❌ API / HTTP layer / NestJS wiring.
- ❌ The three apps (Admin/Business/Affiliate) — design system is ready for them.
- ❌ Auth provider (login, token issuance, MFA/SSO).
- ❌ Commerce integrations / Shopify adapter.
- ❌ Payments/billing implementation.

## Newly decided (see [DECISIONS.md](DECISIONS.md))

D-200 TS + pnpm + Turborepo · D-201 framework-agnostic domain core ·
D-202 tsc/Vitest/ESLint · D-203 Bundler resolution · D-204 Postgres+Prisma /
NestJS+Next targets · D-205 data-driven RBAC.

## Next milestone

Review this foundation, then begin the next module (recommended:
**Persistence & Delivery** — Prisma schema + repository implementations of the
store interfaces + first NestJS wiring, behind the existing engine contracts).

## Change log

| Date | Change |
|---|---|
| 2026-07-11 | Phase 0 documentation set created (design only). |
| 2026-07-11 | Mega Module 2 — Platform Foundation built & verified (12 packages, 47 tests). |
