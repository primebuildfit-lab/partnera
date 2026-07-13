# Self-Audit — Creator Marketplace

> **Part 22 (audit half).** A structured sweep of this documentation package for
> contradictions and risks, with fixes applied where they were safe documentation changes.
> The standing risk list is in [RISK_REGISTER.md](RISK_REGISTER.md).

## Method

Each concern below was checked against the full doc set and the existing Partnera
invariants. Status: ✅ resolved in docs · 🟡 mitigated + tracked as open question/risk ·
⬜ intentionally deferred to a build phase.

## Findings

| # | Concern | Finding | Status |
|---|---|---|---|
| A1 | **Contradictions** | Two economic systems could imply two ledgers. Resolved by D-315: one append-only ledger, new reasons. Creator Payment ≠ Commission stated consistently. | ✅ |
| A2 | **Duplicated systems** | Risk of re-implementing auth/ledger/fraud/notifications under new names. [ARCHITECTURE_RECONCILIATION.md](ARCHITECTURE_RECONCILIATION.md) mandates reuse; only genuinely-new engines are new. | ✅ |
| A3 | **Unclear money flows** | Fee/net/payer, snapshot, and reversal semantics specified end-to-end ([PAYMENTS_AND_FEES.md](PAYMENTS_AND_FEES.md)); fee always shown pre-acceptance. | ✅ |
| A4 | **Dangerous payment assumptions** | No custody assumed (D-050/D-313); escrow-like states are **ledger** states, funds with provider. Final custodial call gated (D-106). | 🟡 |
| A5 | **Unbounded storage** | Content storage could grow without limit. File-size/duration/retention limits are plan-gated + retention classes defined; exact caps open. | 🟡 (OQ-31/33) |
| A6 | **Privacy risks** | Creator PII + media (P2/P3) minimized, scoped, signed-URL only; deletion vs. lawful hold addressed. Biometric/minors flagged for counsel. | 🟡 (OQ-21, LEGAL) |
| A7 | **Tenant leaks** | Hard access rules + tenant-from-context + creator-source isolation + AI-service confinement specified structurally. | ✅ |
| A8 | **Copyright risk** | Rights attestation, music/model/location releases, duplicate/stolen-content detection, mandatory legal gate. Counsel-gated defaults. | 🟡 (LEGAL) |
| A9 | **Unfair AI decisions** | D-307 (no silent auto-pay), explainability, override, appeal, confidence/abstention, bounded-auto only for objective checks. | ✅ |
| A10 | **Creator exploitation** | Transparent fee/net, review-against-versioned-spec, revision allowance, dispute+appeal, non-payment protection, earning-is-free. | ✅ |
| A11 | **Hidden fees** | Fee never hidden/hardcoded; snapshot-locked; net always shown; UI shows gross/fee/net. | ✅ |
| A12 | **Regulatory risk** | Money-transmission, tax, KYC/KYB, sanctions, minors, biometrics, automated-decision rights all catalogued for counsel. | 🟡 (LEGAL) |
| A13 | **Marketplace abuse** | Fraud floors, verification levels, collusion/graph signals, duplicate detection, SoD, watermarking. | ✅ |
| A14 | **Scope dilution** | Ships after affiliate-core; reuse-first; new engines only where no analogue; guardrails in reconciliation. | ✅ |
| A15 | **Unrealistic phases** | CM0–CM16 each have prereqs, acceptance, stop conditions, and external gates; money movement is gated on counsel. | ✅ |
| A16 | **Conflicts with existing decisions** | Naming/number collision with MM5 resolved (D-318); no invariant regressed; D-300 series avoids ID clashes. | ✅ |
| A17 | **Money-path SoD** | approve ≠ authorize ≠ execute enforced via split permission keys (D-317). | ✅ |
| A18 | **Determinism** | Engines specified as deterministic (`Clock`, branded ids, `Result`); AI non-determinism recorded via pinned versions. | ✅ |

## Fixes applied in this pass (documentation)

- Standardized **Creator Payment vs. Commission** language across all docs.
- Made the **fee-before-acceptance** and **snapshot-lock** rule explicit in
  Payments, Monetization, Workflows, State Machines, and the Opportunity-detail UX.
- Added the **naming/numbering reconciliation** (MM5 vs CM) to Decisions, README, and
  Reconciliation to prevent an ID/phase collision.
- Pinned **one ledger, new reasons** (D-315) everywhere money is discussed.
- Cross-linked isolation rules so no doc implies affiliate/creator access crossover.

## Residual (correctly deferred)

- Exact fee, payer, funding model, payout timing (OQ-01–04).
- License/ownership defaults, minors/KYC/tax/jurisdictions (LEGAL, OQ-20–24).
- Storage/CDN + AI providers; storage caps + retention windows (OQ-30–33).
- Reputation formula, rank-model source, attribution method (OQ-13/40/32).

None of the residual items can be safely closed at documentation stage; each is tracked in
[OPEN_QUESTIONS.md](OPEN_QUESTIONS.md) and gated in the roadmap.

## Verdict

The package is **internally consistent** and preserves every existing Partnera invariant.
Open items are genuinely open (pricing, counsel, provider, pilot data), not contradictions.
Architecture is **locked**; implementation is **not** started.
