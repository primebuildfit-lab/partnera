# AI Review Architecture — Creator Marketplace

> **Part 6 (AI half).** How AI-assisted review is structured so it is safe, explainable,
> bounded, and non-custodial of decisions. Documentation-only; **no AI provider is chosen
> or connected** (OQ-14). Governing rule: **D-307 — AI never silently releases payment by
> default.**

## 1. Position in the pipeline

AI review is an **advisory service** invoked between the automated safety gate and the
human decision (except in the explicitly-enabled bounded-auto mode for objective checks).
It **produces evidence**; it does not, by default, **decide money**.

```
safety gate (mandatory) → AI review (advisory) → human decision (default) → payable
                                        └─ bounded-auto (opt-in, objective-only, capped)
```

## 2. What AI may evaluate

Objective (machine-verifiable, auto-pass candidates): resolution, aspect ratio, duration,
audio presence/quality, file/format, language detection, CTA presence, product visibility,
brand-mark presence, duplicate/plagiarism indicators.

Advisory (scored, human-confirmed): technical quality (lighting/stability), branding
adherence, requirement/brief coverage, creativity signal, overall quality.

Risk flags (surface to humans/moderation, never auto-approve): prohibited/unsafe content,
prohibited claims (medical/health/earnings), policy violations, likely-undisclosed
AI-generated content, text accuracy, brand impersonation.

## 3. AI Review Run (record)

Each run produces an immutable `AIReviewRun`:
`submissionId · versionId · modelVersion · prompt/policyVersion · inputsHash ·
perCheckResults · scores · flags · confidence · recommendation · explanation ·
startedAt · completedAt · cost? · error?`

The run is linked to the review record and retained for audit/appeals. A submission may
have multiple runs (re-review after revision, or model upgrade during a dispute).

## 4. Approval-mode enforcement

| Mode | AI role | Who moves money |
|---|---|---|
| Human only | not invoked | human |
| AI recommend + human decide | scores + flags + recommendation | human |
| AI objective-pass + human creative | auto-verifies objective specs; advisory on the rest | human |
| Bounded automated (opt-in) | auto-approve **objective-only** deliverables under value cap | automation, audited, overridable |

Bounded automation is gated by: explicit business enablement, an objective-only deliverable
(no subjective categories), a per-transaction **value ceiling**, a **confidence floor**,
no open risk flags, and a mandatory audit entry. Any doubt → route to human.

## 5. Safety, fairness & governance

- **Explainability required:** every score/flag cites the requirement and the evidence; no
  opaque numbers. Feeds the creator's feedback and any appeal.
- **Human override always available** and recorded against the run.
- **Appeal path** for automated decisions (OQ-26); a human/moderator reviews.
- **Bias & drift:** model version pinned per run; periodic calibration against human
  decisions; disputed categories can be excluded from automation.
- **Confidence + abstention:** low confidence ⇒ abstain and escalate, never guess-approve.
- **No training on private content without consent:** creator source material and business
  submissions are not repurposed for model training absent explicit, lawful consent
  ([LEGAL_REVIEW.md](LEGAL_REVIEW.md), [SECURITY_MODEL.md](SECURITY_MODEL.md)).

## 6. Isolation of the AI service

The AI review service is a **service principal** with access to **exactly one submission's
files + the versioned requirement spec** for the duration of the run — nothing else: not
other submissions, not other creators, not other tenants, not the library
([SECURITY_MODEL.md](SECURITY_MODEL.md#ai-review-service)). Inputs are passed explicitly;
the service holds no ambient tenant scope.

## 7. Provider independence

AI review sits behind an `AIReviewer` contract (submit inputs → get an `AIReviewRun`).
Providers (hosted vision/LLM, in-house models) are adapters chosen at build time. No
provider is referenced or connected here. Disclosure to creators that AI-assisted review
is used is a designed obligation (legal scope OQ-26).

## 8. Determinism & auditability

Runs are reproducible to the extent the provider allows (pinned model + policy version +
inputs hash). Non-determinism is acknowledged and mitigated by recording the exact
version/config, so a decision can always be explained after the fact.
