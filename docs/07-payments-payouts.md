# 07 — Payments & Payouts

> The payment engine moves **available balance** out to affiliates and contributors. It is designed abstractly here — **no payment provider is chosen, no rail is integrated.** Rails sit behind adapters.

## Scope

- **Withdrawals** — affiliate requests to cash out available balance.
- **Payout batches** — grouped disbursements executed by the business/platform.
- **Payment methods** — where money goes (tokenized/referenced, never stored raw).
- **Payment history** — immutable record of disbursements.
- **Payout rails** — pluggable adapters (bank/PayPal/gift-card/store-credit/etc.), decided later.

## Who pays whom (models)

Partnera must support both, as configuration per business/plan:

1. **Business-funded payouts** — the business pays its own affiliates; Partnera facilitates and records. (Common; lowest regulatory burden for Partnera.)
2. **Platform-facilitated payouts** — Partnera moves funds on behalf of businesses (higher convenience, higher compliance/money-transmission implications). **Flagged as a major legal decision** — see [19-legal-compliance.md](19-legal-compliance.md).

> Default design assumption: start **business-funded / facilitated-but-not-custodial**, and treat becoming a money transmitter as an explicit, later, compliance-gated decision.

## Withdrawal flow

```
Affiliate has Available balance
      │  requests withdrawal (amount ≤ available, ≥ min threshold)
      ▼
Withdrawal (requested) ──► commissions locked
      │  business/platform approval policy (auto/manual, fraud check)
      ▼
included in PayoutBatch
      ▼
Payment adapter executes disbursement (rail)
      ├─ success ─► commission.paid events; Withdrawal completed; history recorded
      └─ failure ─► Withdrawal failed; balance unlocked; ret/notify
```

## Payout controls

- **Minimum payout threshold** (per program/plan, configurable).
- **Payout schedule** — on-demand, or periodic batches (weekly/monthly).
- **Holds** — fraud score, unverified identity/KYC, pending disputes block payout.
- **Approval policy** — auto vs. manual, mirrors commission approval.
- **Idempotency** — a disbursement is executed at most once even under retries (critical for money).

## Payment methods

- Stored as **tokens/references** via the rail adapter — Partnera does not hold raw bank/card data.
- Affiliates may verify identity/tax details before first payout (KYC/tax gating — see legal doc).
- Multiple methods per affiliate; one default.

## Reconciliation

- Every disbursement links back to specific ledger commissions.
- Batch totals reconcile to the sum of included commissions.
- Failed/partial disbursements are recorded and reversed cleanly (balance restored).
- Platform-level reconciliation reports live in the Admin Console.

## Non-cash payouts

Points, gift cards, and store credit are "paid" by:
- Recording the reward as fulfilled in the ledger, and
- Handing off to the appropriate mechanism (store-credit adapter, gift-card issuer, points system) — again behind an adapter.

Non-cash rewards still get the same auditable lifecycle.

## Taxes & compliance touchpoints (design-level)

- Collect required tax info before payout where legally needed.
- Retain records for reporting obligations.
- Full treatment in [19-legal-compliance.md](19-legal-compliance.md).

## Interfaces

- **Commission Engine** — source of available balance; receives paid/reversed events.
- **Fraud Engine** — payout holds.
- **Notification Engine** — payout status to affiliate/business.
- **Integration Engine** — rail adapters.
- **Admin Console** — batch operation, reconciliation, dispute handling.

## Invariants

1. **At-most-once disbursement** per withdrawal (idempotent rails).
2. **No payout exceeds available balance.**
3. **Every disbursement is traceable** to specific commissions.
4. **Raw payment credentials are never stored** by Partnera.
5. **Holds are honored** before any money moves.

## Open decisions (see DECISIONS.md)
- Custodial vs. non-custodial money movement (major legal fork).
- Which rails to support first.
- KYC/tax thresholds and providers.
- Default minimum payout & schedule per plan.
