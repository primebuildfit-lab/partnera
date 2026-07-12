# 23 — Persistence & Money Spine (Mega Module 3)

> How Partnera became a **persistent** platform without touching the pure-domain
> engines. This documents the layers added in Mega Module 3: the persistence
> seam, the money spine end-to-end, the application/API layer, the payment
> abstraction, and the security enforcement. See also [22-engineering.md](22-engineering.md).

## Goal

Turn the verified pure-domain foundation into a persistent platform where the
append-only commission ledger is the centre of the implementation — **without
redesigning the product or the architecture**, and keeping every gate green.

## Layering

```
Delivery      @partnera/http-api        (dependency-free HTTP router; NestJS host = deploy step)
Application   @partnera/application      (permission-aware use-cases; the API core)
Persistence   @partnera/persistence      (repository ports + relational store; prisma/ + sql/)
Domain        @partnera/* engines        (UNCHANGED — offer, tracking, commission, payment, fraud, …)
Kernel        @partnera/core
```

Dependency direction is strictly downward. **No engine depends on persistence,
application, or delivery** — the acyclic graph and framework-agnostic domain
(D-201) are preserved. `@partnera/payment-engine` is a new *domain* engine and,
like every engine, depends only on `@partnera/core`.

## The persistence seam (D-206)

Repositories are built on a tiny in-memory **relational store**
(`relational/store.ts`) that enforces what a real database must:

| Guarantee | Mechanism |
|---|---|
| Append-only | Collections flagged `appendOnly` reject `replace`/`delete`; DB triggers do the same (`sql/0001_init.sql`). |
| Idempotency | Unique secondary indexes (e.g. `(tenant, platformOrderId)`, `(tenant, orderId)`); `insertIdempotent` for safe-to-retry appends. |
| Optimistic concurrency | Per-row `version`; `replace(row, expectedVersion)` throws `ConflictError` on a stale write. |
| Atomicity | `transact()` snapshots every collection and rolls back on throw. |
| Tenant isolation | Enforced in repositories: every query is scoped to the `RequestContext` tenant and asserted per row. |

Swapping to Postgres means providing a Prisma-backed store with the same
`Collection` surface. **Nothing above `unit-of-work.ts` changes.** The canonical
model lives in `prisma/schema.prisma`; append-only triggers and integrity checks
live in `sql/0001_init.sql` (D-207).

## The money spine, end to end

`TrackingService.processConversion` is the reference path (docs/02):

1. **Attribute** — `collectClaims` gathers coupon/link claims; the engine's
   `DefaultAttributionResolver` picks the winner under the tenant policy.
2. **Convert** — a `Conversion` is recorded idempotently (one per order).
3. **Evaluate** — every active offer is run through `OfferEvaluator`; the
   highest-value instruction wins (D-213, winner-takes-highest).
4. **Commission** — `commission.created` is appended to the ledger via
   `appendGuarded` (read prior → `assertAppendable` → append, in one transaction).
5. **Gate (optional)** — risk signals are scored; a non-`allow` action appends
   `commission.held` and opens a fraud case (money is held, never deleted).

Money out (`PaymentService`): `requestPayout` (from *approved* commissions only,
amount computed from the ledger) → `approve` (separation of duties, D-053) →
`execute` (calls the injected `PayoutRail`; on success appends `commission.paid`,
closing the spine) → `retry` on transient failure. Refunds
(`recordRefund`) reverse or reject every commission a conversion produced —
append-only compensation, never edits.

Balances are always **derived** by folding the ledger (`projectBalances`); the
`balance_snapshots` table is a rebuildable cache, never the source of truth (D-212).

## Security (Part 9)

Enforced centrally in `ServiceBase`:

- **Never trust client identifiers.** The tenant and actor come from the
  authenticated `RequestContext`; service inputs never carry a tenant id.
- **Permission validation.** Deny-by-default `PermissionEngine.require` on every
  use-case, using tenant-scoped resolved roles.
- **Audit.** Sensitive actions append to the immutable audit log.
- **Idempotency / concurrency / append-only.** Enforced at the store boundary.

### Documented assumptions (D-214)

- Tracking-pipeline permissions reuse the existing catalog (`links.manage`,
  `coupons.manage`, `commissions.adjust`). A dedicated `tracking.ingest`
  permission + ingestion service-accounts are a delivery/auth-module concern.
- Part 5's "Cancelled" and "Clawback" map to the domain's `rejected` and
  `reversed` events respectively — no engine interface was changed.
- Normalized orders carry totals, not line items, so item-scoped offers evaluate
  against an empty line set; line-level ingestion is a later adapter concern.

## What is intentionally not built here

Live Postgres/Prisma wiring, a NestJS host, an auth provider, a real commerce
adapter, and real payout rails — each is a thin, documented activation behind an
already-defined contract (D-207, D-210, D-104, D-114, D-105).
