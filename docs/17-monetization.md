# 17 — Monetization & Business Model

> **Design, not implementation.** No billing is built. This defines *how Partnera intends to make money* and how that shapes plans/entitlements.

## Revenue streams (designed-for)

| Stream | Description | Timing |
|---|---|---|
| **Business subscriptions** | Tenants pay a recurring fee for the platform (tiered by usage/features). | Core, day one (design). |
| **Enterprise plans** | Higher tiers: volume, SLAs, advanced fraud/analytics, dedicated support. | Future. |
| **Agency plans** | Organizations managing many businesses. | Future. |
| **Marketplace commissions** | Cut of paid marketplace listings/installs. | Future. |
| **Extension commissions** | Platform share of monetized extensions; contributors earn the rest. | Future. |
| **Partnership fees** | Cut of platform-facilitated B2B partnerships/revenue-share. | Future. |
| **White-label licensing** | Rebranded Partnera for large clients/agencies. | Future. |
| **API/usage pricing** | Metered API access for programmatic use. | Future. |

## Plan/entitlement model

- **Plans** map to **entitlements** (feature flags + limits): number of affiliates, offers, campaigns, integrations, advanced fraud, analytics depth, marketplace access, API volume, partnership features.
- Entitlements are enforced via the **Feature Flag** system — capabilities gate cleanly per plan/tenant.
- Upgrading a plan flips entitlements; no code change.

## Pricing philosophy (design principles)

- **Value-aligned:** price should track the value/volume a business gets (attributed revenue, affiliates, payouts) without punishing growth so hard they leave.
- **Predictable:** businesses must forecast cost; avoid surprise fees.
- **Land-and-expand:** low-friction entry (even free/starter), expand via features, volume, marketplace, partnerships.
- **Platform-first:** pricing never bespoke to PrimeBuild; PrimeBuild buys a plan like anyone else.
- **Fees separated from float:** if Partnera ever touches payout funds, platform fees are distinct from affiliate money — never commingled (ties to custodial decision in [07-payments-payouts.md](07-payments-payouts.md)).

## Two-sided economics

- **Businesses** pay for the platform.
- **Affiliates** are (generally) free — they earn; the network effect of many affiliates increases business value.
- **Contributors** earn from the marketplace; the platform takes a share.
- **Partnerships** may generate platform fees on facilitated value.

## Cost drivers to keep in mind (for later pricing)

- Payout processing costs (rails).
- Fraud/data intelligence costs.
- Integration/infra costs at scale.
- Support & compliance overhead (esp. if custodial).

## Open decisions (see DECISIONS.md)
- Starter/free tier at launch?
- Pricing axis: flat / per-affiliate / % of attributed revenue / hybrid.
- Whether marketplace & partnership fees exist at launch or are strictly future.
- White-label timing.
- Custodial model's impact on pricing (float, fees).

> All of the above is **design intent**. Nothing here authorizes building billing or charging anyone in this phase.
