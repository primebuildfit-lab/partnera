# PROJECT_CONTEXT — Partnera

> **Read this first.** This is the single authoritative context document for Partnera.
> It supersedes chat history as the source of truth. Future AI sessions and developers
> should read this before reading anything else. When this file disagrees with an old
> chat or a stale doc, **this file wins** — or the discrepancy is a bug to fix here.
>
> Maintenance rule: update this file whenever maturity, status, decisions, or "next work"
> change. Keep it dense. Do not let it drift.
> **Last verified:** 2026-07-12 (Windows desktop integration — icon, Desktop/Start Menu shortcuts, PWA; 17 packages, 105 tests green; launched via shortcut on Windows 11). Plus **Creator Marketplace** — architecture-locked and **built locally** on branch `feat/creator-marketplace`, with **configurable business programs & content operations** (custom categories→payments, capacity/budget waiting queues, independent pay/quality/reuse, two-score advisory AI) and a **UX-simplification pass** (plain commercial language, role-focused homes + first-run checklist, Setup guide, itemised simulated-payment breakdown + confirmations). **18 packages, 180 tests green**; payouts/AI/storage simulated; external activation gated. Certified **PARTNERA READY FOR REAL-WORLD LOCAL PILOT** ([creator-marketplace/FINAL_CERTIFICATION.md](creator-marketplace/FINAL_CERTIFICATION.md)).

---

## 1. PROJECT OVERVIEW

**Purpose.** Partnera is a standalone, multi-tenant SaaS platform that lets any business
build, run, and scale its own **affiliate, referral, and B2B partnership programs** —
**configured, not coded**, and not locked to any one commerce platform. The core bet: an
*offer* is a configurable object, not a code path. If the offer engine + commission ledger
are right, the rest composes around them.

**Relationship to PrimeBuild.** PrimeBuild is **Tenant #1 only** — a validation case, never a
design constraint. Unrelated to the Eventra/PrimeBuild Shopify work; do not touch those repos
for Partnera.

- **Current maturity:** Mid. Design + foundation + persistence/money-spine + **a usable UI** built. Persistent and navigable behind a repository seam; no live DB/auth provider yet.
- **Current phase:** Phase 0 ✅ · MM2 Foundation ✅ · MM3 Persistence & Money Spine ✅ · **MM4 Delivery & First UX ✅ built, awaiting review.** Substantial Phase 1 surface coverage.
- **Current status:** Verified-green 17-package monorepo. Three server-rendered apps (Business/Affiliate/Admin) run over the real services; the money spine and all dashboards use real data. **Installed & usable locally as a Windows desktop app** — Desktop + Start Menu shortcuts (generated icon) that launch the app in the browser, PWA-installable standalone window, durable file persistence (`.partnera/data.json`; survives restarts), no external services. Live Postgres/Prisma + NestJS host + auth provider remain documented activation steps. See [INSTALL.md](../INSTALL.md).
- **Current health:** Green. Typecheck + lint + build (17/17) + 98 tests all pass. Main non-code risks: not backed up (no git remote); live persistence/auth/host not yet activated (seams + canonical schema + demo host exist).

**Executive summary.** On the 12 framework-agnostic domain packages, MM3 added persistence,
a new `payment-engine`, permission-aware `application` services, and an `http-api` seam
(money spine end-to-end, all invariants enforced). **MM4** added `@partnera/web`: three
server-rendered React apps (reusing `@partnera/ui`) over those services — Business Dashboard,
Affiliate Portal, and Admin Console — with a responsive/accessible shell, real workflows
(create/activate/duplicate/archive offer, approve/reject commission, review fraud), analytics
computed from the ledger, and auth preparation (session/permission/tenant context + provider
seam; no provider connected). A seeded demo world runs the real money spine so every number is
real, not faked. **No engine interface changed.** Next: live infrastructure (Postgres + NestJS
host + auth provider + Shopify adapter) to prove one real PrimeBuild conversion → payout on the UI.

---

## 2. ARCHITECTURE

**High-level.** Multi-tenant SaaS. Three presentation surfaces over a set of modular,
event-driven domain engines sitting on an Identity & Tenancy core.

- **Surfaces:** **Admin Console** (Partnera operators), **Business Dashboard** (tenants), **Affiliate Portal** (affiliates/partners). Surfaces are not engines.
- **Engines (logical):** Offer · Tracking · Commission · Payment · Fraud · Notification · Extension · Analytics · Integration · Marketplace.
- **Reference conversion path:** touch (link/coupon/session) → normalized order via Integration adapter → attribution resolved → `conversion.recorded` → Fraud scores (allow/hold) → Offer evaluates → Commission ledger entry (pending) → approve → Payment payout → notify + analytics. Every step emits domain events; money steps are **ledger appends, never edits**.

**Foundational engineering principle:** the engines are **pure-domain TypeScript** with **zero**
dependency on HTTP/NestJS/Next/Prisma. Frameworks are *delivery layers* added later. The domain
must survive for years; coupling it to a framework now is the exact debt the brief forbids.

**Package dependency graph:** `core` depends on nothing. Every other domain package depends only
on `core`. Engines do **not** depend on each other (they compose via events/contracts at the
future delivery layer). `ui` is isolated from the domain. Graph is acyclic by design.

### Current modules (`packages/*`, all shipped in the foundation)
| Package | Role |
|---|---|
| `@partnera/core` | Kernel: `Money` (bigint minor units, bps rounding, largest-remainder `allocate`), `Result`, branded ids, tenancy (`RequestContext`, `assertSameTenant`), `Clock`, `EventBus`, `DomainError` hierarchy, currency table, cursor pagination. |
| `@partnera/auth` | Identity/business/membership shapes + **data-driven RBAC**: permission catalog, 10 system-role templates, wildcard grants (`offers.*`, `*`), deny-by-default `PermissionEngine`. **No login/token impl** (delivery-layer, later). |
| `@partnera/offer-engine` | Six block sections (Scope/Condition/Calculation/Reward/Schedule/Limit); deterministic `OfferEvaluator` → explainable `CommissionInstruction` (`reasonPath`); validators; starter templates. |
| `@partnera/tracking-engine` | Touch/order/refund records; `DefaultAttributionResolver` (last/first touch, validity window, precedence tie-break). |
| `@partnera/commission-engine` | Money spine: append-only `LedgerEvent` store contract, lifecycle state machine, `foldCommission`, `projectBalances` (pending/available/paid/reversed), `assertAppendable` guard. |
| `@partnera/fraud-engine` | Weighted signal scoring (0–100), band→action, platform hard-floor signals, review cases. |
| `@partnera/notification-engine` | Channels (email/in_app/push live; sms/webhook future), template render, preference gating, backoff → dead-letter. |
| `@partnera/extension-engine` | Manifest with allow-listed scopes/hooks, least-privilege validation, approval lifecycle, semver engine-compat. |
| `@partnera/analytics` | Metric events, KPI (count/sum/unique), ordered funnel with conversion rates. |
| `@partnera/platform` | Feature flags (plan/tenant/rollout, stable hashing), immutable audit entries, config framework, nav registries for all three surfaces (each module gated by a permission key). |
| `@partnera/payment-engine` | **(M3)** Append-only payout event stream + state machine; `PayoutRail` abstraction with only `UnconfiguredPayoutRail` (non-custodial, no provider). |
| `@partnera/persistence` | **(M3)** Repository ports + in-memory relational store (append-only, unique/idempotency, optimistic concurrency, transactions, tenant scoping); repos for identity/offer/tracking/ledger/payout/fraud/notification/extension/config/audit/idempotency; canonical `prisma/schema.prisma` + `sql/0001_init.sql`. |
| `@partnera/application` | **(M3)** Permission-aware use-case services (organizations, offers, tracking/money-spine, ledger, payments, fraud, notifications, configuration). Tenant + actor from `RequestContext`; deny-by-default; audited. |
| `@partnera/http-api` | **(M3)** Dependency-free HTTP delivery adapter (`Router` + `buildApiRouter`) over the application services; `DomainError` → HTTP status. NestJS host = deploy step. |
| `@partnera/web` | **(M4)** Three SSR React apps over the services (Business/Affiliate/Admin) reusing `@partnera/ui`: responsive/accessible shell, workflows, analytics, auth prep (`WebSession`/guard/`DevAuthProvider` seam), node HTTP host + real-data demo world. Rendered via `react-dom/server` (no bundler/hydration); `esbuild` bundles the dev server. |
| `@partnera/testing` | `SequentialIdGenerator`, `FixedClock`, `usd`/`eur`, in-memory repo/bus. |
| `@partnera/ui` | Theme-aware tokens (light/dark) + React components (Button, Badge, Tag, Progress, Spinner, forms, surfaces, data, overlays). Inline-style based. Isolated from domain. |

### Repository structure
```
D:\Partnera
├─ docs/                      # 00–22 product+eng design, plus THIS file
├─ packages/                  # 12 domain/ui packages (see table)
├─ package.json               # workspace root; scripts (verify = typecheck+lint+build+test)
├─ pnpm-workspace.yaml
├─ turbo.json                 # task graph
├─ tsconfig.base.json         # strict compiler options
├─ tsconfig.json              # solution file (project references)
├─ eslint.config.mjs          # ESLint 9 flat
├─ vitest.config.ts           # aliases @partnera/* → package source
├─ .github/workflows/ci.yml   # runs pnpm verify on push/PR
├─ BUILD_STATUS.md  DECISIONS.md  ROADMAP.md  README.md  TESTING.md  CONTRIBUTING.md
```

### Important dependencies / stack
TypeScript (strict) · pnpm 9 workspaces · Turborepo · `tsc -b` project references ·
Vitest · ESLint 9 flat + typescript-eslint · Prettier · `moduleResolution: Bundler` / `module: ESNext`.
**Target (contracts only, not wired):** PostgreSQL + Prisma (persistence); NestJS (engines) + Next.js/React (apps).
**Machine note:** install scripts blocked by default — `esbuild` is allow-listed via `package.json > pnpm.onlyBuiltDependencies`; run `npm approve-scripts` if Prisma/esbuild ever misbehave. pnpm is user-global (corepack needs admin here).

---

## 3. BUSINESS RULES

### Locked rules (invariants — never regress; a change here is a breaking decision)
1. **Platform-first.** No feature designed for one tenant. PrimeBuild is just Tenant #1.
2. **Configuration over code.** New commercial behavior = new data (offer blocks, roles, flags), not new branches.
3. **Money is append-only.** Never mutate a balance; append a ledger event; balances are always derived; corrections are compensating events.
4. **Tenant isolation.** Every operational record is tenant-scoped. Cross-tenant access only via audited operator paths or consented partnerships.
5. **Idempotency + at-most-once** on all money-affecting events (orders, conversions, payouts) and disbursements.
6. **Explainability.** Every commission records offer version + block path + attribution basis; offers are versioned.
7. **No arbitrary code execution** for extensions — declarative-first; sandboxed exception only; least-privilege scopes; validated outputs; network-wide kill-switch.
8. **Deterministic engines.** Inject `Clock`; brand ids; return `Result` for expected failures; `throw` only on broken invariants.
9. **Explicit currency.** No implicit FX; money is exact integer minor units, never floats.
10. **Separation of duties** available on money paths (approve ≠ execute); platform fraud floors tenants cannot disable.

### Configurable rules (per tenant/plan — data, interpreted by engines)
- Offer composition (all six block sections), stacking priority, per-conversion/period/budget caps, clawback windows.
- Attribution model (last/first touch), validity window, coupon/link/session precedence.
- Commission approval policy (auto after maturation / manual / conditional).
- Fraud weights, band thresholds, action mapping (within platform hard floors).
- RBAC: system roles are templates; tenants define custom roles.
- Feature flags / entitlements per plan; notification channel + category preferences.

### Temporary assumptions (provisional defaults — revisit before/at build)
- **Non-custodial / business-funded payouts** (D-050) until counsel says otherwise. Gates most of legal/payments.
- Default attribution: **last-touch, 30-day, precedence `coupon > link > session`** (D-051).
- Default stacking: **winner-takes-highest-value** (D-052).
- Separation-of-duties recommended default on money paths (D-053).
- Desktop-first Admin/Business; responsive Affiliate Portal (D-055).
- Platform config defaults: min payout `2000` minor units; default clawback `30` days.

---

## 4. TECHNICAL DECISIONS

### Architectural (accepted)
- **D-001/002** Standalone multi-tenant platform; platform-first over PrimeBuild-first.
- **D-003** Configuration over code. **D-004** Modular event-driven engines behind contracts.
- **D-005** Isolation invariant, centrally enforced. **D-006** Append-only auditable money ledger; derived balances.
- **D-007** Platform-agnostic commerce via adapters (Shopify is one adapter). **D-008** No arbitrary code exec for extensions.
- **D-009** Explainable + versioned offers/commissions. **D-010** Idempotency on money events.
- **D-200** TS + pnpm + Turborepo. **D-201** Framework-agnostic domain core. **D-202** `tsc -b` / Vitest / ESLint 9 / Prettier.
- **D-203** `moduleResolution: Bundler`. **D-204** Target Postgres+Prisma / NestJS+Next (contracts this phase). **D-205** Data-driven RBAC with permission catalog.

### Implementation conventions
- Ids are **branded types** (`UserId`, `OfferId`…), never bare strings. Money is `Money` (bigint), serialize via `MoneyJSON`.
- Expected failures → `Result<T, DomainError>`; broken invariants → `throw` (`invariant`, `InvariantViolation`).
- Time via `Clock`; never `Date.now()` in engine logic. `import type` for type-only imports (lint-enforced).
- Tests live beside source as `*.test.ts`, excluded from build output; Vitest resolves `@partnera/*` to **source** (no prior build needed).
- Engines depend only on `@partnera/core`, never on each other. TS strict; no `any` without justification.

### Rejected / explicitly-not-done ideas
- ❌ A rigid, fixed-list affiliate app; ❌ Shopify-only tool; ❌ a PrimeBuild internal system.
- ❌ Untrusted/arbitrary extension code in the core runtime.
- ❌ Hardcoded per-tenant commission math; ❌ hardcoded role checks (RBAC is data).
- ❌ Coupling the domain to a framework now (frameworks are later delivery layers).
- ❌ Mutable balances / editing money records (append-only only).

---

## 5. IMPLEMENTATION STATUS

- **Completed modules:** Phase 0 design (docs 00–24); MM2 Foundation (12 pkgs, 47 tests); MM3 Persistence & Money Spine (16 pkgs, 84 tests); **MM4 Delivery & First UX** (17 pkgs, 98 tests: `@partnera/web` — Business/Affiliate/Admin apps, workflows, analytics, auth prep, demo world; `QueryService` added to `application`).
- **Current module:** none in progress — awaiting review + go-ahead.
- **Remaining modules (order):** **Mega Module 5 — Live Infrastructure & Pilot** (Prisma-backed store on live Postgres + NestJS/Next host + auth provider + Shopify adapter + client enhancement) → Phases 2–5 (see §9 and ROADMAP.md).

### Current blockers
- **Human go-ahead required** to start the next module (design-only guardrail is explicit; do not start without it).
- **D-106 custodial-vs-non-custodial** is counsel-gated and blocks the real payments build (non-custodial assumed meanwhile).
- **No git remote + `gh` not installed** on this machine → foundation is not backed up off-disk.

### Known technical debt / gaps (intentional at this stage)
- No DB/Prisma schema, no API/HTTP/NestJS, no apps, no real auth provider, no commerce adapter, no payments impl.
- Offer engine `level` and `bonus` calcs are modeled but return an explicit error (need aggregate state → specialized evaluators later). Period/budget limits likewise deferred.
- Balances are derived by full fold — needs snapshots/materialized views at scale (invariant preserved; optimization is build-phase).
- Doc drift: `docs/22-engineering.md` cites "D-100…D-107" as *decided* for the stack, but in `DECISIONS.md` those IDs are the **open/deferred** ones; the foundation decisions are **D-200–D-205**. Cosmetic; fix when convenient.
- No data import/migration design, i18n/l10n, a11y standard, or SLA/DR spec yet (scheduled for later phases).

---

## 6. CURRENT KNOWLEDGE

**Implementation summary.** Pure-domain logic only, deterministic and mock-free. The money spine
works in-memory end-to-end: an attributed conversion → `OfferEvaluator` → `CommissionInstruction`
→ ledger events → `foldCommission`/`projectBalances`, with `assertAppendable` rejecting illegal
transitions and second-creates. RBAC, fraud scoring, attribution, feature flags, funnels, and the
extension approval lifecycle are all implemented and tested.

**Known limitations.** Everything requiring I/O is a contract, not an implementation (stores, buses,
auth, rails, adapters). Advanced offer calcs (level/bonus), multi-currency FX, and server-side
tracking are designed-for but unbuilt.

**Known bugs.** None known in the shipped code (47/47 tests green). Only the cosmetic doc-drift in §5.

**Strengths.** Correctness-first money model (bigint, append-only, explainable); clean acyclic
package graph; strict TS + full CI gate; determinism throughout; design internally reconciled
(risk register 21 closes contradictions A1–A4).

**Risks (ranked).**
- 🔴 Cross-tenant leakage / money-path tampering / untrusted extensions — invariants exist but real enforcement lives in the unbuilt persistence+delivery layer.
- 🔴 PrimeBuild gravity (pressure to contaminate the platform).
- 🔴 Custodial money movement → money-transmission regulation; privacy controller/processor ambiguity.
- 🟠 Chargeback-after-payout loss; two-sided cold start; no data-import design; balance-derivation cost at scale.
- 🟠 Foundation not backed up (no remote).

---

## 7. AUTHORITATIVE DOCUMENTS

Read in this order. Stop when you have what you need.

| Order | Document | Why it exists | Read when |
|---|---|---|---|
| 1 | **docs/PROJECT_CONTEXT.md** (this file) | Single source of truth; minimizes context needed. | Always first. |
| 2 | **BUILD_STATUS.md** | Where the build actually is right now. | Every session start. |
| 3 | **DECISIONS.md** | ADR log — every accepted/provisional/open decision + rationale. | Before any decision or design change. |
| 4 | **ROADMAP.md** | Phase 0→5 plan; what's authorized. | Before starting/scoping work. |
| 5 | **docs/22-engineering.md** | Stack, monorepo layout, package graph, conventions. | Before touching code. |
| 6 | **docs/02-architecture.md** | Logical architecture, engines, event flow, tenancy. | For system-level work. |
| 7 | **docs/04/05/06** (offer, tracking, commission) | The money spine in depth. | When working the core path. |
| 8 | **docs/16-roles-permissions.md**, **docs/18-security.md** | Identity/RBAC + security invariants. | Auth/security/isolation work. |
| 9 | **docs/03-data-model.md** | Conceptual entities (not a schema). | Persistence/data modeling. |
| 10 | **docs/07/08/09/10/11** (payments, fraud, partnerships, extensions, marketplace) | Domain deep-dives. | When touching that domain. |
| 11 | **docs/12/13/14/15** (surfaces + user flows) | UX/surface specs and journeys. | App/UI work. |
| 12 | **docs/17/19** (monetization, legal) | Business model + compliance obligations. | Pricing/payments/launch. |
| 13 | **docs/21-risks.md** | Risk register + self-review. | Risk/QA reviews. |
| 14 | **docs/20-glossary.md** | Canonical terminology (glossary wins ties). | When a term is ambiguous. |
| — | **TESTING.md / CONTRIBUTING.md** | Test strategy; golden-rule guardrails. | Before writing tests / PRs. |
| — | **docs/creator-marketplace/README.md** | **Architecture-locked future expansion** (Creator Economy & Content Marketplace); docs only, **not built**, **not** MM5. | Only when scoping that expansion. |

---

## 8. CURRENT AI CONTEXT (minimum viable context for a new session)

A new AI needs only this to be productive:

1. **What Partnera is:** configurable, multi-tenant, platform-agnostic affiliate/referral/partnership SaaS. Offer-as-configuration is the core bet. PrimeBuild = Tenant #1 only.
2. **Where it is:** design done; a pure-domain TS monorepo (12 packages) built and green; **no DB/API/app yet**. Awaiting go-ahead for the next module. Do **not** start a new module without explicit approval.
3. **Non-negotiable invariants:** append-only money + derived balances; tenant isolation; idempotency/at-most-once; explainable+versioned commissions; no arbitrary extension code; deterministic engines (inject `Clock`, brand ids, `Result` for expected failures); config over code.
4. **Code shape:** `core` = kernel; each engine depends only on `core`, never on siblings; `ui` isolated. Money is `Money` (bigint). Tests beside source; Vitest resolves to source.
5. **How to work:** `pnpm install && pnpm verify` (typecheck→lint→build→test) is the gate. Record decisions in `DECISIONS.md`; update `BUILD_STATUS.md` and this file when state changes. Machine: use `npm approve-scripts` if Prisma/esbuild break.
6. **Then read:** BUILD_STATUS → DECISIONS → ROADMAP → docs/22 → the specific domain doc for the task. Don't read all files.

---

## 9. NEXT WORK

**Mega Module 4 (Delivery & First UX) is done.** ✅ Delivered `@partnera/web`: three
server-rendered React apps over the existing services (Business Dashboard, Affiliate Portal,
Admin Console), a responsive/accessible shell, real workflows, ledger-derived analytics, auth
preparation (session/permission/tenant context + provider seam, no provider connected), and a
seeded demo world that runs the real money spine. `QueryService` added to `application` for
permission-gated reads. 98 green tests. **No engine interface changed.** Run: `pnpm --filter @partnera/web serve`.

**Build next: Mega Module 5 — Live Infrastructure & Pilot.**

- **What:** (a) a **Prisma-backed store** implementing the existing repository ports over live Postgres (activate `schema.prisma` + `sql/0001_init.sql`; resolve D-102b); (b) a **NestJS/Next production host** wrapping `@partnera/web`/`@partnera/http-api` (+ optional client enhancement/hydration); (c) a real **auth provider** (D-104) issuing sessions that build `RequestContext`; (d) the **first Shopify commerce adapter** feeding `NormalizedOrder`/`Refund`; (e) telemetry/health probes.
- **Why:** The product is usable in-process; activating it on real infrastructure proves one PrimeBuild conversion → payout end-to-end through the UI on live rails.
- **Prerequisites:** explicit human go-ahead; confirm D-102b, D-104 provisionally; keep D-050 non-custodial (rails empty until counsel clears D-106).
- **Acceptance criteria:**
  - `pnpm verify` stays green; the Prisma store passes the **same** repository/contract tests as the in-memory store (same ports).
  - Isolation/append-only/idempotency/concurrency enforced at the DB boundary (triggers active).
  - No engine gains a dependency on Prisma/NestJS/HTTP; the UI keeps consuming only the services.
  - One real PrimeBuild conversion → commission → approval → payout via the UI, fully audited.
  - `DECISIONS.md`, `BUILD_STATUS.md`, `CHANGELOG.md`, and this file updated.

---

## 10. CHANGE HISTORY (milestones only)

- **2026-07-11 — Phase 0 design complete.** 26-doc set (00–22) authored and self-reviewed; contradictions A1–A4 reconciled; design declared internally consistent.
- **2026-07-11 — Mega Module 2 (Platform Foundation) built & committed (`58da889`).** 12-package pure-domain TS monorepo; verified green (typecheck, lint, build 12/12, 47 tests). Decisions D-200–D-205 recorded. Push pending (no remote).
- **2026-07-12 — PROJECT_CONTEXT.md created** as the authoritative first-read context document.
- **2026-07-12 — Mega Module 3 (Persistence & Money Spine) built.** Added `persistence`, `payment-engine`, `application`, `http-api` (16 packages, 84 tests, verified green). Money spine end-to-end; canonical DB model authored. Decisions D-206–D-214. No engine interface changed. See [CHANGELOG.md](../CHANGELOG.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [23-persistence.md](23-persistence.md), [TECHNICAL_HANDOFF.md](../TECHNICAL_HANDOFF.md).
- **2026-07-12 — Mega Module 4 (Delivery & First UX) built.** Added `@partnera/web` (17 packages, 98 tests, verified green): three SSR React apps over the services, workflows, analytics, auth prep, demo world; `QueryService` added to `application`. Decisions D-215–D-218. No engine interface changed. See [24-delivery-ux.md](24-delivery-ux.md).
- **2026-07-12 — Installation Phase.** Local install made real: durable file persistence (`.partnera/data.json`, survives restarts), cross-platform launcher (`scripts/partnera.*`), `INSTALL.md`; 102 tests green. Decisions D-219/D-220. No external services connected. See [INSTALL.md](../INSTALL.md).
- **2026-07-12 — Windows desktop integration.** App icon + Desktop/Start Menu shortcuts + `open` command + PWA (installable standalone window); launcher hardened (ASCII, prereq checks, exit codes); Windows QA audited and launched via shortcut; 105 tests green. Decision D-221.

- **2026-07-12 — Creator Marketplace architecture lock (docs only).** Authored a 33-document
  future-expansion package ([docs/creator-marketplace/](creator-marketplace/README.md)): a
  **second economic system** (creators paid per **approved deliverable**; transparent 2%–4%
  platform fee) beside the affiliate system, reusing the tenancy/identity/**append-only ledger**
  (new *reasons*, not a new ledger)/`PayoutRail`/fraud/persistence/web spine. Decisions
  **D-300–D-320** (+ provisional D-330–D-336). It is **not** "Mega Module 5 — Live
  Infrastructure & Pilot" (which remains the next affiliate-core step).
- **2026-07-12 — Creator Marketplace built LOCALLY (branch `feat/creator-marketplace`).**
  New `@partnera/creator-marketplace` engine → persistence (`CreatorRepository`, 16 collections)
  → `CreatorService` (permission-aware, full spine) → a **"creator" web scope** + business
  Creators section + affiliate Content Library. Demo seed runs the real creator spine; verified
  live over HTTP incl. **persistence across restart**. **18 packages, 154 tests green.** Payouts,
  AI review, and content storage are **simulated + labelled**; **external activation (real money,
  providers, Shopify, deploy, legal) not started** — gated (D-321). Certified **READY FOR LOCAL
  USE** ([FINAL_CERTIFICATION.md](creator-marketplace/FINAL_CERTIFICATION.md)). Not merged to
  `main`; not MM5.
- **2026-07-12 — Creator Configurable Business Programs & Content Operations (branch).**
  Every business now controls its own program: custom **evaluation categories → payments**
  (Partnera imposes none; PrimeBuild's $0/$10/$20/$35 is editable local data, not a global
  price), **capacity/budget waiting queues** (over-limit content waits, never auto-rejected),
  **independent pay/quality/reuse** disposition, **two advisory AI scores** (AI recommends a
  category, never sets/authorizes money), provisional plans + disclosed promotional channels
  (no billing, no paid media). PrimeBuild pilot seeded; **176 tests green**, live + restart
  verified. Decision **D-322**. Certified **PARTNERA CREATOR OPERATIONS READY FOR LOCAL PILOT**
  ([LOCAL_PILOT_GUIDE.md](creator-marketplace/LOCAL_PILOT_GUIDE.md)). Real AI/payments still
  disconnected.

*(Full history: git log + DECISIONS.md. Do not duplicate it here.)*
