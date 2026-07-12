# Trust, Safety, Fraud & Disputes — Creator Marketplace

> **Part 11.** Protection for both sides of the marketplace. Reuses `@partnera/fraud-engine`
> (weighted signals → bands → actions, platform hard floors) and the review-case/audit
> spine; adds creator-domain signals and a dispute process. Documentation-only.

## 1. Threats and mitigations

| Threat | Mitigation |
|---|---|
| **Stolen / reused content** | Duplicate + reverse-search + perceptual-hash indicators on upload; provenance ref; creator attestation. |
| **Reused submissions** (across businesses) | Cross-job duplicate detection (privacy-preserving hashes); flag, not auto-reject. |
| **Deceptive AI-generated content** | AI-origin likelihood flag; disclosure requirement; policy per opportunity. |
| **Fake creators** | Identity verification levels; KYC above payout thresholds; reputation history. |
| **Fake businesses** | KYB for payout-capable businesses; funding verification. |
| **Payment fraud** | Idempotency, SoD, fraud floors, funding checks, anomaly detection. |
| **Duplicate submissions** | Idempotency keys + content hashing. |
| **Manipulated metadata** | Tamper detection; server-side re-derivation of technical specs. |
| **Copyright / unauthorized music** | Rights attestation + automated indicators; mandatory-pass legal gate. |
| **Brand impersonation** | Brand-mark checks; business verification; takedown path. |
| **Collusion** (creator↔reviewer, affiliate↔business) | Graph signals; SoD; recusal; audit. |
| **Affiliate misuse / out-of-license use** | License enforcement, permitted-platform/geo limits, watermarking, usage tracking. |
| **Unfair rejection / non-payment** | Dispute + appeal; different-reviewer routing; SLA + escalation. |
| **Chargebacks** | Reversal handling incl. platform-fee reversal; recovery policy. |
| **Harassment / retaliation** | Reporting, moderation, suspension/ban; protected dispute participation. |

## 2. Verification levels

- **L0 unverified** — can browse; limited/none earning.
- **L1 email/handle verified** — can apply/submit.
- **L2 identity (KYC) / business (KYB) verified** — required above payout thresholds and for
  premium participation (thresholds open, OQ-22).
- **L3 enhanced** — enterprise/high-value; additional checks.

Platform **fraud floors** (D-054) block payouts below the required verification level;
tenants cannot disable them.

## 3. Moderation

- **ModerationCase** (reuses fraud review-case discipline): subject, reason, evidence,
  assigned moderator, decision, escalation. Queues for content-safety, rights, impersonation,
  and abuse.
- **Separation of duties / recusal**: a moderator with any relationship to the parties is
  recused; content approval ≠ moderation ≠ payment.
- Actions: warn, request change, restrict, hold payout, suspend, ban, escalate.

## 4. Disputes

- **Window**: default 14 days after decision/payment (D-332, OQ-32-adjacent), configurable.
- **Escrow-like states without improper custody**: while a dispute is open, the relevant
  payable can be **held** as a **ledger state** — funds sit with the provider, not Partnera
  ([PAYMENTS_AND_FEES.md](PAYMENTS_AND_FEES.md#6-funding-models-open--oq-03)).
- **Process**: `open → evidence → under_moderation → resolved_{creator|business|split}`
  (or `escalated`) — see [STATE_MACHINES.md](STATE_MACHINES.md#5-dispute).
- **Both-sides appeals**: creators can appeal rejections/non-payment; businesses can dispute
  quality/rights/chargebacks. Appeals never return to the sole original decider.
- **Resolution** drives compensating ledger events (pay, reverse, split); everything audited.

## 5. Reviewer conflicts & fairness

- No self-review; no reviewing where a relationship exists; multi-reviewer for high value.
- Reputation impact of a contested decision is **dampened** until resolution.
- Automated decisions carry **appeal rights** (OQ-26) and human re-review.

## 6. Suspension, bans & legal

- **Suspension** (reversible) and **permanent ban** (terminal) for creators or businesses,
  with audited cause and appeal.
- **Law-enforcement response & data preservation**: CSAM and unlawful content trigger
  immediate block, preservation (lawful hold overrides normal deletion), and escalation per
  [LEGAL_REVIEW.md](LEGAL_REVIEW.md). Evidence retained through the legal window.

## 7. Two-sided protection summary

- **Creators** are protected from non-payment, unfair rejection, out-of-license reuse, and
  retaliation.
- **Businesses** are protected from stolen/duplicate/deceptive content, rights violations,
  and fraud.
- The platform is protected by verification floors, SoD, idempotency, and audit — the same
  spine that protects affiliate money today.
