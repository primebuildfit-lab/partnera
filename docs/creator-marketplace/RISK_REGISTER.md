# Risk Register — Creator Marketplace

> **Part 22 (risk half).** Standing risks for this module, ranked, with mitigations and
> owners. Complements the platform register ([../21-risks.md](../21-risks.md)). Severity:
> 🔴 high · 🟠 medium · 🟡 low. Likelihood/impact are pre-mitigation.

| ID | Risk | Sev | Mitigation | Owner | Gate |
|---|---|---|---|---|---|
| CR-01 | **Money-transmission / custody** — escrow-like flows misread as custody | 🔴 | Non-custodial (D-050/D-313); ledger-state escrow, funds with provider; counsel sign-off | Legal | D-106 / CM10/CM14 |
| CR-02 | **Contractor misclassification** | 🔴 | Neutral platform framing; terms; per-jurisdiction counsel (OQ-24) | Legal | CM15 |
| CR-03 | **Copyright / music / releases** — unlicensed content, no model/location release | 🔴 | Attestations, automated indicators, mandatory legal gate, takedown, disputes | Legal/Product | CM8 |
| CR-04 | **Minors / biometrics** — creators or depicted persons | 🔴 | Min age (D-334), verification, biometric-law review | Legal | CM4 |
| CR-05 | **Unfair AI decision / bias** | 🟠 | D-307 no silent auto-pay; explainability; override; appeal; abstain-on-low-confidence | Product | CM9 |
| CR-06 | **Tenant / creator-source leakage** | 🔴 | Hard access rules; context-derived tenant; AI-service confinement; signed URLs; audit | Eng | CM3/CM7 |
| CR-07 | **Unbounded content storage cost** | 🟠 | Plan-gated size/duration limits; retention classes; transcoding | Eng/Business | CM7 (OQ-31/33) |
| CR-08 | **Content leak / out-of-license reuse by affiliates** | 🟠 | License enforcement, rank gate, watermarking, short-lived signed URLs, usage tracking | Eng | CM7 |
| CR-09 | **Fraud** — fake creators/businesses, stolen/duplicate content, collusion | 🟠 | Verification levels, fraud floors, duplicate detection, graph signals, SoD | Eng/Trust | CM3/CM8 |
| CR-10 | **Chargeback-after-payout loss** | 🟠 | Reversal incl. fee reversal; funding checks; recovery policy | Business | CM10 |
| CR-11 | **Hidden-fee perception / trust** | 🟡 | Fee+net shown pre-accept; snapshot; gross/fee/net in UI; never hardcoded | Product | CM10 |
| CR-12 | **Scope dilution destabilizes affiliate core** | 🟠 | Ships after affiliate-core live; reuse-first; additive phases; green gate | Eng lead | all CM |
| CR-13 | **Two-sided cold start** (no creators or no opportunities) | 🟠 | Pilot with PrimeBuild; seed liquidity; discovery UX | Business | CM15/16 |
| CR-14 | **Balance/analytics derivation cost at scale** | 🟡 | Rebuildable snapshot caches (mirrors D-212); indexes | Eng | CM13 |
| CR-15 | **Naming/number collision (MM5 vs CM)** | 🟡 | Resolved: CM track + D-300 series (D-318) | Product | CM0 ✅ |
| CR-16 | **Automated-decision legal rights** (appeal, disclosure) | 🟠 | Appeal path designed; AI-use disclosure; counsel scope | Legal | CM9 (OQ-26) |
| CR-17 | **Provider lock-in / outage** (payout, storage, AI) | 🟡 | Provider-independent seams (D-313/D-319); adapters swappable | Eng | CM10/14 |
| CR-18 | **Privacy deletion vs. lawful hold conflict** | 🟠 | Retention classes; lawful-hold overrides; ledger fact retained, PII minimized | Legal/Eng | CM7 (OQ-33) |

## Top risks (ranked)

1. 🔴 **CR-01** custody/money-transmission — hard gate on the whole money path (D-106).
2. 🔴 **CR-06** tenant/creator-source leakage — the cardinal multi-tenant failure.
3. 🔴 **CR-02 / CR-03 / CR-04** legal (classification, rights, minors/biometrics) — launch gates.
4. 🟠 **CR-12** scope dilution — protect the affiliate core; sequence after it.
5. 🟠 **CR-05 / CR-16** AI fairness + automated-decision rights.

## Always-on

Keep this register current each CM phase; security + counsel review gates every money- or
content-rights-touching release; never regress an invariant
([SELF_AUDIT.md](SELF_AUDIT.md)).
