# Security Model — Creator Marketplace

> **Part 12 (security half).** Tenant isolation, creator privacy, financial separation, and
> service-account constraints. Extends [../18-security.md](../18-security.md) and
> [CONTENT_ACCESS_SECURITY.md](CONTENT_ACCESS_SECURITY.md). Reuses existing invariants; adds
> creator-specific ones. Permission matrices: [PERMISSIONS.md](PERMISSIONS.md).

## 1. Isolation invariants (extend the platform's)

1. **Company isolation.** No business can access another business's programs, opportunities,
   submissions, assets, payments, or analytics. Tenant is derived from the authenticated
   context, **never** from client input (no client-trusted tenant identifiers).
2. **Creator privacy.** A creator's profile, portfolio, and **private/raw source material**
   are creator-owned; a business sees only what a creator **submits** to it, and downstream
   only what the **license** grants (D-316). Businesses cannot see a creator's other
   engagements.
3. **No creator ↔ creator leakage.** A creator can never see another creator's private
   submissions, feedback, scores, or earnings.
4. **Financial separation.** Creator funds and platform fees are never commingled; approve /
   authorize / execute are separated on money paths (D-317).
5. **Reviewer limitation.** Reviewers access only submissions in their assigned scope; a
   contractor/employee cannot reach unrelated company data.
6. **Rank-scoped affiliate access.** Affiliates see only published, licensed, unexpired,
   rank-unlocked assets of businesses they're enrolled with (see
   [CONTENT_ACCESS_SECURITY.md](CONTENT_ACCESS_SECURITY.md)).
7. **AI service confinement.** The AI review service reaches only the exact submission under
   review — never other submissions, creators, tenants, or the library.

## 2. AI review service (service account)

- A **service principal** with a **per-run, single-submission** grant. Inputs (the
  submission files + versioned requirement spec) are passed explicitly; the service holds
  **no ambient tenant scope**.
- Cannot enumerate, search, or reach any other record. Runs are audited (model version,
  inputs hash). No repurposing of content for training without lawful consent
  ([AI_REVIEW_ARCHITECTURE.md](AI_REVIEW_ARCHITECTURE.md#5-safety-fairness--governance)).

## 3. Trust boundaries

| Boundary | Rule |
|---|---|
| Client → application | Never trust tenant/actor/role from the client; resolve from the verified session. |
| Business → creator content | Only submitted work, only per license; raw source stays creator-side. |
| Business ↔ business | No path except audited operator/partnership (existing). |
| Affiliate → library | Hard rules + rank gate, application-layer enforced, signed URLs. |
| Service accounts (AI, ingestion, storage) | Least-privilege, single-purpose, audited. |
| Payout provider | Receives only what's needed to disburse; Partnera holds no cards. |

## 4. Data classification & handling

- **P2 PII** (name/email/payout id) and **P3 sensitive** (gov-id/KYC; biometric-in-content
  such as face/voice) are minimized, access-scoped, and never placed in URLs/query strings
  (existing privacy rule).
- KYC/KYB data is held per provider requirements with strict access + retention (thresholds
  open, OQ-22).
- Content with recognizable people implicates biometric/privacy law (model releases,
  [LEGAL_REVIEW.md](LEGAL_REVIEW.md)).

## 5. Money-path security (reuses fraud spine)

- Platform **fraud floors** (D-054) block payouts to unverified identities above a threshold;
  tenants cannot disable them.
- Idempotency + at-most-once on payment authorization, fee recognition, and payout (D-010).
- Fee **snapshot** prevents silent fee changes on in-flight jobs (D-310).
- All money and access decisions are **append-only + audited**; nothing is edited, only
  compensated.

## 6. Abuse & anti-tamper

- Signed, short-lived asset URLs; re-check on every access; optional watermarking.
- Metadata tamper detection and duplicate/plagiarism indicators on upload.
- Rate limiting and anomaly detection on discovery, application, and download.
- Collusion detection (creator ↔ reviewer, affiliate ↔ business) via graph signals
  ([TRUST_SAFETY_AND_DISPUTES.md](TRUST_SAFETY_AND_DISPUTES.md)).

## 7. Auditability (non-negotiable)

Every sensitive action — access grant/deny, review decision, override, payment
authorization/execution, fee recognition/reversal, license/rank change, moderation access —
is written to the immutable audit log with actor, tenant, correlation, causation, and reason.
