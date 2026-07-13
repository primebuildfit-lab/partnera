# Shopify Integration Design — Creator Marketplace

> **Part 14.** The **future** Shopify experience. Documentation-only; no Shopify code,
> connection, or app. **Partnera owns the domain data; Shopify is an adapter and
> presentation channel** (D-314/D-007). Never let Shopify become the source of truth.

## 1. Principle

Shopify is **two** kinds of adapter:
1. **Presentation adapter** — embedded app + app blocks + storefront widgets render the
   page-builder documents ([STOREFRONT_SURFACES.md](STOREFRONT_SURFACES.md)).
2. **Commerce adapter** — normalizes Shopify orders/refunds into the existing
   `NormalizedOrder`/`Refund` contract for attribution (reuses the affiliate tracking spine),
   relevant when affiliate use of creator content drives sales (attribution method open,
   OQ-32).

Neither adapter holds domain truth; both call the same permission-gated services.

## 2. Embedded app surfaces (business owner, future)

Managed inside Shopify Admin, backed by Partnera services:
- creator-program editor · affiliate-program editor · page builder ·
- opportunity manager · submission review · creator payments ·
- content library · affiliate rank rules.

These mirror the Business Dashboard ([UX_SPECIFICATIONS.md](UX_SPECIFICATIONS.md#business-owner));
the embedded app is a **host**, not a separate product.

## 3. Storefront app blocks / widgets (future)

Merchant-addable theme sections / embeddable widgets:
- creator-program hero · available opportunities · requirements · creator testimonials ·
- affiliate content library (rank-gated) · creator application CTA · campaign cards ·
- ranks & benefits · content-download portal (for enrolled affiliates).

All render published, viewer-scoped data via the renderer core; the download portal enforces
the full access rules ([CONTENT_ACCESS_SECURITY.md](CONTENT_ACCESS_SECURITY.md)).

## 4. Boundaries (what Shopify must NOT own)

| Concern | Owner |
|---|---|
| Creators, submissions, reviews, scores | **Partnera** |
| Money: creator payments, platform fee, ledger | **Partnera** (existing ledger) |
| Content library, licenses, rank unlocks | **Partnera** |
| Identity/RBAC/tenancy | **Partnera** |
| Storefront rendering, checkout, orders | Shopify (adapter surfaces / order feed) |

## 5. Commerce adapter reuse

Where creator content is used by affiliates to drive Shopify sales, attribution reuses the
existing tracking + commission spine — the Shopify commerce adapter is the same seam the
affiliate module already targets (D-114). No new money path; creator payment and affiliate
commission stay distinct ([PRODUCT_DEFINITION.md](PRODUCT_DEFINITION.md#3-money-taxonomy--precise-distinctions)).

## 6. Auth & consent

Installing the embedded app and granting Shopify OAuth scopes is an **explicit, permissioned,
audited** business action (standing configuration). Partnera requests least-privilege scopes.
No storefront data flows to Partnera beyond what the adapter needs.

## 7. Sequencing

Shopify surfaces are a **later** phase (CM11, [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)),
after the standalone Partnera experience and the domain engines exist. The pilot
([DECISIONS.md](DECISIONS.md), CM15) validates the model before broad Shopify rollout.
