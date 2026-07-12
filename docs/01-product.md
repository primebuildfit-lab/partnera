# 01 — Product Overview

## What the product does

Partnera lets a business stand up a complete affiliate + referral + partnership operation:

- **Create affiliate programs** with configurable rules.
- **Recruit affiliates** (open apply, invite-only, marketplace discovery).
- **Design offers** using a building-block engine (percentage, fixed, per-product, tiered, recurring, hybrid, custom…).
- **Run campaigns** (launches, seasonal, contests, exclusive, invite-only).
- **Form business partnerships** (revenue share, cross-promo, referral exchange).
- **Track** clicks, coupons, sessions, conversions, orders — with pluggable attribution.
- **Calculate commissions** through a configurable, auditable engine.
- **Manage payouts**: balances, approvals, withdrawals across payment rails.
- **Detect fraud** with signals, risk scores, and manual review.
- **Analyze performance** for the business and for each affiliate.
- **Extend** via an approved third-party ecosystem and marketplace.
- **Scale** across many businesses and commerce platforms without switching tools.

## User types (personas)

| Persona | Lives in | Cares about |
|---|---|---|
| **Platform Operator** | Admin Console | Health of the whole network, approvals, marketplace curation, billing, fraud escalations, compliance. |
| **Business Owner / Admin** | Business Dashboard | Program performance, offer design, affiliate quality, spend vs. return, payouts owed. |
| **Business Staff** (manager, finance, marketer, support) | Business Dashboard (scoped) | Their slice: approvals, finance, campaigns, support — governed by role. |
| **Affiliate / Creator** | Affiliate Portal | Getting links/coupons, tracking conversions, earnings, and getting paid. |
| **Business Partner** | Business Dashboard (partnership context) | Shared campaigns, revenue split, joint performance. |
| **Extension Developer / Contributor** | Developer surface + Marketplace | Publishing templates/modules, approval status, contributor commissions. |

See detailed identity model in [16-roles-permissions.md](16-roles-permissions.md).

## Feature surface (map, not backlog)

### Programs & affiliates
Affiliate programs · recruitment (open / invite-only / marketplace) · applications & approval workflows · affiliate tiers & segments · promotional material library · announcements.

### Offers (the heart)
Offer Builder with composable rules; catalog of offer types (see [04-offer-engine.md](04-offer-engine.md)); "Design Your Own Offer"; per-product / collection / category / brand scoping; coupon- and link-based attribution; recurring & subscription commissions; tiers & levels; bonuses; reward types (cash, points, gift cards, store credit, hybrid).

### Campaigns
Time-limited campaigns · launches · seasonal/holiday · contests & leaderboards · exclusive / invite-only · marketplace campaigns · business-collaboration campaigns.

### Partnerships (B2B)
Cross-promotion · joint campaigns · shared commissions · referral exchanges · bundle collaborations · sponsored collaborations · revenue sharing · brand partnerships · partner-exclusive offers · (future) B2B marketplace. See [09-partnerships.md](09-partnerships.md).

### Tracking & attribution
Referral links · coupon attribution · session attribution · campaign attribution · (future) server-side tracking · cross-device considerations. See [05-tracking-engine.md](05-tracking-engine.md).

### Commissions & money
Commission ledger with lifecycle states · pending / approved / locked / clawed-back · balances · withdrawals · payout batches · payment history. See [06-commission-engine.md](06-commission-engine.md) and [07-payments-payouts.md](07-payments-payouts.md).

### Fraud & trust
Duplicate accounts · self-purchases · coupon abuse · VPN/proxy signals · referral loops · cookie abuse · multi-device · risk scoring · manual review queue · (future) AI assistance. See [08-fraud-engine.md](08-fraud-engine.md).

### Extensions & marketplace
Offer templates · affiliate templates · tracking modules · reporting modules · marketing tools · automation modules · widgets · integrations · analytics modules — all reviewed & approved; contributors earn commissions. See [10-extensions.md](10-extensions.md) and [11-marketplace.md](11-marketplace.md).

### Analytics & reporting
Business reports · affiliate reports · campaign performance · conversion funnels · payout forecasting · cohort/segment analysis.

### Platform operations
Tenant management · approvals · users & permissions · licensing · feature flags · integrations & API keys · notifications & emails · logs · audit history · system health · moderation · support · configuration · security.

## Product boundaries (this phase)

- We **design** monetization; we do not implement billing.
- We **design** integrations abstractly; we do not connect Shopify.
- We **design** the data model conceptually; we do not create databases.
- We **design** APIs as contracts/surface; we do not build endpoints.

## Success metrics (product-level, for later)

- **Configurability rate:** % of new-tenant requirements met with zero platform code.
- **Time-to-first-payout** for a new business.
- **Attribution accuracy** & disputed-commission rate.
- **Fraud caught vs. leaked** (precision/recall of risk scoring).
- **Marketplace reuse:** how often approved templates/extensions are adopted by other tenants.
- **Tenant retention & expansion** (net revenue retention).
