# Review & Scoring — Creator Marketplace

> **Part 6 (review half).** Human and AI-assisted evaluation of submissions. The AI
> engine detail is in [AI_REVIEW_ARCHITECTURE.md](AI_REVIEW_ARCHITECTURE.md). Core rule
> (D-307): **AI never silently releases payment by default.**

## 1. Reviewer roles

| Reviewer | Scope |
|---|---|
| **Business owner** | Full review authority in their tenant. |
| **Authorized employee** | Assigned campaigns; may be approve-capable or recommend-only. |
| **Contractor / delegated reviewer** | Assigned campaigns; bounded approval (value cap). |
| **Partnera moderator** | Trust-safety / dispute / policy review only — not creative taste. |
| **AI review service** | Advisory scores + objective checks; access to the single submission only. |

**Separation of duties:** a reviewer cannot review their own submission; where configured,
the person who **approves** content is not the person who **authorizes payment**; multi-
reviewer approval requires N distinct reviewers. Recusal for any conflict of interest.

## 2. Approval modes (configurable per opportunity/plan)

1. **Human only** — no AI; a person decides everything.
2. **AI recommendation + human decision** — AI scores/flags; a human always decides.
3. **AI pass for objective technical checks + human creative review** — AI auto-verifies
   measurable specs (dimensions/duration/format/CTA-present/language); a human judges
   creativity/brand/fit and makes the payable decision.
4. **Automated approval for low-risk, clearly-measurable requirements — only if explicitly
   enabled** — bounded auto-approve for objective-only deliverables under a value ceiling,
   off by default, always audited and overridable (D-336). Never for creative/subjective
   or high-value work.

No mode allows AI to move money without either a human decision or an explicit, bounded,
audited automation the business turned on.

## 3. Automated safety gate (always first, non-negotiable)

Runs before any scoring, in **every** mode:
- malware / CSAM scan (hard fail → reject + escalate),
- file-type / size / format validation,
- duplicate-content and plagiarism indicators,
- metadata sanity / tamper checks.

A hard-fail here blocks review entirely and cannot be overridden by score.

## 4. Scoring model

Configurable weighted categories producing a 0–100 score, **plus** mandatory-pass gates.
Starter template (weights are defaults; OQ-12):

| Category | Weight | Nature |
|---|---|---|
| Brief compliance | 30% | Coverage of required talking points / requirements |
| Technical quality | 20% | Resolution, audio, lighting, stability |
| Brand alignment | 20% | Guideline adherence, tone |
| Creativity | 15% | Originality, hook, engagement potential |
| Product clarity | 10% | Product visible, understandable |
| **Legal/safety compliance** | mandatory pass | Prohibited claims, rights, safety |
| **File requirements** | mandatory pass | Dimensions/duration/type/size |

### Thresholds (configurable)
- `min_score` for approval (e.g. 70).
- `revision_threshold` band (e.g. 50–69 → request revision by default).
- `rejection_threshold` (e.g. <50 → reject candidate).
- **Any mandatory-pass failure ⇒ not approvable**, regardless of weighted score.

### Score record (per review, immutable — audit + appeals)
`submissionId · versionId · reviewerId|aiRunId · perCategoryScores · weightedTotal ·
mandatoryResults · decision · reason · confidence · modelVersion? · timestamp · overrideOf?`

## 5. Decision outcomes

- **Approve** → deliverable becomes payable ([STATE_MACHINES.md](STATE_MACHINES.md#4-payment-per-payable-deliverablemilestone))
  and (optionally) a library asset on license terms.
- **Request revision** → job stays open; creator resubmits a new version; re-review;
  bounded by `revision_allowance`.
- **Reject** → terminal for the submission; creator may **appeal**/open a **dispute** in
  the window.

## 6. Overrides, appeals, and audit

- Any human reviewer with authority may **override** an AI recommendation; the override is
  recorded with a reason and linked to the AI run.
- A creator may **appeal** a rejection or revision loop; appeals route to a different
  reviewer or a Partnera moderator (never the original decider alone).
- Every score, flag, model version, reviewer identity, and override is retained for the
  dispute/appeal window and audit ([TRUST_SAFETY_AND_DISPUTES.md](TRUST_SAFETY_AND_DISPUTES.md)).

## 7. Fairness principles

- Reviews judge the **submission against the versioned spec** the creator accepted, not
  shifting expectations.
- AI outputs are **explainable** (which requirement, which evidence) — no opaque scores.
- Automated-decision **appeal rights** are designed in (legal scope OQ-26).
- Reputation effects of a rejected submission are dampened while an appeal/dispute is open.
