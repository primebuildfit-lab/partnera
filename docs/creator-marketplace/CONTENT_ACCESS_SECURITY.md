# Content Access Security — Creator Marketplace

> **Part 7 (security half).** How content access is enforced structurally, not by
> convention. Extends [SECURITY_MODEL.md](SECURITY_MODEL.md); complements
> [CONTENT_LIBRARY.md](CONTENT_LIBRARY.md) and [RANK_UNLOCKS.md](RANK_UNLOCKS.md).

## 1. Hard access rules (must always hold)

An affiliate can access an asset **only if all** of the following are true:
1. The affiliate is enrolled in the **same business** (tenant) as the asset.
2. The asset is `published` (not draft/pending/rejected/withdrawn).
3. The asset's license is `active` or `expiring` (not `expired`/`revoked`).
4. The asset's license **permits affiliate distribution** and the intended platform/geo.
5. The affiliate **meets a rank unlock rule** ([RANK_UNLOCKS.md](RANK_UNLOCKS.md)) with no
   explicit deny override.
6. The affiliate is in **good standing** (not blocked/suspended).

Any single failure ⇒ **no access**. These are enforced at the application layer on every
access, not just at UI render.

## 2. Never-accessible to affiliates

Drafts · rejected content · expired/revoked licenses · content of any **other** business ·
assets **above** their rank · internal-only files · **creator-private source material**
(raw/unsubmitted). These are excluded by the query itself (deny-by-default), so they cannot
leak through pagination, search, direct-id lookup, or a stale link.

## 3. Tenant & actor scoping

- Tenant comes from the **authenticated context**, never client input (inherited invariant).
- Cross-tenant access exists only via **audited operator/moderation/dispute** paths.
- A dual creator/affiliate user's two capability sets are resolved **independently**; being
  a creator on business A grants no affiliate access to business A's library and vice versa.

## 4. Signed, time-limited delivery

- Asset bytes are served only via **short-lived signed URLs** minted after a full
  permission + license + rank check — never public, guessable, or long-lived.
- Each mint is authorized and (for sensitive/premium assets) logged; re-download re-checks
  the rules, so a rank downgrade or license expiry cuts access even mid-session.
- Optional **watermarking / forensic tagging** for premium/exclusive assets to deter and
  trace leaks.

## 5. Creator source-material isolation (D-316)

- A creator's **unsubmitted** work and **raw source** are creator-owned and invisible to
  businesses until submitted, and thereafter only to the extent the license grants.
- The AI review service sees **only** the exact submission under review
  ([AI_REVIEW_ARCHITECTURE.md](AI_REVIEW_ARCHITECTURE.md#6-isolation-of-the-ai-service)),
  never the creator's broader portfolio or other jobs.
- Businesses never see other businesses' engagements with the same creator.

## 6. Content-safety scanning

- Every upload is scanned (malware, CSAM) before it is reviewable; CSAM triggers immediate
  block, preservation, and escalation per [TRUST_SAFETY_AND_DISPUTES.md](TRUST_SAFETY_AND_DISPUTES.md).
- Duplicate/plagiarism/rights indicators run pre-review and feed the safety gate.

## 7. Retention & deletion

- Retention differs by class: approved assets (per license), rejected submissions (short),
  raw source (shortest, per policy), dispute evidence (held through the dispute + legal
  window). Exact windows are open (OQ-33) and counsel-gated.
- Deletion is honoured for personal data per privacy law, **except** where lawful hold
  (dispute/fraud/legal) requires preservation; money/audit records are retained as
  append-only history (personal data within them minimized/redacted, not the ledger fact).

## 8. Auditability

Every access grant/deny decision on sensitive assets, every signed-URL mint for premium
content, every license/rank change, and every moderation access is written to the immutable
audit log with actor, tenant, correlation id, and reason.
