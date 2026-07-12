# 15 — User Flows

> End-to-end journeys tying the surfaces and engines together. These are **conceptual flows**, not UI specs.

## 1. Business onboarding

```
Sign up → create Business (tenant) → choose plan (entitlements)
→ connect commerce platform (via Integration adapter)
→ create Affiliate Program → set recruitment mode & default terms
→ design first Offer (Offer Builder) → simulate against history → activate
→ invite/recruit affiliates → program live
```

## 2. Affiliate joins a program

```
Affiliate discovers program (open link / invite / marketplace)
→ applies (Application) → business reviews (or auto-approve policy)
→ approved → Enrollment created
→ gets Referral Links / Coupons + promotional material
→ ready to promote
```

## 3. Conversion → commission → payout (the money spine)

```
Affiliate shares link/coupon → customer clicks (Tracking)
→ customer buys → order ingested (Integration, normalized)
→ attribution resolved → Conversion recorded
→ Fraud scores (allow/hold) → Offer Engine evaluates → Commission created (pending)
→ maturation + approval policy + fraud clear → Commission approved (available)
→ affiliate requests Withdrawal → payout batch → rail disburses → paid
→ notifications to affiliate & business; analytics updated
```

## 4. Refund / clawback

```
Customer refunds within clawback window
→ refund ingested (Integration) → Conversion marked reversed
→ Commission Engine appends reversal event → balance adjusts
→ if already paid: recoverable nets against future earnings (per policy)
→ fraud score may increase (refund farming signal)
```

## 5. Campaign launch

```
Business creates Campaign (type, window, eligibility, goals)
→ attaches Offers → selects eligible affiliates/tiers (or invite-only)
→ provides creatives → activates → affiliates promote
→ conversions attributed to campaign → leaderboard/contest (if any)
→ campaign ends → results & payouts settle
```

## 6. Business partnership

```
Business A proposes Partnership to Business B (type + terms/split)
→ B reviews & accepts (both consent recorded)
→ partnership offers/rules activate (scoped)
→ cross-business conversions attributed → split commissions logged for both
→ revenue-share settlement via payouts/reconciliation
→ either party can pause/end per terms; disputes → resolution flow
```

## 7. Extension contribution

```
Developer builds extension + manifest → submits
→ automated checks → human review (security/quality/IP)
→ approved → published to Marketplace (versioned)
→ tenants discover & install (scoped, revocable)
→ on adoption/monetization → contributor commission (ledger)
→ platform can update/deprecate/kill-switch
```

## 8. Fraud review

```
Signals raise a Conversion/affiliate's risk score above threshold
→ commission held → item enters Review Queue with evidence
→ reviewer (business, or platform for cross-tenant) decides
→ approve (release) / reject (void) / suspend affiliate
→ decision audited; feeds back to tune rules
```

## 9. Platform operator daily loop

```
Open Admin Console → Overview (network KPIs & alerts)
→ triage Approvals (extensions/partnerships/high-risk)
→ review Fraud escalations → check Payments/reconciliation
→ handle Support/Moderation → monitor System Health
→ all sensitive actions audited
```

## 10. Payout with identity/tax gating

```
Affiliate requests first withdrawal
→ system checks identity/tax requirements (per jurisdiction/threshold)
→ if missing: prompt to complete KYC/tax → hold until satisfied
→ once satisfied + fraud clear → payout proceeds
```

These flows exercise every engine and surface; discrepancies between them and the engine docs are treated as bugs to reconcile (see [21-risks.md](21-risks.md) self-review).
