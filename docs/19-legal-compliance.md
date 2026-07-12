# 19 — Legal, Tax & Compliance

> Partnera moves money-adjacent value across businesses, affiliates, and jurisdictions. Legal/compliance risk is real and can be existential. This is a **design-level register of obligations and decisions** — not legal advice. Qualified counsel must review before launch.

## Major compliance forks

### 1. Money movement (the biggest one)
- **Non-custodial / business-funded:** businesses pay their own affiliates; Partnera records/facilitates. **Lowest regulatory burden.** ← recommended starting posture.
- **Custodial / platform-facilitated:** Partnera holds/moves funds → likely triggers **money-transmission / e-money** regulation, licensing, KYC/AML obligations in many jurisdictions.
- **Decision required** before any payout is built (see [07-payments-payouts.md](07-payments-payouts.md), [../DECISIONS.md](../DECISIONS.md)). Assume non-custodial until counsel says otherwise.

### 2. KYC / AML
- Identity verification for affiliates before payouts above thresholds.
- Sanctions/PEP screening if custodial or above certain volumes.
- Record-keeping obligations.

### 3. Tax
- Affiliate earnings may create **tax-reporting obligations** (e.g. information returns) for businesses and/or platform depending on model and jurisdiction.
- Collect required tax info before payout; retain records.
- Sales-tax/VAT on subscription revenue (platform's own billing) — future.

## Privacy & data protection

- **GDPR / CCPA / similar:** Partnera processes personal data (affiliates, customers via tracking).
- **Roles:** clarify controller vs. processor for tracking data (businesses are likely controllers of their customer data; Partnera a processor — to be confirmed with counsel and DPAs).
- **Lawful basis, consent & cookies:** tracking (clicks/cookies) must respect consent frameworks; coupon attribution helps in cookieless/consent-restricted contexts.
- **Data-subject rights:** access, deletion, portability — designed-for.
- **Data minimization & retention:** capture only what's needed; defined retention for tracking/fraud signals.
- **Cross-border transfers:** handled per applicable frameworks.
- **DPAs:** data-processing agreements with tenants.

## Automated decisions & fraud

- Fraud scoring that affects payouts may implicate rules on **automated decision-making**; keep a human-review path and explainability ([08-fraud-engine.md](08-fraud-engine.md)).

## Contracts & terms

- **Platform Terms of Service** (tenants).
- **Affiliate terms** (within programs).
- **Contributor agreement** — governs extension IP, commercial rights (Partnera retains rights per policy), and contributor commissions ([10-extensions.md](10-extensions.md)).
- **Partnership agreements** — the platform records consent; the commercial terms are between businesses (Partnera's liability position to be defined).
- **Acceptable-use & anti-fraud policy.**

## Consumer-protection & marketing law

- Affiliate marketing is regulated (e.g. disclosure requirements for endorsements). Provide guidance/tools for compliant affiliate disclosures.
- Coupon/discount and promotion rules vary by jurisdiction.

## Liability & dispute posture

- Define Partnera's liability limits for: attribution disputes, fraud losses, partnership disputes, extension behavior, payout errors.
- Dispute-resolution flows (ledger + attribution evidence) reduce ambiguity.

## Compliance-by-design principles

- Minimal data, clear consent, auditable actions, separation of platform fees from affiliate money, human oversight of automated money decisions, and jurisdiction-aware payout/tax gating.

## Open decisions (see DECISIONS.md)
- **Custodial vs. non-custodial** (gates almost everything above).
- Launch jurisdictions (scopes which regimes apply first).
- Controller/processor stance & DPA templates.
- KYC/tax thresholds & providers.
- Whether Partnera provides tax reporting or leaves it to businesses.

> ⚠️ This document flags obligations; it is **not legal advice**. Engage qualified counsel per launch jurisdiction before implementing money movement or launching.
