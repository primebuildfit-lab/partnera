# 06 — Commission Engine & Ledger

> The commission engine turns attributed conversions into **money owed**, tracked in an **append-only, auditable ledger**. This is the most correctness-critical part of Partnera. Rule of thumb: *money is never edited, only appended.*

## Responsibilities

- Receive commission instructions from the Offer Engine.
- Record them as **immutable ledger events**.
- Manage the **lifecycle** of each commission (pending → approved → paid, plus reversal/clawback).
- Derive **balances** (pending / available / paid / reversed) from events.
- Coordinate with **Fraud** (holds) and **Payments** (payouts).
- Produce a full **audit trail** for every cent.

## Append-only ledger

- The source of truth is a stream of **LedgerEvents**: `commission.created`, `commission.approved`, `commission.reversed`, `commission.clawed_back`, `commission.paid`, `adjustment.made`.
- Balances are **derived** by folding events — never stored as an editable number.
- Corrections are **new compensating events**, not edits. Nothing is deleted.
- Every event carries: tenant, affiliate, conversion, offer + offer version, block path (why), amount, currency, actor, timestamp, reason.

## Commission lifecycle (states)

```
                 ┌─────────── reversed (return/refund/fraud) ◄──┐
                 ▼                                               │
created ──► pending ──► approved ──► locked ──► paid             │
   │           │            │                                    │
   │           └── held (fraud/manual) ──────► (release/reject) ─┘
   └── rejected (invalid attribution)
```

- **created / pending** — recorded, awaiting approval window & checks.
- **held** — fraud or manual review paused it; can release or reject.
- **approved** — passed checks & approval policy; counts toward *available* balance after any maturation period.
- **locked** — included in a payout batch (no longer withdrawable independently).
- **paid** — disbursed; payout transaction linked.
- **reversed / clawed_back** — order refunded/returned/fraudulent within window; compensating event reduces balance.
- **rejected** — never valid (bad attribution, duplicate).

## Approval policy (configurable)

Businesses choose how commissions get approved:
- **Auto-approve** after a maturation window (e.g. N days past return window).
- **Manual approval** by business finance/manager.
- **Conditional** (auto below a threshold, manual above; manual if fraud score high).

Approval policy is configuration, not code.

## Clawbacks & reversals

- Every offer has a **clawback window** tied to the business's return/refund policy.
- A refund within the window emits a reversal event; balance adjusts.
- Reversals against **already-paid** commissions create a **negative balance / recoverable** that nets against future earnings per policy (configurable: net-forward vs. write-off).

## Currency & precision

- All amounts carry an explicit **currency**; no implicit conversion.
- Money stored as exact integer minor units (conceptually) — **never floats** — to avoid rounding drift. (Physical representation decided in build phase, but the invariant stands.)
- Multi-currency programs keep per-currency balances; FX handling is a future concern, designed-for.

## Balances (derived views)

For each affiliate (per currency):
- **Pending** — created/held/approved-but-immature.
- **Available** — approved & matured, withdrawable.
- **Locked** — in an active payout batch.
- **Paid** — historical disbursed total.
- **Reversed / owed-back** — negative adjustments.

## Interfaces

- **Offer Engine** → instructions in.
- **Fraud Engine** → holds/releases, risk-driven approval gating.
- **Payment Engine** → consumes *available* balance, emits paid events back.
- **Tracking Engine** → reversal triggers (refunds).
- **Analytics** → reads ledger for reporting/forecasting.
- **Notification** → informs affiliate/business on state changes.

## Contributor & partnership commissions

Marketplace contributor earnings and partnership revenue-shares run through the **same ledger discipline** (append-only, auditable), so the platform has one consistent money spine rather than parallel systems.

## Invariants

1. **Append-only.** No in-place edits or deletes of money records.
2. **Every commission is explainable** (offer version + block path + attribution basis).
3. **Idempotent** creation (one conversion → at most one commission per applicable offer).
4. **Balances reconcile** to the event stream at all times.
5. **Reversals are events**, never retroactive rewrites.

## Open decisions (see DECISIONS.md)
- Default maturation window before "available."
- Net-forward vs. write-off for clawbacks on paid commissions.
- Multi-currency & FX strategy (deferred).
- Whether platform enforces a minimum clawback window for fraud protection.
