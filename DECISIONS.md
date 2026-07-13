# DECISIONS

Decision log for Partnera (ADR-style). Each entry: what was decided, why, and status. **Open** decisions are deliberately deferred (mostly to the build phase); making them now would violate the design-only constraint or lack information.

Status legend: ✅ Decided · 🟡 Provisional (recommended default, revisit) · ⏳ Open (deferred)

---

## Accepted (this phase)

### D-001 ✅ Partnera is a standalone platform, not a Shopify app / PrimeBuild module / plugin
Partnera is a multi-tenant SaaS. PrimeBuild is **Tenant #1** only.
**Why:** The mission requires serving thousands of businesses across many commerce platforms for years.

### D-002 ✅ Platform-first over PrimeBuild-first, always
No feature is designed for PrimeBuild specifically; abstractions optimize for the platform.
**Why:** Optimizing for one tenant creates rigidity that kills the platform thesis.

### D-003 ✅ Configuration over code for business rules
Offers, rules, workflows, roles, and entitlements are data interpreted by engines — not hardcoded logic.
**Why:** Businesses must express their own rules without us shipping code per tenant.

### D-004 ✅ Modular, event-driven engines behind explicit contracts
Offer, Tracking, Commission, Payment, Fraud, Notification, Extension, Analytics, Integration, Marketplace, on an Identity/Tenancy core.
**Why:** Independent evolution, scaling, and testability.

### D-005 ✅ Multi-tenant isolation is a hard, centrally-enforced invariant
Every operational record is tenant-scoped; no cross-tenant access except audited operator paths and agreed partnerships.
**Why:** Cross-tenant leakage is the cardinal multi-tenant failure.

### D-006 ✅ Money is an append-only, auditable ledger; balances are derived
No in-place edits/deletes of money records; corrections are compensating events.
**Why:** Correctness, auditability, dispute resolution, trust.

### D-007 ✅ Platform-agnostic commerce via adapters
Shopify is one adapter behind a stable internal contract; the core never assumes Shopify.
**Why:** Multi-platform reach is core to the thesis.

### D-008 ✅ No arbitrary code execution for extensions
Extensions are declarative-first; any executable exception is heavily sandboxed with least-privilege scopes and validated outputs.
**Why:** Untrusted code in a money platform is unacceptable risk.

### D-009 ✅ Every offer/commission is explainable and versioned
Commissions store offer version + block path + attribution basis; offers are versioned.
**Why:** Reproducibility and dispute resolution.

### D-010 ✅ Idempotency on all money-affecting events
Orders, conversions, and payouts processed at-most-once.
**Why:** Prevent double-counting/double-paying.

### D-011 ✅ Documentation-only in this phase
No code, DB, APIs, Shopify connection, framework/host choices, or infra.
**Why:** Explicit instruction; understand the product before building.

### D-012 ✅ Project location `D:\Partnera`, isolated from `D:\Eventra`
Separate top-level folder; Eventra/PrimeBuild untouched.
**Why:** Independent business; user directive to keep it separate.

---

## Provisional (recommended defaults, revisit before/at build)

### D-050 🟡 Start non-custodial (business-funded payouts)
Partnera facilitates/records; businesses fund their own affiliate payouts initially.
**Why:** Custodial money movement triggers heavy money-transmission/e-money regulation. Revisit with counsel. Gates much of [docs/19-legal-compliance.md](docs/19-legal-compliance.md).

### D-051 🟡 Default attribution: last-touch, coupon-capable, configurable window
Simplest, least-disputable default; coupon attribution is first-class for cookieless.
**Why:** Robust default; businesses can tune later.

### D-052 🟡 Default offer stacking: winner-takes-highest-value, configurable
Avoids accidental stacked payouts by default.
**Why:** Safe default; configurable per business.

### D-053 🟡 Separation-of-duties recommended on money paths (approve ≠ execute)
Recommended defaults; platform enforces sane minimums.
**Why:** Fraud/error protection without over-constraining small businesses.

### D-054 🟡 Platform fraud floors that tenants cannot disable
E.g. block payouts to identity-unverified accounts above a threshold.
**Why:** Protect the whole network from a single lax tenant.

### D-055 🟡 Desktop-first for Admin & Business surfaces; portal friendlier/responsive
**Why:** Operator/management workflows are data-dense; affiliates are often mobile.

---

## Accepted (Mega Module 2 — Platform Foundation)

### D-200 ✅ Language & monorepo: TypeScript + pnpm workspaces + Turborepo
End-to-end TypeScript; pnpm workspaces linked; Turborepo orchestrates cached tasks.
**Why:** One language and shared types across engines and apps; strong tooling. *(Resolves D-100 for language.)*

### D-201 ✅ Foundation is a framework-agnostic domain core
Engines are pure-domain TypeScript packages with **no** dependency on NestJS/Next/Prisma/HTTP.
**Why:** The domain must survive for years; coupling it to a framework now is exactly the debt the brief forbids. Frameworks are delivery layers added later. See [docs/22-engineering.md](docs/22-engineering.md).

### D-202 ✅ Build/typecheck via `tsc -b` project references; Vitest; ESLint 9 flat; Prettier
**Why:** Canonical single-tool build with correct ordering; fast TS-native tests; modern lint.

### D-203 ✅ Module resolution `Bundler` (ESNext)
Packages are consumed by bundled apps; no file-extension noise. Switch a package to NodeNext + `.js` or add a bundler step if native Node-ESM execution is ever required.
**Why:** Clean source now; downstream bundlers (SWC) handle the rest.

### D-204 ✅ Persistence target PostgreSQL + Prisma; delivery target NestJS + Next.js/React
Chosen as the **target** stack; modeled as contracts/interfaces this module (no live DB, no app runtime yet). *(Resolves D-102 engine choice at the logical level; physical tenancy still open. Informs D-101/D-104.)*
**Why:** Postgres fits multi-tenant + append-only ledger; NestJS maps to engine modules; Next maps to the three surfaces.

### D-205 ✅ RBAC permission engine is data-driven with a permission catalog
System roles are templates; tenants define custom roles; engines call `policy.require(...)` — no hardcoded role checks. *(Implements D-003 for auth; informs D-104.)*

---

## Accepted (Mega Module 3 — Persistence & Money Spine)

### D-206 ✅ Persistence via repository ports behind a storage-driver seam
Engines and application code depend on repository **ports**; a small in-memory relational store is the tested reference implementation. A Postgres+Prisma driver implements the same ports with **no engine or application change**.
**Why:** Makes the isolation/append-only/idempotency guarantees real at the data-access layer while keeping the domain framework-agnostic (D-201). Proves the money spine end-to-end today; the DB swap is mechanical.

### D-207 ✅ Canonical DB model authored as artifacts, not wired into the build
`packages/persistence/prisma/schema.prisma` + `sql/0001_init.sql` are the production Postgres model. Client generation + `migrate deploy` are the deploy step; they are **not** part of `tsc -b`/CI.
**Why:** Keeps the monorepo green and offline-safe on a machine that blocks install scripts; avoids coupling the build to Prisma engine binaries. Activation is a hosting concern (relates D-101).

### D-208 ✅ New Payment Engine as an append-only event stream; rails are empty abstractions
`@partnera/payment-engine` models payouts as an immutable event stream (mirrors the ledger); state is derived. Only an `UnconfiguredPayoutRail` ships — **no** provider.
**Why:** Uniform, auditable money spine (payouts + commissions on the same discipline). Non-custodial (D-050); real rails are D-105.

### D-209 ✅ Application layer = permission-aware use-case services
`@partnera/application` services resolve the principal from the `RequestContext`, enforce deny-by-default permissions, scope every access to the context tenant (**never** client input), and audit sensitive actions.
**Why:** Part 8/9 — one place where authorization, tenancy, idempotency, and audit are enforced; engines stay pure.

### D-210 ✅ Delivery via a dependency-free HTTP router; NestJS is the documented wrapper
`@partnera/http-api` maps routes to services and translates `DomainError` → HTTP status. NestJS/Express is the thin production host adapter (delivery seam), not built this module.
**Why:** Demonstrates clean Domain/Persistence/Application/Delivery separation without dragging a web framework (and its install scripts) into the green gate. D-204 target stack is unchanged.

### D-211 ✅ Append-only + idempotency + concurrency enforced at the store boundary
Append-only collections reject UPDATE/DELETE (and DB triggers do the same in SQL); unique constraints back idempotency; a per-row `version` guards optimistic concurrency; transactions snapshot/rollback atomically.
**Why:** The invariants must hold structurally, not by convention (D-006, D-010, D-005).

### D-212 ✅ Balances stay derived; snapshot table is a rebuildable cache
`balance_snapshots` exists for performance but is never the source of truth — always reconstructable by folding `ledger_events`.
**Why:** Preserves the append-only/derived-balance invariant while leaving room for scale (risks E1).

### D-213 ✅ Money-spine winner selection = winner-takes-highest-value, tie-break stacking priority
The conversion pipeline evaluates all active offers and emits one commission for the highest-value instruction (implements provisional D-052).
**Why:** Safe default; avoids accidental stacked payouts. Configurable stacking is a later-phase concern.

### D-214 🟡 Ingestion/pipeline permissions reuse the existing catalog (assumption)
Tracking pipeline operations map to `links.manage` / `coupons.manage`; refund clawbacks to `commissions.adjust`. Part 5's "Cancelled"/"Clawback" map to the domain's `rejected`/`reversed` — no engine change.
**Why:** Respects the "don't modify engine interfaces" constraint. A dedicated `tracking.ingest` permission + ingestion service-accounts is deferred to the delivery/auth module.

---

## Accepted (Mega Module 4 — Delivery Activation & First UX)

### D-215 ✅ Presentation is server-rendered React reusing @partnera/ui; no bundler/hydration
Pages are React components rendered to static HTML via `react-dom/server` (`renderToStaticMarkup`). Multi-page, progressive-enhancement, works without JS. `esbuild` bundles the node dev server for local runs.
**Why:** Stays green and offline (react is already installed; no `next build`, no install scripts, verified by tsc+Vitest), reuses the design system (no duplicated UI), and is accessible by default. Production host target (NestJS/Next) is unchanged (D-204/D-210) — this fills the seam, not the host.

### D-216 ✅ New `@partnera/web` delivery package; thin presentation over the services
Three apps (Business Dashboard, Affiliate Portal, Admin Console) consume **only** the application services. A permission-gated `QueryService` (added to `@partnera/application`) exposes the reads the UI needs and holds no business logic.
**Why:** The domain stays the single source of truth; RBAC/isolation/audit hold uniformly because the UI never reaches around the application layer.

### D-217 ✅ Authentication prepared, not connected
`WebSession` + permission/tenant context + `protectRoute` guard + a `DevAuthProvider` placeholder (no credential check, local only). OAuth/SSO/MFA are declared seams on the `AuthProvider` interface.
**Why:** Part 7 — the delivery layer needs session/permission plumbing now; the real provider is D-104. The tenant/actor always come from the session, never client input.

### D-218 ✅ Demo data is produced through the real services (money spine runs), never faked
`createDemoWorld()` seeds a tenant and then runs ingest → convert → commission → approve → payout → paid, plus a fraud hold and a refund clawback.
**Why:** "Do not fake data if persistence exists." Every dashboard number is derived from the append-only ledger and repositories.

---

## Accepted (Installation Phase)

### D-219 ✅ Local file persistence for the desktop/daily-use tier
The local runtime persists the whole relational store to a single JSON file
(`.partnera/data.json`), saved after every mutation and on shutdown (atomic
write; Date-aware serializer). First run seeds the demo through the real services;
later runs load from the file. Uses a real clock + UUID ids so records never
collide across runs.
**Why:** Makes the app genuinely usable day-to-day (data survives restarts)
**without any external database** — Postgres/Prisma remains the production tier
(D-207). The format is versioned; an incompatible bump is detected, not silently
corrupted.

### D-220 ✅ Cross-platform local launcher scripts
`scripts/partnera.ps1` (Windows) + `scripts/partnera.sh` (Unix) + `partnera.cmd`
provide install/start/stop/restart/status/update/logs/reset (+ `open`,
`install-desktop`, `remove-desktop`). Data/logs/PID live under `.partnera/`
(gitignored). Update = rebuild from local source (no remote).
**Why:** One-command install and daily operation for a non-deploying local user.

### D-221 ✅ Windows desktop integration (icon, shortcuts, PWA)
An app icon is generated by `scripts/make-icon.ps1` (System.Drawing -> `.ico`
for shortcuts + a base64 PNG embedded as `packages/web/src/brand-icon.ts` for the
web). The launcher creates Desktop + Start Menu `.lnk` shortcuts (WScript.Shell)
that run `open` (start + launch browser). The app also ships a PWA manifest +
icon routes so it is installable as a standalone windowed desktop app.
**Why:** Brian launches Partnera like any normal desktop application. All local;
the launcher `.ps1` is strictly ASCII (PS 5.1 ANSI-reads a BOM-less file) with
explicit exit codes and friendly prerequisite/error handling.

---

## Accepted (Creator Marketplace — architecture lock, not implemented)

> A separate, **architecture-locked future expansion** documented in
> [docs/creator-marketplace/](docs/creator-marketplace/README.md). Adds a **second economic
> system** (creators paid per approved deliverable) alongside the affiliate system, on the
> **same** tenancy/identity/ledger/fraud spine. **Not implemented; not part of the current
> affiliate-core release; not the same as the roadmap's MM5 "Live Infrastructure & Pilot".**
> Uses the **D-300 series** (leaving D-222+ for MM5) and the **CM0–CM16** phase track. Full
> rationale per decision in [docs/creator-marketplace/DECISIONS.md](docs/creator-marketplace/DECISIONS.md).

### D-300–D-320 ✅ Creator Marketplace locked decisions (summary)
Creator Marketplace is a Partnera **module** (D-300); affiliate + creator systems **coexist**
(D-301); one **User** can be both (D-302); businesses customize **public program pages** via a
page builder (D-303); creators **choose** companies/opportunities (D-304); content is
**reviewed before payment** (D-305); **human + AI-assisted review** both supported (D-306);
**AI never silently releases payment by default** (D-307); approved content is **rank-unlocked**
to affiliates (D-308); Partnera earns via a **transparent transaction fee, not forced
subscriptions** (D-309); fee range **2%–4%**, configurable, snapshot-locked at terms
acceptance (D-310); fee **business-paid by default**, creator sees a clear net (D-311);
creators **never pay to earn** (D-312); **providers move money — Partnera stores no cards**
(D-313, inherits D-050); **Shopify is an adapter, not the core** (D-314); creator-work money
uses the **existing append-only ledger with new reasons — no new ledger** (D-315); a creator is
an **actor, not a tenant** (D-316); **separation of duties** on creator payments (D-317);
**architecture-locked but not implemented** (D-318); content storage is a **provider-independent
seam** (D-319); content-license defaults are **conservative + explicit**, counsel-gated (D-320).
Provisional defaults D-330–D-336 (fee 3%, review SLA, dispute window, revision allowance, age/KYC,
license defaults, AI-auto limits) in the module log.

### D-321 ✅ Creator Marketplace built **locally** (branch), external activation gated
The module is implemented through **local technical certification** on branch
`feat/creator-marketplace` (new `@partnera/creator-marketplace` engine + persistence /
application / web integration; 18 packages, 154 tests green). This **supersedes the
"not implemented" clause of D-318 for local scope only**: payouts, AI review, and content
storage are **simulated and clearly labelled**; **no real money, provider, Shopify install,
deployment, or personal/financial data**. External activation (real providers, money, Shopify
production, public deploy, legal launch) remains **not started** and gated on counsel +
explicit go-ahead (CM10/CM14+). Not merged to `main`; not "Mega Module 5". See
[FINAL_CERTIFICATION.md](docs/creator-marketplace/FINAL_CERTIFICATION.md).

### D-322 ✅ Creator programs are **business-configured**; Partnera imposes no creator prices
Each business defines its **own** evaluation categories and the payment each maps to
(`EvaluationScheme`), its acceptance **capacity** and **budget**, and independent **pay/quality/
reuse** disposition per submission. AI is **advisory** (two scores + recommended category) and
**never sets or authorizes payment** — the business's saved config maps the human-confirmed
category to money. Over-limit content **waits** (`waiting_for_budget`/`waiting_for_capacity`),
it is **never auto-rejected**, and low-value content may be **retained** (internal/reusable).
PrimeBuild's **$0/$10/$20/$35** is editable PrimeBuild data, **not a Partnera global price**.
Partnera charges only its separate, transparent, snapshot-locked **2–4%** fee. Provisional
plans/trials and disclosed promotional channels exist as local config with **no billing and no
paid media**. Verified locally: **PARTNERA CREATOR OPERATIONS READY FOR LOCAL PILOT**
(176 tests, live + restart). External activation unchanged and not started.

### D-326 ✅ Driver Postgres real = write-behind sobre una tabla JSONB KV; durabilidad por-request (single-process)
El camino de escritura del store es **síncrono** (las `Collection` aplican unique/version/append-only
en memoria). Un cliente Postgres real es **async**, así que el driver productivo (`PgSqlClient`,
`packages/persistence/deploy/`) es **write-behind**: `upsert`/`remove` bufferan síncronamente y
`flush()` persiste el buffer en Postgres dentro de una transacción, invocado por el host **en cada
límite de request** (misma granularidad que el guardado JSON actual). El modelo de almacenamiento es
una única tabla **`partnera_store(collection, pk, version, data JSONB)`** que mapea el puerto
`SqlClient` 1:1 y preserva dinero (minor units string) y fechas; el esquema por-agregado
(`prisma/schema.prisma` + `sql/0002`) queda para un pase posterior de índices/analítica. **Hallazgo
honesto:** la durabilidad es **single-process** (unique/idempotencia se enforzan en memoria, no por
constraints DB) — adecuada para el pilot (un proceso), a endurecer con constraints/escrituras async
antes de multi-proceso. Los engines/servicios nunca importan `pg`. **No verificado contra Postgres
real en esta máquina** (sin `pg`, sin DB, install scripts bloqueados): la tercera variante del
contract (`run-contract-pg.ts`) la ejecuta Brian con una Postgres de desarrollo. Ver
[docs/shopify-pilot/PHASE6_LIVE_ACTIVATION_REPORT.md](docs/shopify-pilot/PHASE6_LIVE_ACTIVATION_REPORT.md).

### D-325 ✅ Persistencia alojada: selección explícita de modo + agregados como filas JSONB indexadas
El runtime tiene **59 colecciones**; el modelo Prisma canónico se extendió para cubrirlas todas
(60 modelos). Los 31 agregados nuevos (Creator Marketplace + Shopify) se modelan como **filas JSONB
indexadas**: las columnas clave/tenant/únicas se promueven a columnas Postgres reales e indexadas
(aislamiento, idempotencia, joins) y el value object completo vive en `data JSONB`. Esto refleja 1:1
la semántica de fila-completa del `Collection` en memoria, mantiene el **dinero exacto** (minor units
como string dentro de JSON; nunca float), preserva `Date`, y hace que el driver Prisma sea un mapeo
mecánico de los mismos ports. `version` respalda concurrencia optimista; las tablas append-only tienen
triggers UPDATE/DELETE-blocking (`sql/0002_creator_shopify.sql`). **La selección de persistencia es
explícita** (`PARTNERA_PERSISTENCE` = `memory` | `postgres`) con **hard-fail y sin fallback silencioso**:
`postgres` exige `DATABASE_URL` + driver; si no, `createUnitOfWork` lanza error. **Los engines nunca
importan Prisma** (Domain→ports; Persistence-Prisma→implementación de ports). El **modo local
(memoria+JSON) permanece**. El **cliente Prisma generado + una base Postgres real** son gate de
entorno/externo (no disponible en esta máquina por bloqueo de install scripts). Ver
[docs/PERSISTENCE_INVENTORY.md](docs/PERSISTENCE_INVENTORY.md) y `packages/persistence/src/config.ts`.

### D-324 ✅ Shopify is a reusable adapter package; tenant is resolved from a verified shop only
The Shopify integration is a new pure-domain adapter (`@partnera/shopify`) reused by the existing
application/persistence layers — **not a second Partnera codebase**. All request authentication is
constant-time HMAC with an **injected secret** (webhook/app-proxy/OAuth); the merchant tenant is
resolved **only** from a verified shop (never a browser-supplied value). Install → tenant
provisioning is **idempotent** and creates a **generic** tenant (no PrimeBuild-specific globals);
PrimeBuild is simply the first shop through the shared path. Webhooks are idempotent with a
dead-letter state; onboarding is persisted; environment validation refuses unsafe/mixed config.
Tokens are never stored in plain form (only a `tokenRef`) or exposed to browsers. Real app
creation, hosting/DB, deploy, and the live install are **external gates** (Brian's credentials +
consent). Verified locally: 210 tests, cross-shop isolation. See
[docs/shopify-pilot/FINAL_CERTIFICATION.md](docs/shopify-pilot/FINAL_CERTIFICATION.md).

### D-323 ✅ Creator surfaces use plain commercial language; money-moving actions require confirmation
User-facing pages must not expose internal architecture terms (tenant, ledger, append-only,
repository, domain event); enforced by an automated no-jargon test. Each role gets a focused
home (not every module on every dashboard); the business creator home carries a dismissible
**first-run checklist** and a **Setup guide** wizard. Every simulated payment shows the full
breakdown (creator payment / Partnera fee / business total / creator net) with an explicit
"simulated — no money moved" label, and **authorize / pay / publish-to-library sit behind a
`<details>` confirmation** so no accidental single click can move (simulated) money or change
distribution. Verified locally: **PARTNERA READY FOR REAL-WORLD LOCAL PILOT** (180 tests, live
daily-use across all roles + restart). External gates unchanged and not started.

## Open (deferred to later modules)

| ID | Open decision | Blocks | Notes |
|---|---|---|---|
| D-101 ⏳ | Hosting / infrastructure | Deploy | Deferred; stack (D-200) is host-agnostic. |
| D-102b ⏳ | Physical tenancy (shared schema vs. schema-per-tenant) | Persistence module | Engine (Postgres) chosen; layout open. Logical isolation invariant holds. |
| D-103 ⏳ | Eventing/queue technology | Integration module | Logical `EventBus` defined; in-memory bus shipped. |
| D-104 ⏳ | Auth provider (login/token issuance/MFA/SSO) | Auth delivery module | Domain model + permission engine shipped; provider TBD. |
| D-105 ⏳ | Payment rails & KYC/tax providers | Payments module | Gated by D-050. |
| D-106 ⏳ | Custodial vs. non-custodial (final) | Legal/Payments | D-050 provisional; needs counsel. |
| D-107 ⏳ | Extension sandbox technology | Extension runtime module | Manifest/validation/lifecycle shipped; sandbox tech TBD. |
| D-108 ⏳ | Pricing axis & starter/free tier | Business | Design intent in [docs/17](docs/17-monetization.md). |
| D-109 ⏳ | Marketplace/partnership fees at launch vs. later | Business | — |
| D-110 ⏳ | Launch jurisdiction(s) | Legal | Scopes compliance regimes. |
| D-111 ⏳ | Multi-party (>2) partnerships timing | Product | — |
| D-112 ⏳ | Multi-currency/FX strategy | Build | Invariant (explicit currency) defined. |
| D-113 ⏳ | Controller/processor stance & DPAs | Legal | — |
| D-114 ⏳ | First commerce-platform adapter(s) beyond the pilot | Build | Adapter contract defined. |

---

*Update this log whenever a decision is made or a provisional one is confirmed/changed.*
