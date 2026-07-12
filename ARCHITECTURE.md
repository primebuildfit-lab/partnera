# ARCHITECTURE

The system-level shape of Partnera as built. For conceptual/logical architecture
see [docs/02-architecture.md](docs/02-architecture.md); for the engineering
foundation see [docs/22-engineering.md](docs/22-engineering.md); for the
persistence/money-spine layer see [docs/23-persistence.md](docs/23-persistence.md).

## Layers (dependencies point downward only)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Delivery      @partnera/http-api      transport-agnostic HTTP router  │
│                                       (NestJS/Express host = deploy)   │
├─────────────────────────────────────────────────────────────────────┤
│ Application   @partnera/application   permission-aware use-cases;      │
│                                       the API core (authz, tenancy,    │
│                                       validation, idempotency, audit)  │
├─────────────────────────────────────────────────────────────────────┤
│ Persistence   @partnera/persistence   repository ports + relational    │
│                                       store; prisma/ + sql/ artifacts   │
├─────────────────────────────────────────────────────────────────────┤
│ Domain        @partnera/offer-engine  @partnera/tracking-engine        │
│  (engines)    @partnera/commission-engine  @partnera/payment-engine    │
│               @partnera/fraud-engine  @partnera/notification-engine     │
│               @partnera/extension-engine   @partnera/analytics          │
│               @partnera/auth  @partnera/platform                        │
├─────────────────────────────────────────────────────────────────────┤
│ Kernel        @partnera/core          Money, Result, ids, tenancy,      │
│                                       events, clock, pagination, errors │
└─────────────────────────────────────────────────────────────────────┘
UI            @partnera/ui   (design system; isolated from the domain)
```

**Invariant:** no engine depends on persistence, application, or delivery. Each
engine depends only on `@partnera/core`. This keeps the domain framework-agnostic
(D-201) and the graph acyclic — a Prisma/NestJS swap touches only the two upper
layers.

## The money spine (the load-bearing path)

```
touch (click/coupon)                 ← TrackingService.createLink/createCoupon/recordClick
      │
order ingested (idempotent)          ← TrackingService.ingestOrder
      │
attribution resolved                 ← DefaultAttributionResolver (engine)
      │
conversion recorded (idempotent)     ← TrackingRepository (unique per order)
      │
active offer evaluated               ← OfferEvaluator (engine); winner-takes-highest
      │
commission.created (append-only)     ← LedgerRepository.appendGuarded  ◄── CENTRE
      │  ├─ fraud gate → commission.held + FraudCase
      │
commission.approved                  ← LedgerService.approve (permission: commissions.approve)
      │
payout.requested → approved → executing → paid    ← PaymentService (SoD; PayoutRail)
      │
commission.paid (append-only)        ← closes the spine
      │
balances derived by folding the ledger (never stored as truth)
```

Refunds append `commission.reversed` / `commission.rejected` — compensation, not
edits. Everything is tenant-scoped from the authenticated context and audited.

## Persistence seam

Repositories sit on a relational store that enforces append-only tables, unique
constraints (idempotency), optimistic concurrency (`version`), atomic
transactions, and tenant scoping. The in-memory implementation is the tested
reference; `prisma/schema.prisma` + `sql/0001_init.sql` are the production model.
See [docs/23-persistence.md](docs/23-persistence.md).

## Where frameworks plug in (deploy-time, behind existing contracts)

| Seam | Contract already defined | Activation |
|---|---|---|
| Database | repository ports / `Collection` surface | Prisma-backed store (D-207) |
| HTTP host | `@partnera/http-api` `Router` | NestJS/Express adapter (D-210) |
| Auth provider | `RequestContext` + `PermissionEngine` | login/token issuance (D-104) |
| Commerce | `NormalizedOrder` ingestion | Shopify adapter (D-114) |
| Payout rails | `PayoutRail` | Stripe/PayPal/… (D-105) |
| Eventing | `EventBus` | durable/queue bus (D-103) |
