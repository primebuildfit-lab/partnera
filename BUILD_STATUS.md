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

## Creator Marketplace — locally implemented (branch `feat/creator-marketplace`)

**Creator Economy & Content Marketplace** — a second economic system where creators are paid
per **approved deliverable** (transparent 2%–4% platform fee) beside the affiliate system,
reusing the existing ledger/RBAC/payout/fraud/persistence/web spine. **Built locally through
technical certification** on branch `feat/creator-marketplace` (not merged to `main`):
new `@partnera/creator-marketplace` engine + persistence/application/web integration; a
**Creator Portal** plus business Creators section and affiliate Content Library; the full
spine (opportunity → apply → accept(fee snapshot) → submit → AI-advisory → review → approve →
authorize (SoD) → **simulated** payout → library → rank unlock) runs in the local app and
persists across restart. **18 packages, 154 tests green.** Payouts, AI review, and content
storage are **simulated and clearly labelled**; **external activation (real money, providers,
Shopify, deployment, legal) is not started** — gated on counsel + explicit go-ahead. Not the
same as "Mega Module 5 — Live Infrastructure & Pilot". Full status:
[IMPLEMENTATION_STATUS.md](docs/creator-marketplace/IMPLEMENTATION_STATUS.md).

A follow-up phase — **Configurable Business Programs & Content Operations** — makes every
business control its own program: custom **evaluation categories → payments** (Partnera imposes
none; PrimeBuild's $0/$10/$20/$35 is editable local data, not a global price), **capacity/budget
waiting queues** (over-limit content waits, never auto-rejected), **independent pay/quality/reuse
disposition**, **two advisory AI scores** (AI recommends a category, never sets/authorizes money),
and provisional plans/promotional channels (no billing, no paid media). PrimeBuild pilot seeded;
**176 tests green**; live + restart verified. Verdict:
[FINAL_CERTIFICATION.md](docs/creator-marketplace/FINAL_CERTIFICATION.md) → **PARTNERA CREATOR
OPERATIONS READY FOR LOCAL PILOT**. Run it: [LOCAL_PILOT_GUIDE.md](docs/creator-marketplace/LOCAL_PILOT_GUIDE.md).

## Change log

| Date | Change |
|---|---|
| 2026-07-11 | Phase 0 documentation set created (design only). |
| 2026-07-12 | Creator Marketplace architecture lock — 33-doc future-expansion package (docs only; no code). |
| 2026-07-12 | Creator Marketplace **locally implemented** (branch): engine + persistence + services + UI + seed; 18 pkgs / 154 tests; payouts/AI/storage simulated; certified READY FOR LOCAL USE. |
| 2026-07-12 | Creator **Configurable Business Programs & Content Operations** (branch): business-owned evaluation schemes (categories→payment), capacity/budget waiting queues, independent pay/quality/reuse disposition, two-score advisory AI, provisional plans/promos; PrimeBuild pilot seed; **176 tests**; certified **READY FOR LOCAL PILOT**. |
| 2026-07-13 | Creator **UX Simplification & Commercial Readiness** (branch): plain commercial language (no architecture jargon leaked), role-focused business home + first-run checklist, Setup guide wizard, itemised simulated-payment breakdown + confirmations, improved empty states; **180 tests**; live daily-use + restart verified; certified **PARTNERA READY FOR REAL-WORLD LOCAL PILOT**. |
| 2026-07-13 | Creator **Pilot Data Synchronization** (Day 1.13, branch): persisted the platform-fee rate (was hardcoded) + operational pilot checklist (was UI); admin Data-status view + deterministic integrity check; launcher backup/restore; **189 tests**; live backup→edit→restart→restore verified. Pilot config fully persisted. |
| 2026-07-13 | **Shopify Pilot adapter** (branch): new `@partnera/shopify` (HMAC, install lifecycle, idempotent webhooks + dead-letter, onboarding, env validation, scopes) + idempotent install→tenant provisioning + `ShopifyRepository`; **19 packages, 210 tests**; cross-shop isolation tested. Shopify = adapter; no real credentials/network/deploy. Real install into PrimeBuild is **external-gated** (Brian's Partner app + hosting + consent). See [docs/shopify-pilot/FINAL_CERTIFICATION.md](docs/shopify-pilot/FINAL_CERTIFICATION.md). |
| 2026-07-13 | **Activation — hosted persistence groundwork** (branch): Prisma schema extended to **60 models** covering all **59 runtime collections** (inventory [docs/PERSISTENCE_INVENTORY.md](docs/PERSISTENCE_INVENTORY.md)); `sql/0002` (new tables + append-only triggers); explicit persistence-mode config with **hard-fail, no silent fallback**; **shared store contract suite**; public `/health`+`/ready`; log redaction; `.env.example`. **218 tests**. Engines never import Prisma; local mode preserved. Report: [docs/shopify-pilot/ACTIVATION_REPORT.md](docs/shopify-pilot/ACTIVATION_REPORT.md). |
| 2026-07-13 | **Fase 5 — Shopify Activation** (branch): **driver Postgres real** (`SqlStore` write-through tras `SqlClient`, pasa la MISMA contract suite que memoria) + **host productivo** con OAuth/webhooks/session-token/embedded **montados** + onboarding automático idempotente + pilot dry-run + `Dockerfile`/`railway.json`/`DEPLOY.md`. **230 tests**. Todo listo para que Brian solo cree la Partner app, configure credenciales, despliegue e instale. Clasificación + acciones de Brian: [docs/shopify-pilot/PHASE5_REPORT.md](docs/shopify-pilot/PHASE5_REPORT.md). Instalación/producción **NO** (gated a Brian). |
| 2026-07-11 | Mega Module 2 — Platform Foundation built & verified (12 packages, 47 tests). |
| 2026-07-12 | Mega Module 3 — Persistence & Money Spine built & verified (16 packages, 84 tests): persistence layer, Payment Engine, application/API, HTTP delivery, canonical DB model. |
| 2026-07-12 | Mega Module 4 — Delivery & First UX built & verified (17 packages, 98 tests): `@partnera/web` — Business/Affiliate/Admin apps (SSR React over the services), workflows, analytics, auth prep, demo world. |
