# ROADMAP

Phased plan from design → first build → scale. **Nothing past Phase 0 is authorized yet.** Phases are deliberately sequenced so the money spine is proven before breadth is added.

Guiding rule: **prove the core (offer → tracking → commission → payout) end-to-end with one real tenant before scaling features or tenants.**

---

## Phase 0 — Product Design ✅ (current)

Documentation only. Understand the product completely.
**Exit criteria:** this doc set reviewed & accepted; critical open decisions identified.

---

## Phase 1 — Foundations & the Money Spine (Recommended First Build)

> Smallest thing that proves the thesis with **PrimeBuild as Tenant #1**, without over-building.

> **Progress (2026-07-12):** MM3 delivered the money spine **in-process** (tenancy/RBAC,
> offers + versioning, tracking + attribution, append-only ledger, non-custodial payouts,
> fraud gating) against real repositories. **MM4** added the MVP **surfaces** — Business
> Dashboard, Affiliate Portal, and Admin Console (`@partnera/web`, SSR over the services)
> with real workflows and ledger-derived analytics (98 tests). Remaining for Phase 1 exit:
> activate live persistence + a production host + a real auth provider + one commerce
> adapter (Mega Module 5).

**In scope**
1. **Tenancy & identity core** — users, businesses (tenant isolation), memberships, RBAC.
2. **Offer Engine (MVP)** — a subset of blocks covering the most common offers (percentage, fixed, per-product, coupon/link attribution, basic tiers). Offer versioning + dry-run simulation.
3. **Tracking Engine (MVP)** — referral links + coupon attribution, last-touch, configurable window; idempotent order ingestion via **one** commerce adapter (the pilot platform).
4. **Commission Engine + Ledger** — append-only, lifecycle states, clawbacks, derived balances.
5. **Payments (MVP, non-custodial)** — withdrawals, approvals, one payout path; reconciliation. Assume **D-050 non-custodial** unless counsel changes it.
6. **Fraud (MVP)** — core signals (self-purchase, duplicates, velocity), risk score, manual review queue, payout holds + platform floors.
7. **Surfaces (MVP)** — Business Dashboard (program, offers, affiliates, payouts), Affiliate Portal (links/coupons, earnings, withdrawals), minimal Admin Console (tenants, approvals, fraud, health).

**Explicitly deferred to later phases:** partnerships, marketplace, extensions, advanced offer blocks, multi-platform, advanced analytics, AI fraud, non-cash rewards at scale.

**Exit criteria:** a real conversion for PrimeBuild flows link/coupon → attributed conversion → commission → approved → payout, fully audited, with fraud gating.

**Prerequisite decisions:** D-100–D-106, D-110 (at least provisionally).

---

## Phase 2 — Configurability & Depth

- Full Offer Builder block set (recurring/subscription, level, contest, hybrid rewards, formula "Design Your Own").
- Campaigns (launch/seasonal/contest/exclusive) + leaderboards.
- Non-cash rewards (points/gift-card/store-credit adapters).
- Richer analytics/reporting & forecasting.
- Stronger fraud (device/VPN intelligence, graph/ring detection).
- Additional payout rails.

**Exit criteria:** a second, different business onboards self-serve with rules PrimeBuild never had — **zero platform code**.

---

## Phase 3 — Network Effects

- **Business Partnerships** (revenue share, cross-promo, referral exchange) reusing the money spine.
- **Multi-platform**: second/third commerce adapters.
- Organization/agency multi-business management.
- Server-side tracking & identity stitching.

**Exit criteria:** two businesses run a partnership entirely via configuration, with split commissions reconciling for both.

---

## Phase 4 — Ecosystem & Monetization

- **Extension ecosystem** (declarative-first, sandboxed) + approval workflow.
- **Marketplace** (offers/templates/extensions, contributor commissions, reuse-for-future-customers).
- **Billing & plans/entitlements** (subscriptions; marketplace/partnership fees per D-108/D-109).
- Advanced monetization (enterprise/agency/white-label groundwork).

**Exit criteria:** a third-party contributor publishes an approved extension; another tenant installs it; contributor earns via the ledger.

---

## Phase 5 — Scale & Enterprise

- Enterprise plans, SLAs, white-label, API/usage pricing.
- Multi-currency/FX, broader jurisdictions & compliance depth.
- AI-assisted fraud & analytics.
- Performance/scale hardening for thousands of tenants.

---

## Future expansion track — Creator Economy & Content Marketplace (architecture-locked)

A **separate, approved future expansion**, documented and architecture-locked in
[docs/creator-marketplace/](docs/creator-marketplace/README.md). It adds a **second economic
system** — creators paid per **approved deliverable** — alongside the affiliate system, on the
same tenancy/identity/ledger/fraud spine, plus a business page builder and rank-gated content
library. Partnera earns via a transparent **2%–4%** platform fee.

- **Status:** documentation only; **implementation not started**. Not part of the current
  affiliate-core release and **not required for current local usability**.
- **Numbering:** its own **CM0–CM16** phase track (see the module's
  [IMPLEMENTATION_ROADMAP.md](docs/creator-marketplace/IMPLEMENTATION_ROADMAP.md)); it is **not**
  "Mega Module 5 — Live Infrastructure & Pilot", which remains the next affiliate-core step.
- **Sequencing:** recommended **after** Phase 1 exit (live infrastructure), reusing it; needs
  explicit human go-ahead and counsel sign-off on money/rights before any build.
- **Local build (branch `feat/creator-marketplace`):** implemented through a **local pilot** —
  the full creator spine plus **configurable business programs** (custom categories→payments,
  capacity/budget waiting queues, independent pay/quality/reuse, two-score advisory AI). Payouts/
  AI/storage **simulated**; 176 tests green; certified **READY FOR LOCAL PILOT**. External
  activation (real money, providers, Shopify, deploy, legal) **not started** — gated.
- **UX pass (same branch):** plain commercial language (no architecture jargon), role-focused
  homes + first-run checklist + Setup guide, itemised simulated-payment breakdown with
  confirmations. 180 tests green; live daily-use + restart verified; certified **PARTNERA READY
  FOR REAL-WORLD LOCAL PILOT**. Next: real-world Brian usage + final visual/pricing decisions.

## Cross-phase always-on

- Keep [DECISIONS.md](DECISIONS.md), [BUILD_STATUS.md](BUILD_STATUS.md), and [docs/21-risks.md](docs/21-risks.md) current.
- Security & compliance review gates each money-touching release.
- Never regress the invariants: isolation, append-only money, idempotency, no untrusted code, explainable commissions.
