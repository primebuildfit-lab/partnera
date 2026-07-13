# 03 — Conceptual Data Model

> **Conceptual only.** These are domain entities and relationships to align understanding — **not** a database schema. No tables, columns, indexes, or migrations are defined here. Physical modeling belongs to the build phase.

## Reading this document

Entities are grouped by engine. Each lists its purpose, the key attributes it *conceptually* holds, and its main relationships. "→" means "references / belongs to."

## Tenancy core

- **User** — a person. Attributes: identity, auth reference, profile, global status. A user can have many Memberships across businesses.
- **Organization** — optional parent grouping (agency, brand group). Owns Businesses.
- **Business (Tenant)** — the customer entity. Attributes: name, status, plan, settings, commerce integrations. Root of tenant isolation. → Organization (optional).
- **Membership** — links User ↔ Business (or Organization) with a Role. Attributes: role, status, scope.
- **Role** — named set of Permissions. May be system-defined or tenant-custom.
- **Permission** — a granular capability (e.g. `offers.create`, `payouts.approve`).

## Affiliate domain

- **AffiliateProgram** — a business's program. → Business. Attributes: name, status, recruitment mode (open/invite/marketplace), default terms, approval policy.
- **Affiliate** — a participant in one or more programs. → User (the person), → Program(s) via Enrollment. Attributes: profile, payout details reference, tier, status, risk profile reference.
- **Enrollment** — Affiliate ↔ Program membership. Attributes: status (applied/approved/suspended), tier, custom terms, joined date.
- **Application** — a request to join a program (open/invite). Attributes: answers, status, reviewer, decision trail. → Program, → Affiliate.
- **Invitation** — an invite to become an affiliate/partner. Attributes: channel, status, expiry. → Program/Business.
- **AffiliateTier / Segment** — grouping used by offers/rules. → Program.
- **PromotionalAsset** — creatives/materials affiliates can use. → Program/Campaign.

## Offer domain (see [04-offer-engine.md](04-offer-engine.md))

- **Offer** — a configured commercial rule set. → Program/Business. Attributes: type, status, scope, reward, conditions, schedule.
- **OfferRule / OfferBlock** — composable building blocks that make up an Offer (conditions, calculations, rewards). Ordered/priority-aware.
- **RewardDefinition** — what an affiliate earns: cash %, cash fixed, points, gift card, store credit, hybrid. → Offer.
- **OfferScope** — what the offer applies to: all / product / collection / category / brand / SKU set. → Offer.
- **OfferTemplate** — a reusable offer blueprint (may originate from marketplace/extension). → Marketplace item.

## Campaign & partnership domain

- **Campaign** — a time-bounded promotional context. → Business/Program. Attributes: type, window, eligibility, offers, goals.
- **Partnership** — a B2B relationship between two Businesses. Attributes: type (revenue-share, cross-promo, referral-exchange…), terms, split, status. → Business A, → Business B. See [09-partnerships.md](09-partnerships.md).
- **PartnershipTerm** — the agreed split/conditions of a partnership.
- **Contest / Leaderboard** — competitive campaign construct. → Campaign.

## Tracking domain (see [05-tracking-engine.md](05-tracking-engine.md))

- **ReferralLink** — a trackable link. → Affiliate, → Campaign/Offer. Attributes: code, destination, status.
- **Coupon** — a trackable discount code used for attribution. → Affiliate/Campaign.
- **Click** — a recorded click event. → ReferralLink. Attributes: timestamp, signals (device, geo, referrer) for fraud/attribution.
- **Session** — attribution session tying clicks/coupons to a visitor over time.
- **Conversion** — an attributed value event (usually an order). → Order, → Affiliate, → Offer/Campaign, → attribution basis.
- **Order (normalized)** — a purchase ingested from a commerce platform via an adapter. Platform-agnostic shape. → Business, → line items.

## Commission & money domain (see [06](06-commission-engine.md), [07](07-payments-payouts.md))

- **CommissionEntry** — an immutable ledger record. → Conversion, → Affiliate, → Offer. Attributes: amount, currency, state (pending/approved/locked/reversed), reason, timestamps. **Append-only.**
- **LedgerEvent** — the atomic append-only fact behind balances (created, approved, reversed, clawed-back, paid).
- **Balance (derived)** — computed from LedgerEvents: pending, available, paid, clawed-back. Not stored as mutable truth.
- **Withdrawal / PayoutRequest** — an affiliate's request to cash out available balance. Attributes: amount, method, status.
- **PayoutBatch** — a grouped disbursement run. → many Withdrawals.
- **PaymentMethod** — an affiliate's payout destination (reference/tokenized). → Affiliate.
- **Transaction (rail)** — record of an actual external disbursement via a payment adapter.

## Fraud domain (see [08-fraud-engine.md](08-fraud-engine.md))

- **RiskSignal** — a single observation (VPN hit, duplicate device, self-purchase match, velocity spike).
- **RiskScore** — aggregate risk for an affiliate/conversion/account at a point in time.
- **FraudCase / ReviewItem** — a flagged item routed to manual review. Attributes: status, evidence, decision.
- **Rule (fraud)** — configurable heuristic producing signals.

## Extension & marketplace domain (see [10](10-extensions.md), [11](11-marketplace.md))

- **Extension** — a submitted capability (template/module/integration/widget). Attributes: type, manifest, version, status (submitted/approved/published/deprecated). → Contributor.
- **Contributor** — a developer/business that submits extensions. Attributes: identity, payout terms, agreement acceptance.
- **MarketplaceListing** — a published, installable catalog item. → Extension/OfferTemplate.
- **Installation** — a tenant's adoption of a listing. → Business, → Listing.
- **ContributorCommission** — earnings owed to a contributor per policy. (Runs through the same ledger discipline.)
- **ApprovalRecord** — review decision & audit trail for a submission.

## Platform-ops domain

- **APIKey** — tenant/integration credential (scoped). → Business.
- **Integration** — a configured connection to a commerce platform or external system. → Business, → adapter type.
- **NotificationTemplate / Message** — templated comms and delivery records.
- **FeatureFlag** — capability gate (global/plan/tenant/rollout).
- **AuditLog** — immutable record of sensitive actions. Global + tenant-scoped views.
- **License / Plan** — the tenant's entitlement set. See [17-monetization.md](17-monetization.md).
- **SupportTicket / ModerationItem** — operational work items.

## Key invariants

1. **Every operational entity is tenant-scoped** (directly or via parent).
2. **Money entities are append-only**; balances are derived, never edited in place.
3. **Attribution is explicit**: every Conversion records *why* it was attributed (link/coupon/session/campaign).
4. **Offers are data**: an Offer + its Blocks fully determine commission math; no math lives in code specific to a tenant.
5. **Approvals leave a trail**: applications, extensions, payouts, and partnerships all carry decision history.

## Explicitly out of scope here

Physical schema, storage engine, indexing, sharding/partitioning, exact field types, and PII storage/tokenization strategy — all deferred to the build phase and tracked in [../DECISIONS.md](../DECISIONS.md).

---

> **Nota (2026-07-13):** este documento cubre el **núcleo de afiliados**. El modelo de datos
> **físico completo** del runtime (59 colecciones, incluyendo Creator Marketplace y Shopify) está en
> [PERSISTENCE_INVENTORY.md](PERSISTENCE_INVENTORY.md), el esquema Prisma
> (`packages/persistence/prisma/schema.prisma`, 60 modelos) y
> [creator-marketplace/DATA_MODEL.md](creator-marketplace/DATA_MODEL.md). Ver decisión D-325.
