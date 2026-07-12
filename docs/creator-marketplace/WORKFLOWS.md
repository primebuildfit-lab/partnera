# Workflows — Creator Marketplace

> **Part 4 (workflows half).** End-to-end lifecycles. State definitions and legal
> transitions are in [STATE_MACHINES.md](STATE_MACHINES.md). Every step emits an
> append-only domain event ([API_AND_EVENTS.md](API_AND_EVENTS.md)); every money step is a
> ledger append, never an edit.

## 1. The canonical opportunity → payment → library flow

```
Business creates opportunity
  ↓  (defines content requirements, deliverables)
Business defines payment and budget            → fee shown; snapshot prepared
  ↓
Business publishes opportunity                  → opportunity.published
  ↓
Creator discovers company + opportunity         → discovery/filters
  ↓
Creator selects opportunity                     → application.submitted / invited→accepted
  ↓
Creator accepts terms                           → fee + net locked (fee snapshot)  → job opens
  ↓
Creator creates content
  ↓
Creator uploads submission                      → submission.uploaded
  ↓
Automated safety checks                         → virus/CSAM/format/dup scan (mandatory)
  ↓
AI review (if enabled)                          → aireview.completed (advisory)
  ↓
Human review (if required)                      → review recorded
  ↓
Approve  /  request revision  /  reject
  ├─ revision → creator resubmits → re-review
  ├─ reject   → terminal (appeal/dispute possible)
  └─ approve                                     → submission.approved
        ↓
Payment authorization                           → payment.authorized (approver ≠ executor)
        ↓
Platform fee calculated (from snapshot)         → platform_fee.recognized
        ↓
Creator net calculated
        ↓
Provider processes payout                       → payment.processing → payment.paid
        ↓
Content enters approved library                 → content.published_to_library
        ↓
Business assigns affiliate-rank access          → rank unlock rules
        ↓
Affiliates use approved content                 → affiliate.content_unlocked / usage
        ↓
Usage & performance tracked                     → analytics + (optional) attribution
```

**Guardrails baked into the flow:** payment cannot be authorized before an approval;
the fee is the snapshot taken at terms acceptance (never re-read live); approval and
payout execution are separate permissioned steps; only **approved** content can enter the
library; affiliates only ever see rank-unlocked, licensed, unexpired assets.

## 2. Business: create & publish an opportunity

1. Create/choose a **Creator Program** (branded page optional) and a **Content Campaign**.
2. Define one or more **Deliverable Requirements** ([DELIVERABLE_MODEL.md](DELIVERABLE_MODEL.md)):
   format, specs, talking points, prohibited claims, rights, deadline, revision allowance,
   payment, bonus.
3. Set **budget** (campaign-level cap and per-opportunity payment) and **eligibility rules**
   (open / invite / private pool / rank / reputation / geography).
4. Choose **review configuration**: reviewers, approval mode (human-only / AI-recommend /
   AI-objective+human / bounded-auto), scoring weights, SLA.
5. Preview and **publish** (or schedule). Draft → scheduled → open.

## 3. Creator: discover → accept → submit → revise

1. **Discover** participating companies; open a company's public program page.
2. **Filter** opportunities; open an opportunity detail (requirements, payment, **fee +
   net**, rights, deadline).
3. **Apply / accept invite**. On **accept terms**, the **fee snapshot locks** and a
   **Creator Job** opens. Nothing about the money can silently change afterward.
4. **Create** content off-platform; **upload** submission files; assign to the correct
   business + campaign + opportunity + deliverable(s); add notes/rights attestations.
5. Submission runs **automated safety checks**, then review.
6. On **revision requested**, address feedback and **resubmit** (new version) until the
   revision allowance is exhausted or the deadline passes.

## 4. Review & decision

- **Automated safety** (always, first): malware/CSAM scan, file-type/size/format
  validation, duplicate/plagiarism indicators, metadata sanity. A hard fail blocks review.
- **AI review** (if enabled): objective technical checks + advisory quality/brand/brief
  scoring with explanations and confidence ([AI_REVIEW_ARCHITECTURE.md](AI_REVIEW_ARCHITECTURE.md)).
- **Human review** (per mode): the authorized reviewer approves, requests revision, or
  rejects, with a reason. Multi-reviewer and value-cap rules apply per config.
- **Decision** writes an immutable review record (scores, model version if AI, reviewer,
  explanation) for audit and appeals.

## 5. Payment (only after approval)

1. **Approval** makes the deliverable payable (`payment: pending_approval → approved`).
2. A **payment authorizer** (separation of duties: not the approver where required)
   authorizes; the **platform fee** is computed from the locked snapshot; the **creator
   net** is derived.
3. Ledger appends: creator-payment payable, platform-fee recognized (see
   [PAYMENTS_AND_FEES.md](PAYMENTS_AND_FEES.md)).
4. A **payout** is requested → approved → executing via the external provider →
   **paid**; the ledger closes the item. Failures retry or reverse (compensating events).

## 6. Content → library → affiliate distribution

1. Approved deliverables become **Content Assets** with a **Content License**.
2. The business organizes assets (brand/campaign/product/type/platform/language/…).
3. The business defines **Rank Unlock** rules ([RANK_UNLOCKS.md](RANK_UNLOCKS.md)) binding
   asset sets to minimum affiliate ranks + conditions.
4. Affiliates at/above the rank see and download **unlocked, licensed, unexpired** assets,
   with usage rules and permitted platforms; usage is tracked and (optionally) attributed.

## 7. Exception flows

- **Cancellation** (before approval): opportunity cancelled or job withdrawn → no payment;
  any pre-funded hold released; events recorded.
- **Partial approval / milestones:** multi-deliverable opportunities may approve/pay some
  deliverables and revise/reject others; each is its own payable unit.
- **Dispute:** any decision or non-payment can open a **Dispute**
  ([TRUST_SAFETY_AND_DISPUTES.md](TRUST_SAFETY_AND_DISPUTES.md)); resolution may approve,
  uphold, refund, or reverse — always via compensating ledger events.
- **License expiry:** an asset's license expires → it auto-locks for affiliates
  (`license.expired`); no downstream edit to money.
- **Refund/chargeback after payout:** handled as reversals per [PAYMENTS_AND_FEES.md](PAYMENTS_AND_FEES.md),
  including **platform-fee reversal**.
