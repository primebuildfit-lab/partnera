# Creator Economy & Content Marketplace — Module Documentation

> **Status: architecture-locked, documentation-only. Implementation not started.**
> This is a **future commercial expansion** of Partnera, not part of the current
> affiliate-core release and **not** the same thing as the roadmap's
> "Mega Module 5 — Live Infrastructure & Pilot". See
> [ARCHITECTURE_RECONCILIATION.md](ARCHITECTURE_RECONCILIATION.md#naming-and-numbering)
> for the naming/numbering reconciliation.

Partnera today runs **affiliate/referral/partnership programs**: affiliates earn by
generating attributed sales. This module adds a **second, complementary economic
system** on the same platform:

- **Affiliates** earn money by generating **attributed sales** (existing system — unchanged).
- **Creators** earn money by producing **approved content** for businesses (new system).

One person may be an affiliate only, a creator only, both, or a contractor/worker for
one or more businesses. Businesses recruit creators, publish content opportunities,
review submissions (human and/or AI-assisted), pay per approved deliverable, and then
distribute the approved content to their affiliates by affiliate rank. Partnera earns
through a **transparent, configurable 2%–4% platform fee** on creator-work payments —
not by forcing every participant onto a large subscription.

## Hard scope boundary

This module is **documentation and architecture only**. No code, no migrations, no
dependencies, no payment providers, no deployment, no live UI, no changes to existing
Partnera behaviour. All existing invariants (append-only money, tenant isolation,
idempotency, explainability, config-over-code, no arbitrary code execution,
deterministic engines) are **preserved and extended**, never regressed.

## Recommended reading order

| # | Document | Read for |
|---|---|---|
| 1 | [PRODUCT_DEFINITION.md](PRODUCT_DEFINITION.md) | What every term means; the two economic systems and how they differ. |
| 2 | [USER_PERSPECTIVES.md](USER_PERSPECTIVES.md) | What each role (admin/business/creator/affiliate/staff) can do. |
| 3 | [WORKFLOWS.md](WORKFLOWS.md) · [STATE_MACHINES.md](STATE_MACHINES.md) | The opportunity → submission → review → payment → library lifecycle and its legal states. |
| 4 | [DELIVERABLE_MODEL.md](DELIVERABLE_MODEL.md) | Configurable content types and their requirements. |
| 5 | [REVIEW_AND_SCORING.md](REVIEW_AND_SCORING.md) · [AI_REVIEW_ARCHITECTURE.md](AI_REVIEW_ARCHITECTURE.md) | Human + AI-assisted evaluation; scoring; approval modes. |
| 6 | [CONTENT_LIBRARY.md](CONTENT_LIBRARY.md) · [RANK_UNLOCKS.md](RANK_UNLOCKS.md) · [CONTENT_ACCESS_SECURITY.md](CONTENT_ACCESS_SECURITY.md) | Approved-content library and rank-gated affiliate access. |
| 7 | [DATA_MODEL.md](DATA_MODEL.md) | Implementation-ready entity specifications. |
| 8 | [PAYMENTS_AND_FEES.md](PAYMENTS_AND_FEES.md) | Provider-independent payment + platform-fee architecture on the existing ledger. |
| 9 | [MONETIZATION.md](MONETIZATION.md) · [ENTITLEMENTS.md](ENTITLEMENTS.md) | Transaction-first business model + plan/entitlement matrix. |
| 10 | [TRUST_SAFETY_AND_DISPUTES.md](TRUST_SAFETY_AND_DISPUTES.md) | Fraud, moderation, disputes, appeals. |
| 11 | [PERMISSIONS.md](PERMISSIONS.md) · [SECURITY_MODEL.md](SECURITY_MODEL.md) | Permission matrices and tenant/creator isolation. |
| 12 | [API_AND_EVENTS.md](API_AND_EVENTS.md) | Provider-independent API contracts + append-only domain events. |
| 13 | [PAGE_BUILDER_ARCHITECTURE.md](PAGE_BUILDER_ARCHITECTURE.md) · [STOREFRONT_SURFACES.md](STOREFRONT_SURFACES.md) · [SHOPIFY_INTEGRATION.md](SHOPIFY_INTEGRATION.md) | Business-branded public pages; presentation channels; Shopify as an adapter. |
| 14 | [ANALYTICS.md](ANALYTICS.md) · [NOTIFICATIONS.md](NOTIFICATIONS.md) | Metrics and messaging per role. |
| 15 | [UX_SPECIFICATIONS.md](UX_SPECIFICATIONS.md) · [NAVIGATION.md](NAVIGATION.md) | Screen-by-screen specs and navigation. |
| 16 | [LEGAL_REVIEW.md](LEGAL_REVIEW.md) | Counsel-review checklist (no legal conclusions). |
| 17 | [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md) | CM0–CM16 phased plan from docs to installed product. |
| 18 | [ARCHITECTURE_RECONCILIATION.md](ARCHITECTURE_RECONCILIATION.md) | Reuse vs. new engines vs. conflicts against existing Partnera. |
| 19 | [DECISIONS.md](DECISIONS.md) · [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) | Locked decisions and genuinely open ones. |
| 20 | [SELF_AUDIT.md](SELF_AUDIT.md) · [RISK_REGISTER.md](RISK_REGISTER.md) | Contradiction/risk sweep of this package. |

## Locked decisions (summary)

Creator Marketplace is a Partnera **module**; the affiliate and creator systems
**coexist**; one user can be both; businesses customize their own public program pages;
creators choose companies and opportunities; content is **reviewed before payment**;
human and AI-assisted review are supported; **AI never silently releases payment by
default**; approved content is unlocked by affiliate rank; Partnera earns via a
**transparent 2%–4% transaction fee**; creators are **never forced to pay** to access
earning opportunities; **payment providers move money — Partnera does not store cards**;
**Shopify is an adapter, not the platform core**; **this module is not implemented yet**.
Full list with IDs: [DECISIONS.md](DECISIONS.md).
