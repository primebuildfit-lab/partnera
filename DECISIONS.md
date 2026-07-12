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
