# Payments & Platform Fees — Creator Marketplace

> **Part 9.** Provider-independent payment + platform-fee architecture, integrated
> **conceptually** with Partnera's existing append-only ledger. Documentation-only.
> **Partnera does not process or store cards** (D-313); the existing ledger is **reused,
> not redesigned** (D-315). Non-custodial stance inherited from **D-050** (counsel-gated
> D-106).

## 1. Division of responsibility

**Partnera decides** (domain): who is eligible, how much is owed, **why** it is owed, who
approved it, what **platform fee** applies, and **when** payment can be released.

**The external provider moves the money**: Stripe Connect, PayPal Payouts, Wise, or another
compliant payout provider — chosen at build time behind the existing `PayoutRail`
abstraction (`@partnera/payment-engine`). No provider is referenced or connected here.

## 2. Money flow

```
Business funds payment (model per OQ-03)
      ↓
Payment authorization            → append: authorization (SoD: authorizer ≠ approver)
      ↓
Content approval (precondition)  → payable exists only after approval (D-305)
      ↓
Platform fee calculated          → append: platform_fee.recognized (rate from snapshot)
      ↓
Creator net amount calculated    → gross − fee (− other configured deductions)
      ↓
Provider processes payout        → PayoutRail: requested → approved → executing → paid
      ↓
Ledger receives append-only events   (payable, fee, payout, paid)  ◄── existing ledger
      ↓
Balances derived (never stored as truth) + receipts + audit records
```

Every money step is an **append** to the existing ledger; corrections are compensating
events; balances (creator pending/available/paid/reversed) are **derived by folding** —
exactly as affiliate commissions work today.

## 3. Ledger integration (new reasons on the existing spine)

Creator-work introduces new **event reasons / streams** alongside commission events — not a
second ledger:

- `creator_payment.payable` (on approval + authorization)
- `platform_fee.recognized` (fee at snapshot rate)
- `creator_payment.paid` (payout confirmed)
- `bonus.payable`, `reimbursement.payable` (distinct reasons; reimbursement fee-exempt by
  default, OQ-06)
- `creator_payment.reversed`, `platform_fee.reversed` (refund/chargeback/dispute)

The append-only, idempotent, at-most-once discipline (D-006/D-010/D-211) applies unchanged.

## 4. Platform fee rules (D-310/D-311)

- Default **configurable range 2%–4%**; a **global allowed range** with guardrails; a
  **per-business** rate within range; **promotional** and **enterprise-negotiated** rates
  allowed within guardrails.
- **Transparent**: the fee and the creator **net** are shown in full **before** the creator
  accepts terms. Never hidden, never hardcoded.
- **Versioned config**: fee configuration is versioned; a change **never** applies silently
  to an existing job.
- **Snapshot lock**: when a creator **accepts terms**, the applicable fee (rate + payer +
  currency + effective config version) is **snapshotted** onto the job. Authorization and
  recognition read the **snapshot**, never the live config.
- **Payer**: business by default; who bears the fee is configurable within rules but always
  disclosed pre-acceptance.

## 5. Supported money scenarios

| Scenario | Handling |
|---|---|
| **Fixed-price job** | Single payable on approval. |
| **Milestone payments** | Multiple payables; each approved+authorized+paid independently. |
| **Bonuses** | Conditional payable (`bonus.payable`) on a met threshold. |
| **Partial approval** | Approve/pay some deliverables, revise/reject others. |
| **Cancellation** | Pre-approval: no payable; release any pre-funded hold. |
| **Refunds** | Compensating `reversed` events incl. **platform-fee reversal**. |
| **Reversal / chargeback** | Post-payout loss handled via reversal; recovery per policy. |
| **Disputes** | Resolution drives compensating events ([TRUST_SAFETY_AND_DISPUTES.md](TRUST_SAFETY_AND_DISPUTES.md)). |
| **Failed payout** | `failed → scheduled` retry, or `cancelled` (audited). |
| **Platform-fee reversal** | Paired with payment reversal; fee is not kept on a reversed payment (unless policy states otherwise, disclosed). |
| **Currency** | Explicit currency; FX strategy open (OQ-07); no implicit FX. |
| **Tax-document readiness** | Data captured for future tax reporting (1099/DAC7-style); provider/threshold open (OQ-22, [LEGAL_REVIEW.md](LEGAL_REVIEW.md)). |

## 6. Funding models (open — OQ-03)

Candidates, all compatible with non-custodial framing where the provider holds funds:
1. **Charge-on-approval** — business charged when it approves; provider disburses net.
2. **Pre-funded hold** — business pre-authorizes/pre-funds at accept; released on approval;
   an **escrow-like state** implemented **without Partnera improperly holding regulated
   funds** (state lives in the ledger; money sits with the provider).
3. **Invoice/settlement** — periodic settlement for trusted/enterprise businesses.

The escrow-like states are **ledger states**, not Partnera custody. Final model is
counsel-gated (D-106).

## 7. Separation of duties & controls (D-317)

Content **approval**, payment **authorization**, and payout **execution** are distinct,
permissioned steps; where configured, no single person does all three. Platform fraud
floors (reused from `@partnera/fraud-engine`, D-054) can block payouts to unverified
identities above a threshold, and tenants cannot disable them.

## 8. Receipts & audit

Every authorization, fee recognition, payout, and reversal produces an audit record and a
receipt (business-side and creator-side) reconstructable from the ledger. Nothing about a
paid transaction is editable after the fact — only compensated.
