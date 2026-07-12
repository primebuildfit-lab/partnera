# Product Definition — Creator Economy & Content Marketplace

> **Part 1.** Authoritative product definition for the Creator Marketplace module.
> Documentation-only. Where a term already exists in Partnera's
> [glossary](../20-glossary.md), this module **reuses** it; new terms below extend it,
> they do not replace it. When this file and the root glossary disagree on a *shared*
> term, the root glossary wins and the discrepancy is a bug to fix.

## 1. One platform, two economic systems

Partnera runs two complementary money-earning systems on the same tenancy, identity,
ledger, and fraud spine:

| System | Who earns | For what | Money basis |
|---|---|---|---|
| **Affiliate** (existing) | Affiliate / Partner | Generating an **attributed sale** | Commission on conversion value |
| **Creator** (this module) | Creator / Contractor | Producing an **approved deliverable** | Payment per approved work item |

Neither replaces the other. A single **User** identity may hold an affiliate role, a
creator role, both, or a business-staff/contractor role, in one or many businesses.

## 2. Core nouns

| Term | Definition |
|---|---|
| **Creator Marketplace** | The module: the set of surfaces, engines, and contracts by which businesses recruit creators, run content programs, review work, pay per deliverable, and distribute approved content to affiliates. |
| **Creator** | A person (or represented entity) who produces content for businesses in exchange for **Creator Payment**. A creator is a first-class actor with a profile, portfolio, reputation, and per-business relationships. Distinct from an **Affiliate**. |
| **Creator Program** | A business's configured program that creators join — the creator-side analogue of an **Affiliate Program**. Has a public, business-branded page, eligibility rules, and defaults. |
| **Content Campaign** | A time-bounded, themed grouping of opportunities and budget within a Creator Program (analogous to the affiliate **Campaign**). |
| **Content Opportunity** | A published invitation to create specific content: requirements, deliverables, budget, payment, eligibility, and review criteria. The unit creators browse and select. |
| **Creator Job** | An accepted, in-flight engagement between one creator and one opportunity (the working record that carries submissions, reviews, and payment). |
| **Submission** | A creator's delivery of work against a Creator Job: one or more files plus metadata, targeting a specific business + campaign + opportunity. Versioned. |
| **Deliverable** | A single required output within an opportunity (e.g. "one 30s vertical UGC video"), with its own spec (dimensions, duration, talking points, rights…). A submission satisfies one or more deliverable requirements. |
| **Revision** | A requested change to a submission that keeps the job open; produces a new **Submission Version**. |
| **Review** | The evaluation of a submission against the opportunity's criteria; may be **Human Review**, **AI Review**, or a configured combination. |
| **Approval** | The decision that a submission satisfies its requirements and is payable and (optionally) publishable to the content library. |
| **Rejection** | The decision that a submission is not payable; terminal for that submission (subject to appeal/dispute). |
| **Dispute** | A formal contest of a decision or a non-payment/quality/ownership disagreement, entering a moderated resolution process. |
| **Content License** | The rights a business receives in an approved deliverable (scope, exclusivity, geography, platforms, duration). Governs downstream affiliate use. |
| **Content Library** | The tenant-scoped store of **approved** content assets, organized for reuse and rank-gated affiliate distribution. |
| **Content Asset** | An approved, licensed, catalogued item in the library, derived from an approved submission. |
| **Affiliate Asset** | A Content Asset made available to affiliates for promotion, subject to rank unlock, usage rules, and license/expiration. |
| **Rank Unlock** | A rule binding a set of assets to a minimum affiliate rank (and optional conditions); affiliates at/above the rank can use the assets. |
| **Creator Payment** | Money owed to a creator for an approved deliverable (or milestone/bonus), recorded on the append-only ledger; distinct from affiliate **Commission**. |
| **Platform Fee** | Partnera's transparent, configurable **2%–4%** fee on eligible creator-work transactions; snapshotted at terms-acceptance; recorded as ledger events; never hidden or hardcoded. |
| **Creator Reputation** | A derived, explainable score/standing for a creator across businesses (approval rate, dispute rate, reliability, ratings). |
| **Business Rating** | A creator-visible rating of a business's behaviour (fairness, payment speed, clarity) — the two-sided counterpart of reputation. |
| **AI Review** | Automated, model-assisted evaluation of a submission producing scores, flags, and an explainable recommendation. Advisory by default; never releases payment silently. |
| **Human Review** | Evaluation by an authorized person (business owner, staff reviewer, contractor, or Partnera moderator) who makes or confirms the decision. |

## 3. Money taxonomy — precise distinctions

These are **different** money concepts and must never be conflated in the ledger, the
UI, tax treatment, or contracts. Each maps to a distinct ledger event stream / reason.

| Concept | Trigger | Payer → payee | Fee? | Notes |
|---|---|---|---|---|
| **Affiliate commission** | Attributed **sale** (conversion) | Business → affiliate | Existing affiliate economics (unchanged) | Performance-based; existing commission ledger. |
| **Creator payment** | **Approved deliverable** / milestone | Business → creator | **Platform fee applies** (2%–4%) | Work-for-hire style; this module. |
| **Employee compensation** | Employment relationship | Business → employee | Out of scope | Partnera does **not** run payroll; flagged in [LEGAL_REVIEW.md](LEGAL_REVIEW.md). |
| **Contractor payment** | Contracted deliverable/scope | Business → contractor | Platform fee if routed as creator-work | Classification is a legal question ([LEGAL_REVIEW.md](LEGAL_REVIEW.md)). |
| **Content licensing** | Grant/renewal of usage rights | Business → creator (or bundled into payment) | Configurable | May be part of the deliverable price or a separate line. |
| **Performance bonus** | Config'd threshold (views, sales-attributed content) | Business → creator | Platform fee if configured | Optional add-on to a creator payment. |
| **Reimbursement** | Pre-approved cost (props, shipping) | Business → creator | Typically **no** fee | Not compensation; separate reason; evidence-gated. |
| **Platform fee** | Eligible creator-work transaction | Business (default) → Partnera | — | Transparent, snapshotted, ledgered; see [PAYMENTS_AND_FEES.md](PAYMENTS_AND_FEES.md). |

**Rule:** the platform fee is charged on **creator-work transactions** by default and
is **shown in full before terms are accepted**. It may be applied to other money flows
**only when a business explicitly configures it**, within the global allowed range.
It is **never** applied to affiliate commissions by this module (affiliate economics are
unchanged) unless a separate, explicit future decision says so.

## 4. Relationship to existing Partnera concepts

- **Reuses:** User, Business/Tenant, Membership, Role/Permission, Ledger (append-only,
  derived balances), Payout/Rail, Fraud signals/scores/cases, Notification channels,
  Feature Flags/Entitlements, Audit, Adapter pattern, Marketplace surface.
- **Adds:** Creator identity graph, Creator Program/Campaign/Opportunity/Job,
  Submission/Review/Scoring, Content Library/Asset/License, Rank Unlocks, Creator
  Payment + Platform Fee reasons, AI review runs, Business page builder.
- **Analogy map:** Creator Program ≈ Affiliate Program; Content Campaign ≈ Campaign;
  Content Opportunity ≈ Offer (but pays for **work**, not **sales**); Creator Payment ≈
  Commission (but keyed on **approval**, not **conversion**). See
  [ARCHITECTURE_RECONCILIATION.md](ARCHITECTURE_RECONCILIATION.md).

## 5. Non-goals (for this module)

- Not payroll or employment. Not tax filing. Not a custodial wallet.
- Not a replacement for the affiliate system.
- Not Shopify-first: Shopify is one presentation/commerce **adapter**
  ([SHOPIFY_INTEGRATION.md](SHOPIFY_INTEGRATION.md)).
- Not an open arbitrary-code plugin runtime (existing invariant preserved).
