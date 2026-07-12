# Decisions — Creator Marketplace

> **Part 21 (decisions half).** Locked decisions for this module. These use the
> **D-300 series** in the root [DECISIONS.md](../../DECISIONS.md) to keep a single ID
> space while staying clearly separate from the affiliate-core decisions (D-001…D-221)
> and from the Live-Infrastructure module's own D-222+ range. Genuinely open items are in
> [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
>
> Status legend: ✅ Decided (locked for this module) · 🟡 Provisional (default, revisit) · ⏳ Open.

## Locked decisions

### D-300 ✅ Creator Marketplace is a Partnera **module**, not a separate product
It reuses Partnera's tenancy, identity, RBAC, ledger, payment/rail, fraud, notification,
audit, and adapter spine. **Why:** avoids a parallel platform; the invariants and data
already exist. See [ARCHITECTURE_RECONCILIATION.md](ARCHITECTURE_RECONCILIATION.md).

### D-301 ✅ Affiliate and creator systems **coexist**; neither replaces the other
Two economic systems on one platform: affiliates earn on **attributed sales**, creators
earn on **approved deliverables**. **Why:** they solve different problems and share the
same money spine.

### D-302 ✅ One **User** identity can be affiliate, creator, both, or staff/contractor
Global identity; capability is per-membership/per-relationship. **Why:** real people wear
multiple hats; forcing separate accounts breaks reputation, payouts, and isolation.

### D-303 ✅ Businesses customize their own **public program pages** via a page builder
Config-driven, block-based, draft/preview/published. **Why:** config-over-code (D-003);
each business needs its own brand without platform code per tenant.
See [PAGE_BUILDER_ARCHITECTURE.md](PAGE_BUILDER_ARCHITECTURE.md).

### D-304 ✅ Creators **choose** companies and opportunities (pull, not just push)
Discovery + filtering + self-selection, subject to business eligibility rules. **Why:**
marketplace liquidity; creators control who they work with.

### D-305 ✅ Content is **reviewed before payment**; approval gates money
No creator payment authorization occurs before an approval decision on the deliverable.
**Why:** protects businesses from paying for non-compliant work; anchors the money flow.

### D-306 ✅ Human **and** AI-assisted review are both supported, configurably
Four approval modes (human-only; AI-recommend + human-decide; AI objective-pass + human
creative; automated only for low-risk measurable checks if explicitly enabled).
See [REVIEW_AND_SCORING.md](REVIEW_AND_SCORING.md).

### D-307 ✅ AI **never silently releases payment by default**
Automated approval is opt-in, bounded to low-risk objective checks, always audited with
model version + explanation, and always overridable. **Why:** fairness, liability,
trust. See [AI_REVIEW_ARCHITECTURE.md](AI_REVIEW_ARCHITECTURE.md).

### D-308 ✅ Approved content can be **unlocked by affiliate rank**
Businesses bind asset sets to minimum ranks + conditions; affiliates at/above the rank
gain access. **Why:** rewards affiliate progression; controls premium-asset distribution.
See [RANK_UNLOCKS.md](RANK_UNLOCKS.md).

### D-309 ✅ Partnera earns via a **transparent transaction fee**, not forced subscriptions
Core revenue is the platform fee on creator-work transactions. Plans add limits/premium
capabilities but never remove the basic economic model. See [MONETIZATION.md](MONETIZATION.md).

### D-310 ✅ Target platform fee range is **2%–4%**, configurable and transparent
Global allowed range with guardrails; per-business rate within range; promotional and
enterprise rates allowed; **never hidden, never hardcoded**; **fee snapshot locked at
terms acceptance**; changes never apply silently to an in-flight job.
See [PAYMENTS_AND_FEES.md](PAYMENTS_AND_FEES.md).

### D-311 ✅ Fee is charged to the **business by default**; creator sees a clear **net**
Default payer is the business; the creator's net is stated up front. Who ultimately bears
the fee is configurable within rules, but always disclosed before acceptance.

### D-312 ✅ Creators are **not forced to pay** to access earning opportunities
Discovering, applying, submitting, and getting paid never require a paid creator plan.
Optional creator-premium features may exist later but are additive.

### D-313 ✅ **Payment providers move money; Partnera does not store cards**
Provider-independent abstraction over Stripe Connect / PayPal Payouts / Wise / others.
Partnera decides eligibility, amount, reason, approver, fee, and timing; the provider
disburses. Non-custodial stance inherited from **D-050**. See [PAYMENTS_AND_FEES.md](PAYMENTS_AND_FEES.md).

### D-314 ✅ **Shopify is an adapter and presentation channel, not the core**
Partnera owns all domain data. Shopify embedded app + app blocks + storefront widgets +
hosted pages are channels over the same contracts. See [SHOPIFY_INTEGRATION.md](SHOPIFY_INTEGRATION.md).

### D-315 ✅ Creator-work money uses the **existing append-only ledger**, new reasons
Creator payments, platform fees, bonuses, reimbursements, and reversals are **new ledger
event reasons/streams**, not a new ledger. Balances stay derived. **Why:** preserves
D-006; one auditable money spine. The existing ledger is **not** redesigned.

### D-316 ✅ Creator identity is **not** modelled as a business/tenant
A creator is an actor with per-business relationships, not a tenant. Their private
submissions and source material are creator-owned and isolated from businesses until
submitted/approved per license. See [SECURITY_MODEL.md](SECURITY_MODEL.md).

### D-317 ✅ **Separation of duties** applies to creator payments (approve ≠ release)
Reuses D-053/D-010; content approval, payment authorization, and payout execution are
distinct, permissioned steps. **Why:** fraud/error protection on a new money path.

### D-318 ✅ This module is **architecture-locked but not implemented**
No code, migrations, dependencies, providers, or deployment in this phase. It is an
**approved future expansion**, separate from the current affiliate-core release and from
the roadmap's "Mega Module 5 — Live Infrastructure & Pilot".
See [ARCHITECTURE_RECONCILIATION.md](ARCHITECTURE_RECONCILIATION.md#naming-and-numbering).

### D-319 ✅ Content storage/CDN is a **provider-independent seam**
Uploads, virus/CSAM scanning, transcoding, thumbnails, signed time-limited access, and
retention are behind an abstraction; no specific storage provider is chosen here.
See [CONTENT_ACCESS_SECURITY.md](CONTENT_ACCESS_SECURITY.md).

### D-320 🟡 Default content-license terms are **conservative and explicit**
Absent an explicit grant, a business receives only what the opportunity's stated license
grants; nothing is implied. Defaults, exclusivity, and duration are set per opportunity.
**Why:** avoids ownership disputes; final defaults need counsel ([LEGAL_REVIEW.md](LEGAL_REVIEW.md)).

## Provisional defaults (revisit before build)

| ID | Default | Revisit trigger |
|---|---|---|
| D-330 🟡 | Default fee **3%** (mid of 2–4%), business-paid | Pricing decision / counsel |
| D-331 🟡 | Default **review SLA** 5 business days; auto-nudge, then escalate | Pilot data |
| D-332 🟡 | Default **dispute window** 14 days after decision/payment | Counsel + pilot |
| D-333 🟡 | Default **revision allowance** 2 per deliverable, configurable | Pilot data |
| D-334 🟡 | Minimum creator **age 18**; KYC required above a payout threshold | Counsel (D-110 jurisdictions) |
| D-335 🟡 | Approved content **default license**: non-exclusive, business's owned + affiliate channels, 12 months | Counsel |
| D-336 🟡 | AI auto-approval allowed **only** for objective technical checks, off by default | Post-pilot review |

*These roll up into the root [DECISIONS.md](../../DECISIONS.md) D-300 block on integration.*
