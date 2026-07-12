# 08 — Fraud & Trust Engine

> Affiliate networks attract abuse. If businesses can't trust the numbers, the platform dies. The fraud engine produces **signals**, aggregates them into **risk scores**, and routes suspicious activity to **review** — before money is paid.

## Threats to detect (from the brief + standard vectors)

| Threat | Description |
|---|---|
| **Duplicate accounts** | Same person as multiple affiliates to multiply rewards or self-refer. |
| **Self-purchases** | Affiliate buys through their own link/coupon for commission. |
| **Coupon abuse** | Public leaking of affiliate coupons, stacking, unintended discounting. |
| **VPN / proxy** | Masking location/identity to evade detection or geo rules. |
| **Referral loops** | A refers B refers A (or rings) to farm referral bonuses. |
| **Cookie abuse** | Cookie stuffing / forced clicks to claim unearned attribution. |
| **Multiple devices** | One actor simulating many users. |
| **Velocity anomalies** | Impossible click/conversion rates, spikes. |
| **Chargeback/refund farming** | Convert, claim commission, then refund. |

## Signal → Score → Review

```
raw signals (from tracking, orders, accounts, payments)
      │  configurable fraud rules produce RiskSignals
      ▼
RiskScore aggregated per {affiliate, conversion, account} over time
      │  thresholds (configurable per business/plan)
      ▼
  low → allow    medium → hold/flag    high → block + manual review
```

- **Signals** are individual observations (VPN hit, device-dup, self-purchase email match, referral-ring detection, velocity spike).
- **Risk score** aggregates weighted signals; weights/thresholds are **configuration**, tunable per tenant.
- **Actions**: allow, hold commission, require review, block payout, suspend affiliate — mapped from score bands.

## Manual review

- A **review queue** in the Business Dashboard (and Admin Console for platform-level cases).
- Each item shows evidence: signals, attribution basis, order details, history.
- Reviewer decisions (approve/reject/suspend) are **audited** and feed back as labels to improve rules.
- Businesses handle their own affiliates; the platform handles cross-tenant patterns and escalations.

## Where fraud gates money

- Between **conversion** and **approved commission** (hold suspicious commissions).
- Before **payout** (block disbursement on high risk / unverified identity).
- On **reversal** (refund farming triggers clawback + score increase).

Fraud never silently deletes money — it **holds** and **routes**, keeping the append-only ledger intact.

## Self-purchase & duplicate detection (design notes)

- Cross-reference affiliate identity/email/payment/device/address against buyer where legally permitted.
- Detect duplicate accounts via shared payout methods, devices, contact info, behavioral similarity.
- Referral-ring detection via graph analysis of who-refers-whom.
- All matching respects privacy limits ([19-legal-compliance.md](19-legal-compliance.md)); signals are for risk scoring, not profiling for other purposes.

## Configurability

- Businesses tune sensitivity (strict vs. lenient), thresholds, and which actions map to which bands.
- Platform sets **hard floors** businesses cannot disable (e.g. block payout to identity-unverified accounts above a threshold) to protect the network.

## Future: AI assistance

- Designed-for, not built now: ML models scoring risk from historical labeled outcomes, anomaly detection on velocity/graphs.
- Any future automated decision affecting payouts keeps a human-review path and an audit trail (see legal/compliance on automated decisions).

## Interfaces

- **Tracking** — device/geo/velocity/click signals.
- **Integration** — order/refund/chargeback signals.
- **Commission & Payment** — holds, gating, reversals.
- **Analytics** — fraud dashboards, caught-vs-leaked metrics.
- **Notification** — alerts to reviewers.

## Invariants

1. **Money is held, never deleted**, on suspicion.
2. **Every fraud action is audited** with its evidence.
3. **Platform floors** exist that tenants cannot switch off.
4. **Scores are explainable** (which signals drove them).

## Open decisions (see DECISIONS.md)
- Default risk thresholds per plan.
- Which platform-level fraud floors are mandatory.
- Data-retention & privacy limits for fraud signals.
- Build-vs-buy for VPN/device intelligence data.
