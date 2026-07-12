# 05 — Tracking & Attribution Engine

> Tracking answers one question reliably: **"Who should get credit for this conversion, and why?"** It must be flexible (many attribution methods), honest (auditable), and platform-agnostic (works beyond Shopify).

## Responsibilities

- Capture touch points: **clicks** (referral links), **coupon** usage, **sessions**.
- Maintain **attribution** over time (windows, models).
- Turn a purchase into an **attributed Conversion** with an explicit basis.
- Feed **fraud** signals from the same touch data.
- Report to businesses and affiliates.

## Attribution methods (pluggable)

1. **Referral link** — affiliate shares a coded link; click is recorded with signals; a cookie/session token carries attribution to purchase.
2. **Coupon attribution** — affiliate-owned coupon used at checkout maps the order to the affiliate, independent of clicks (crucial for cookieless / offline / word-of-mouth).
3. **Session attribution** — ties multiple touches to a visitor session and applies an attribution model.
4. **Campaign attribution** — conversions credited to a campaign context in addition to an affiliate.
5. **(Future) Server-side tracking** — attribution confirmed via server-to-server signals / postbacks, more robust against cookie loss and ad-blockers.

The engine treats each method as a **source of an attribution claim**; a resolution step picks the winning claim.

## Attribution models (configurable)

- **Last touch** (default, simplest, least disputable).
- **First touch.**
- **Coupon-overrides-click** (or the reverse) — configurable precedence when both exist.
- **(Future) multi-touch / weighted** — split credit across touches.

Attribution windows (click-to-conversion validity, e.g. 30/60/90 days) are configurable per program/offer.

## Attribution windows & precedence

- Each claim has a **validity window**; expired claims don't attribute.
- When multiple valid claims exist (e.g. a coupon *and* a link from a different affiliate), a **precedence policy** (configuration) resolves the winner. The chosen basis is stored on the Conversion.
- Ties and overlaps are logged for review — never silently guessed.

## Cross-device considerations

- Cookieless reality means **coupon attribution is a first-class fallback**, not a second-class one.
- Session stitching (login-based identity, hashed identifiers) is a **future enhancement**, designed-for but not built now.
- The model must degrade gracefully: if device signals are missing, coupon/campaign attribution still works.

## Data captured per touch (for attribution *and* fraud)

- Timestamp, referral link/coupon, campaign.
- Coarse device/user-agent, coarse geo, referrer.
- Session token.
- Velocity context (rate of clicks/conversions).

> Privacy: capture the **minimum** needed for attribution + fraud. Signals are used for scoring, retained per policy, and governed by [19-legal-compliance.md](19-legal-compliance.md). No selling of tracking data.

## The conversion pipeline

```
touch (click/coupon/session) ─► stored with signals
order ingested (Integration Engine, normalized) ─► order.created
attribution resolution ─► pick winning claim within window per model/precedence
Conversion created with { affiliate, campaign, basis, confidence } ─► conversion.recorded
   ├─► Fraud Engine (score/hold)
   └─► Offer Engine (evaluate) ─► Commission Engine
```

## Idempotency & correctness

- Order ingestion and conversion creation are **idempotent** (dedup on platform order id) to prevent double-crediting.
- **Refunds/cancellations/returns** flow back through Integration → tracking marks the Conversion reversed → Commission Engine claws back within the offer's clawback window.
- Every Conversion stores its attribution basis so disputes are resolvable.

## Interfaces

- **Integration Engine** delivers normalized orders/refunds.
- **Offer Engine** consumes attributed conversions.
- **Fraud Engine** consumes raw touch signals + conversions.
- **Analytics Engine** reads clicks/conversions for reports.

## Platform-agnostic stance

Tracking never assumes Shopify. Links and coupons are Partnera concepts; commerce platforms deliver orders through adapters. A new platform = a new adapter + (optionally) a way to issue/observe coupons — the tracking core is untouched.

## Open decisions (see DECISIONS.md)
- Default attribution model & window per plan.
- Coupon-vs-click default precedence.
- Whether/when to build server-side tracking and identity stitching.
- Retention period for raw touch signals.
