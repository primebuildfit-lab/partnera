# Data Model — Creator Marketplace

> **Part 8.** Implementation-ready entity specifications. **Not a schema and not
> implemented** — no migrations, no Prisma changes. This mirrors the discipline of the
> existing canonical model (`packages/persistence/prisma/schema.prisma`) but ships only as
> a specification. When built, these tables sit **beside** the existing ones behind the
> same repository-port seam (D-206); the existing ledger is **reused**, not redesigned
> (D-315).

## Conventions (inherited)
- Ids are **branded types** (`CreatorId`, `OpportunityId`, …), never bare strings.
- Money is `Money` (bigint minor units); explicit currency; never floats.
- Time via injected `Clock`. Tenant scoping from context, never client input.
- **Append-only** for money/audit/review/event tables; mutable rows carry a `version` for
  optimistic concurrency; money-affecting writes carry an **idempotency key**.
- Personal-data classification: **P0** none · **P1** low (handle, skills) · **P2** PII
  (name, email, payout id) · **P3** sensitive (gov-id/KYC, biometrics-in-content).

## Per-entity spec key
owner · tenant boundary · mutability · lifecycle · permissions · retention · PII class ·
deletion behaviour · references · indexes · uniqueness · idempotency.

---

## Identity & profile

### CreatorProfile
- **owner** creator · **tenant** cross-tenant actor (not tenant-scoped; see D-316) ·
  **mutable** (versioned) · **lifecycle** active/suspended/closed ·
  **perms** creator self-manage; moderator read (audited) · **retention** account life +
  legal · **PII** P2 · **deletion** privacy-erase w/ lawful-hold exceptions ·
  **refs** UserId · **indexes** userId · **unique** one profile per user.

### CreatorSkill / CreatorPortfolioItem
- **owner** creator · mutable · self-managed · **PII** P1/P2 (portfolio may show face/voice
  → P3 in media) · portfolio items reference storage assets (signed access).

### CreatorCompanyRelationship
- Links CreatorId ↔ BusinessId with status (`none/applied/invited/active/blocked`),
  standing, per-business notes. **tenant** business-scoped view; creator-scoped view.
  **unique** (creatorId, businessId). Drives eligibility + isolation.

---

## Program, campaign, opportunity

### CreatorProgram
- **owner** business · **tenant** business · mutable(version) · lifecycle
  draft/active/paused/closed · perms `creator_program.manage` · refs BusinessId ·
  **unique** (businessId, slug).

### CreatorProgramPage
- **owner** business · page-builder document (blocks) for the program's public page ·
  draft/preview/published states · perms `creator_page.manage` · refs CreatorProgramId ·
  see [PAGE_BUILDER_ARCHITECTURE.md](PAGE_BUILDER_ARCHITECTURE.md).

### ContentCampaign
- **owner** business · time-bounded; budget cap; refs CreatorProgramId ·
  lifecycle draft/open/paused/closed · **indexes** (businessId, status).

### ContentOpportunity
- **owner** business · **versioned** (spec frozen at accept) · lifecycle per
  [STATE_MACHINES.md](STATE_MACHINES.md#1-opportunity) · budget, payment, eligibility,
  review config · refs ContentCampaignId · **indexes** (businessId, status, publishAt).

### OpportunityEligibilityRule
- Open / invite / private-pool / rank / reputation / geography gates · refs OpportunityId.

### DeliverableRequirement
- The requirement schema ([DELIVERABLE_MODEL.md](DELIVERABLE_MODEL.md)) · **versioned with
  the opportunity** · refs OpportunityId · a payable unit.

---

## Application & submission

### CreatorApplication
- CreatorId × OpportunityId; status per [STATE_MACHINES.md](STATE_MACHINES.md#2-application--participation-creator--opportunity) ·
  **unique** (creatorId, opportunityId) · records terms-acceptance + **fee snapshot ref**.

### Submission
- **owner** creator · **tenant** business (target) · lifecycle per state machine ·
  current `versionId` pointer · refs CreatorJob/OpportunityId · **PII** P2/P3 (media) ·
  **idempotency** on create per (jobId, attempt).

### SubmissionFile
- Storage-asset reference (bytes behind the storage seam, signed access) · type/size/hash ·
  scan status · **PII** P3 possible · retention per class.

### SubmissionVersion
- **append-only** — one per (re)submission; immutable snapshot + fileset · refs SubmissionId ·
  **indexes** (submissionId, seq).

### SubmissionReview
- **append-only** · reviewerId | aiRunId, decision, reason, per-category scores ref ·
  refs SubmissionVersionId · retained through appeal/dispute window.

### ReviewScore
- **append-only** per-category scores + mandatory results + weightedTotal · refs SubmissionReview.

### AIReviewRun
- **append-only** · modelVersion, policyVersion, inputsHash, results, flags, confidence,
  recommendation, explanation · refs SubmissionVersionId · **PII** processes P3 (bounded).

### RevisionRequest
- reviewer → creator; reason; refs SubmissionVersionId; decrements revision allowance.

### Approval / Rejection
- **append-only** decision records; Approval creates a payable + (optional) ContentAsset;
  Rejection is terminal (appealable). refs SubmissionVersionId.

### Dispute
- lifecycle per [STATE_MACHINES.md](STATE_MACHINES.md#5-dispute) · initiator, subject,
  evidence refs, resolution · retained through legal window · **PII** P2/P3.

---

## Content library

### ContentAsset
- **owner** business · **tenant** business · derived from an approved SubmissionVersion
  (provenance ref) · lifecycle pending/published/restricted/withdrawn/expired ·
  organization dims (brand/campaign/product/creator/type/platform/language/country) ·
  **indexes** (businessId, status, campaignId).

### ContentLicense
- rights (scope/exclusivity/geo/platforms/duration/whitelisting/credit) · lifecycle
  active/expiring/expired/revoked · refs ContentAssetId · drives affiliate access.

### ContentUsageRule
- permitted platforms/geo/usage; obligations; refs ContentAssetId.

### AffiliateContentAccess
- **append-only** access-grant/deny + signed-URL mint log for sensitive assets · refs
  (AffiliateId, ContentAssetId) · audit-grade.

### RankUnlockRule
- assetSelector, minRank, conditions, overrides, priority, status · refs BusinessId ·
  reusable ([RANK_UNLOCKS.md](RANK_UNLOCKS.md)).

---

## Money (reuses the existing append-only ledger — new reasons, not a new ledger)

### CreatorPayment
- Logical payable for an approved deliverable/milestone/bonus/reimbursement · **derived
  from ledger events** (not a mutable balance) · refs Approval, DeliverableRequirement,
  fee snapshot · state per [STATE_MACHINES.md](STATE_MACHINES.md#4-payment-per-payable-deliverablemilestone).

### PaymentAuthorization
- **append-only** · authorizerId (SoD: ≠ approver where required), amount, currency,
  feeSnapshotRef · **idempotency** per payable.

### PlatformFee
- **append-only** ledger recognition of the fee (rate from snapshot) · reversible via a
  compensating event · refs CreatorPayment · never hidden/hardcoded.

### CreatorBalance
- **derived** (fold of ledger events): pending/available/paid/reversed · never stored as
  truth (a snapshot cache is rebuildable, per D-212).

### CreatorReputation
- **derived**, explainable score/standing across businesses (approval rate, dispute rate,
  reliability, ratings) · formula open (OQ-13) · recomputable.

### BusinessCreatorRating
- creator-visible rating of a business (fairness/payment speed/clarity) · **unique**
  (creatorId, businessId, jobId) to prevent stuffing.

---

## Trust, safety, audit

### ModerationCase
- reuses fraud/review-case discipline · subject (submission/creator/business), reason,
  evidence, decision · escalation path.

### FraudSignal
- **reuses `@partnera/fraud-engine`** signals extended with creator-domain signals
  (duplicate/stolen content, fake identity, collusion) · weighted, banded.

### AuditEvent
- **reuses `@partnera/platform` audit** · immutable; actor/tenant/correlation/causation.

---

## Indexing & integrity summary
- Uniqueness: one profile/user; one application per (creator, opportunity); one rating per
  (creator, business, job); slugs per business.
- Idempotency keys on: submission create, payment authorization, fee recognition, payout,
  reversal.
- Append-only tables reject UPDATE/DELETE structurally (as the existing ledger/audit do).
- All tenant-scoped tables carry `businessId`; creator-actor tables are cross-tenant with
  per-relationship gating (D-316). Physical tenancy layout inherits the open D-102b decision.
