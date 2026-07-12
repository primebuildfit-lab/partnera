# 09 — Business Partnerships (B2B)

> Partnera is more than affiliate marketing. Businesses collaborate **with each other**. Partnerships are relationships between two (or more) tenants, governed by configurable terms — reusing the offer, tracking, commission, and ledger engines.

## Why partnerships matter

Affiliates are individuals promoting a business. **Partnerships are businesses promoting each other.** This unlocks a network effect: as more businesses join Partnera, the value of being on Partnera grows (each is a potential partner). It also seeds a future **B2B marketplace**.

## Partnership types (from the brief)

| Type | What it means |
|---|---|
| **Cross-promotion** | Each business promotes the other to its audience/affiliates. |
| **Joint campaign** | Two businesses run one shared campaign with combined creatives/goals. |
| **Shared commissions** | Conversions generate commissions split between partners. |
| **Referral exchange** | Businesses send each other referrals, tracked & reciprocated. |
| **Bundle collaboration** | Products bundled across businesses; revenue split on bundle sales. |
| **Sponsored collaboration** | One business sponsors another's campaign/affiliates. |
| **Revenue sharing** | Ongoing split of revenue from agreed sources. |
| **Brand partnership** | Long-term co-marketing relationship. |
| **Seasonal campaign** | Time-boxed collaborative push. |
| **Partner-exclusive offer** | Offers available only to a partner's affiliates/customers. |
| **(Future) B2B marketplace** | Businesses discover and initiate partnerships on Partnera. |

## The partnership object

A **Partnership** links Business A ↔ Business B with:
- **Type** (from above).
- **Terms** — the split, direction, conditions (a partnership-scoped set of offer blocks / revenue rules).
- **Scope** — which products/campaigns/audiences it covers.
- **Lifecycle** — proposed → negotiated → active → paused → ended, with both sides' acceptance recorded.
- **Governance** — who at each business can act; both parties must consent to changes.

Partnerships are **symmetric agreements**: nothing binding activates without both sides accepting, and every change is audited on both tenants.

## How partnerships reuse the engines

- **Offer Engine** — partnership terms are expressed as offers/rules scoped to the partnership (e.g. "10% of bundle revenue to Partner B").
- **Tracking Engine** — cross-business conversions attributed via shared links/coupons/campaign context.
- **Commission Engine** — splits recorded as ledger events for *both* businesses; same append-only discipline.
- **Payment Engine** — revenue-share settlements run through payouts/reconciliation.
- **Notification** — both parties see status, performance, settlements.

## Shared-commission & revenue-share mechanics

- A single conversion can generate **multiple ledger entries** (affiliate commission + partner share + platform fee) — all explainable and reconciling.
- Splits are defined in the partnership terms and versioned like offers.
- Settlement between businesses uses the same payout/reconciliation spine (business-to-business transfer, or netting), with the custodial-vs-non-custodial decision from [07-payments-payouts.md](07-payments-payouts.md) applying.

## Consent, trust & isolation

- Partnerships are the **one sanctioned cross-tenant data path** — and even then, only agreed-upon, minimal data is shared (e.g. campaign performance relevant to the split), never full tenant data.
- Both businesses must explicitly consent; either can pause/exit per terms.
- Disputes over shared commissions route to a defined resolution flow (evidence from the ledger + attribution basis).

## Future: B2B marketplace

- Businesses publish "partnership interest" profiles; others discover and propose.
- Partnera can take a **marketplace commission** on partnerships it facilitates (see [17-monetization.md](17-monetization.md)).
- Designed-for now; built later.

## Interfaces

- **Offer, Tracking, Commission, Payment** engines (reused).
- **Marketplace Engine** (future discovery).
- **Admin Console** — platform oversight, dispute escalation, partnership moderation.
- **Business Dashboard** — propose/manage/monitor partnerships.

## Open decisions (see DECISIONS.md)
- Multi-party (>2 business) partnerships now or later.
- Settlement mechanics (netting vs. direct transfer) — tied to custodial decision.
- Whether platform charges a fee on partnership-generated revenue from day one.
- Dispute-resolution authority (platform-mediated vs. self-serve).
