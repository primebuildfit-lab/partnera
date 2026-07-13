# Architecture Reconciliation — Creator Marketplace

> **Part 20.** How this module maps onto the existing Partnera architecture: what to reuse,
> what genuinely needs to be new, and what conflicts to avoid. The guiding rule: **do not
> duplicate an existing capability merely because this module uses a different name.**

## 1. Reuse (do NOT rebuild)

| Existing capability | Reused for |
|---|---|
| `@partnera/core` (Money, Result, branded ids, tenancy, Clock, EventBus, errors, pagination) | All new engines/types. |
| `@partnera/auth` (data-driven RBAC, role templates, PermissionEngine) | New permission keys + roles ([PERMISSIONS.md](PERMISSIONS.md)). **No hardcoded checks.** |
| **Append-only commission ledger** (`commission-engine` + `application` ledger service) | Creator payments/fees/bonuses/reimbursements/reversals as **new reasons**, **not a new ledger** (D-315). |
| `@partnera/payment-engine` (`PayoutRail`, append-only payout events) | Creator payouts via the **same** rail abstraction (D-313). |
| `@partnera/fraud-engine` (signals→bands→actions, hard floors, cases) | Creator-domain signals + moderation cases ([TRUST_SAFETY_AND_DISPUTES.md](TRUST_SAFETY_AND_DISPUTES.md)). |
| `@partnera/notification-engine` | New event types, same channels/preferences/retry. |
| `@partnera/analytics` | Role-scoped creator metrics/funnels. |
| `@partnera/platform` (feature flags/entitlements, audit, config, **nav registries**) | Entitlement matrix, audit, nav ([ENTITLEMENTS.md](ENTITLEMENTS.md)/[NAVIGATION.md](NAVIGATION.md)). |
| `@partnera/persistence` (repository ports, relational store, append-only/idempotency/concurrency) | New entities behind the **same** seam (D-206). |
| `@partnera/application` (permission-aware services, `QueryService`, `RequestContext`) | New services; identical authz/tenancy/audit discipline. |
| `@partnera/http-api` (`Router`) | New routes, same adapter. |
| `@partnera/web` (SSR shell, `@partnera/ui`, auth prep) | Creator Portal + new sections; same shell. |
| Adapter pattern + `NormalizedOrder` (Shopify/commerce) | Shopify as adapter; attribution of content-driven sales. |
| Marketplace surface (docs 11) | Discovery/liquidity concepts. |

## 2. Genuinely new (needs new engines/entities)

- **Creator identity graph** — CreatorProfile/Skill/Portfolio/CompanyRelationship (a new
  actor type; **not** a tenant, D-316).
- **Opportunity/submission/review engines** — content lifecycle + scoring + revisions +
  approval modes (no analogue in the affiliate spine).
- **AI review seam** — `AIReviewer` contract + run records (new).
- **Content library** — assets, licenses, usage rules, rank unlocks, signed access (new).
- **Platform-fee-on-work** — fee snapshot + recognition semantics on the existing ledger
  (new **reasons**, not a new ledger).
- **Page builder** — block-document model + channel renderers (new, but reuses `ui`/config).

## 3. Conceptual mapping (avoid duplicate systems)

| Creator term | Affiliate analogue | Same or new? |
|---|---|---|
| Creator Program | Affiliate Program | New entity, mirrored shape. |
| Content Campaign | Campaign | New entity, same "time-bounded context" idea. |
| Content Opportunity | Offer | **Different** — pays for **work**, not **sales**; do not overload `Offer`. |
| Creator Payment | Commission | **Same ledger**, different **reason**; distinct concepts. |
| Rank Unlock | (affiliate tiers) | Reuse tier source where possible (OQ-40). |
| Business page builder | (surfaces) | New capability; reuses `ui`. |

## 4. Naming and numbering

- The affiliate-core roadmap reserves **"Mega Module 5 — Live Infrastructure & Pilot"**. The
  brief's "MEGA MODULE 5 — Creator Economy" label **collides** with that. Resolution: this
  module is the **Creator Marketplace**, an **architecture-locked future expansion** on its
  own **CM0–CM16** phase track, **not** MM5. MM5 stays "Live Infrastructure & Pilot" (D-318).
- Decision IDs use the **D-300 series** (this module), leaving D-222+ for the Live-Infra
  module and never overwriting D-001…D-221.
- No new term overrides the root [glossary](../20-glossary.md); shared terms defer to it.

## 5. Schema conflicts to avoid

- Do **not** add a second money ledger; extend reasons on the existing one.
- Do **not** model a creator as a Business/Tenant (would break isolation semantics).
- Do **not** overload `Offer` for opportunities (different evaluation semantics).
- Keep new tables tenant-scoped where they belong to a business; creator-actor tables are
  cross-tenant with per-relationship gating (D-316); physical tenancy inherits open D-102b.

## 6. Scope-dilution guardrails

- The affiliate core is the load-bearing product; Creator Marketplace must not destabilize
  it. It ships **after** affiliate-core is live (recommended), reusing that infrastructure.
- Every reuse above is a reason **not** to fork the platform. New engines are added only
  where the affiliate spine has no equivalent.

## 7. Migration sequencing

Types (CM1) → engines (CM2) → persistence (CM3) → surfaces (CM4–CM7) → review/AI (CM8–CM9) →
payments (CM10) → channels (CM11) → local (CM12) → certify (CM13) → activate (CM14) → pilot
(CM15) → launch (CM16). Each step is additive and green; no existing engine interface changes
unless a phase adds one safely. See [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md).
