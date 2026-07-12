# Monetization — Creator Marketplace

> **Part 10 (model half).** How this module makes money. Extends the platform model in
> [../17-monetization.md](../17-monetization.md); does **not** replace it. Plan/entitlement
> matrix is in [ENTITLEMENTS.md](ENTITLEMENTS.md). No billing is built; **design intent
> only**.

## A. Transaction model (core)

Partnera earns primarily when **economic activity occurs** — a creator gets paid for
approved work:

- **2%–4% platform fee** on creator-work payments (D-310).
- **Configurable** within a global allowed range; per-business rate; promotional and
  enterprise rates within guardrails.
- **Transparent**: fee + creator net shown before terms acceptance; **snapshot-locked** at
  acceptance; never hidden, never hardcoded.
- **Charged to the business by default** (D-311); the creator receives a clearly stated net.
- **Fee preserved in the ledger** as append-only recognition events
  ([PAYMENTS_AND_FEES.md](PAYMENTS_AND_FEES.md)).

This is deliberately **not** a "pay a big subscription or you can't participate" model. The
platform grows with usage; low-friction entry maximizes marketplace liquidity.

## B. Optional business plans (additive, never gating the basic economy)

Plans offer **operational limits and premium capabilities**, they do **not** remove the
transaction model. Possible premium capabilities (labels provisional):

- more active creator campaigns; more staff reviewers;
- AI-assisted review; advanced page builder; custom branding; private creator pools;
- advanced content-library controls; automation; analytics; API access;
- Shopify storefront widgets; priority moderation;
- **reduced transaction fee** (within the global floor); enterprise agreements.

Prices are **not locked here** (no approved Partnera pricing exists for these). The
entitlement matrix uses provisional labels only ([ENTITLEMENTS.md](ENTITLEMENTS.md)); final
pricing is OQ-41/OQ-05 and a business decision.

## C. Creator access (earning is free by default)

- Creators **discover, apply, submit, and get paid without any paid plan** (D-312).
- Optional **creator-premium** features may exist **later** (e.g. enhanced portfolio,
  priority discovery), but **earning access must never require payment by default**.

## D. Relationship to existing revenue streams

This module slots into the platform's designed revenue streams
([../17-monetization.md](../17-monetization.md)) as a **new transaction-fee stream**
("creator-work platform fee"), complementing business subscriptions, marketplace/extension
commissions, and partnership fees. It does not change affiliate economics.

## E. Cost drivers to price against (later)

Payout processing (rails), content storage/CDN + transcoding, AI-review compute, moderation
& dispute handling, fraud/rights intelligence, compliance/tax reporting. These inform any
future plan pricing and the fee floor; none is decided here.

## F. Guardrails (locked)

- The fee stays within **2%–4%** globally; reduced-fee plans cannot go below the platform
  floor.
- Fees are **separated from creator funds** and never commingled (ties to the custodial
  decision, D-050/D-106).
- No plan may hide the fee or make the creator net unclear.
