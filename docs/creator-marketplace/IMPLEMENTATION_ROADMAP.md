# Implementation Roadmap — Creator Marketplace

> **Part 17.** Phased plan from documentation to a locally-installed product, without
> rushing deployment. **No phase is authorized or implemented yet** — this is the plan.
> Phases use the **CM0–CM16** namespace to avoid colliding with the affiliate-core "Mega
> Module" numbering (MM5 = Live Infrastructure). Recommended: start CM only **after** the
> affiliate-core Phase-1 exit (live infra), reusing that infrastructure.

Each phase preserves every existing invariant, keeps `pnpm verify` green, and changes no
engine interface unless a phase explicitly and safely adds one. External gates (counsel,
providers) are called out; they **stop** the dependent phase until cleared.

---

### CM0 — Architecture lock ✅ (this deliverable)
- **Objective**: authoritative, self-consistent documentation set; decisions locked; open
  questions catalogued.
- **Deliverables**: this `docs/creator-marketplace/` set; root-doc integration.
- **Acceptance**: all documents exist, links resolve, terms consistent, self-audit passes.
- **Stop conditions**: none (docs only). **External gates**: none.

### CM1 — Shared types & configuration
- **Objective**: branded ids, enums/state types, fee-config + snapshot types, event/DTO
  contracts — as pure types, no logic.
- **Prereq**: CM0. **Deliverables**: `@partnera/creator-*` type additions (or a
  `creator-core` package) + config schemas. **Tests**: type-level + config validation.
- **Acceptance**: compiles green; no engine touched. **Risks**: naming conflicts (see
  [ARCHITECTURE_RECONCILIATION.md](ARCHITECTURE_RECONCILIATION.md)).

### CM2 — Domain engines & state machines
- **Objective**: pure-domain engines: opportunity/submission/review/payment-reason state
  machines, scoring, fee calculation (from snapshot), rank-unlock resolution — deterministic,
  `Result`-returning, `Clock`-injected.
- **Prereq**: CM1. **Deliverables**: engine packages (depend only on `core`). **Tests**:
  exhaustive transition + scoring + fee-snapshot + resolution tests.
- **Acceptance**: engines green, no I/O, no sibling deps. **Stop**: none.

### CM3 — Persistence & tenant isolation
- **Objective**: repository ports + in-memory relational store for the new entities;
  append-only + idempotency + concurrency + tenant/creator scoping; canonical schema spec.
- **Prereq**: CM2. **Deliverables**: repos behind the existing seam; ledger reason
  extensions (no ledger redesign). **Tests**: same contract tests as existing stores;
  isolation/append-only. **Acceptance**: parity with existing store discipline.

### CM4 — Creator Portal
- **Objective**: creator profile/portfolio, discovery, apply, submit, revise, earnings,
  reputation — over the services.
- **Prereq**: CM3. **Deliverables**: creator surface in `@partnera/web`. **Tests**: flows +
  RBAC + a11y. **External gate**: minimum-age/KYC stance (OQ-21/22) affects onboarding.

### CM5 — Business Creator Dashboard
- **Objective**: program/campaign/opportunity/deliverable management, review workspace,
  payments, staff permissions.
- **Prereq**: CM3/CM4. **Deliverables**: business surface. **Tests**: management flows +
  permission scoping + SoD.

### CM6 — Admin moderation console
- **Objective**: cross-tenant (audited) moderation, disputes, fraud, fee-config guardrails,
  network stats.
- **Prereq**: CM3. **Deliverables**: admin surface. **Tests**: audited-access + escalation.

### CM7 — Content library & affiliate-rank unlocks
- **Objective**: approved-asset library, licenses, rank unlock rules, affiliate access with
  signed URLs; usage tracking.
- **Prereq**: CM3/CM5. **Deliverables**: library + access enforcement. **Tests**: hard
  access rules, rank resolution, license expiry. **External gate**: storage/CDN provider
  (OQ-30); license defaults (OQ-20).

### CM8 — Human review workflows
- **Objective**: multi-reviewer, SoD, scoring, revisions, overrides, appeals; SLA + escalation.
- **Prereq**: CM5. **Tests**: SoD, recusal, appeal routing. **External gate**: none.

### CM9 — AI-assisted review preparation
- **Objective**: `AIReviewer` seam, run records, approval-mode enforcement, bounded-auto
  guardrails, isolation of the AI service — **no provider connected**.
- **Prereq**: CM8. **Tests**: mode enforcement, "no silent auto-pay", isolation, override.
- **External gate**: AI provider + automated-decision-disclosure counsel (OQ-14/26).

### CM10 — Payment-provider abstraction
- **Objective**: fee snapshot → recognition → payout events on the existing ledger; provider-
  independent `PayoutRail` for creator payments; funding model; reversal/fee-reversal.
- **Prereq**: CM3. **Tests**: idempotency, SoD, reversal, fee-snapshot immutability.
- **External gate**: 🔴 custodial stance (D-106), payout provider + KYC/tax (OQ-03/22),
  fee/payer decisions (OQ-01/02) — **blocks real money movement**.

### CM11 — Shopify embedded surfaces & page builder
- **Objective**: page-builder rendering across channels; Shopify embedded app + app blocks +
  widgets as adapters.
- **Prereq**: CM4/CM5/CM7. **Tests**: renderer parity across channels; viewer-scoped data.
- **External gate**: Shopify app registration/scopes (explicit, audited).

### CM12 — Local installation & daily-use mode
- **Objective**: run the whole module in the existing local file-persistence tier
  (`.partnera/data.json`), seeded through the real services — daily-usable with no external
  providers (money paths in simulated/unconfigured-rail mode).
- **Prereq**: CM4–CM8, CM11 (basic). **Acceptance**: installs + runs locally; verify green.

### CM13 — Technical certification
- **Objective**: full invariant audit (isolation, append-only, idempotency, SoD, no-arbitrary-
  code, explainability), security review, load/derivation-cost check.
- **Prereq**: CM12. **Acceptance**: certification checklist passes; risk register updated.

### CM14 — External-provider activation
- **Objective**: connect real payout provider + storage/CDN + (optional) AI provider behind
  the seams, in a controlled environment.
- **Prereq**: CM13 + all CM10 external gates cleared. **Stop**: do not activate money movement
  until D-106 + KYC/tax + jurisdictions are cleared.

### CM15 — Pilot with PrimeBuild
- **Objective**: one real creator-work flow end-to-end (opportunity → submission → review →
  payment → library → affiliate use) with PrimeBuild as first customer only.
- **Prereq**: CM14. **Acceptance**: one real approved deliverable paid with correct fee +
  net, fully audited; content unlocked to an affiliate by rank. **External gate**: counsel
  sign-off on terms/disclosures.

### CM16 — Commercial UX & marketplace launch
- **Objective**: polish, onboarding, discovery liquidity, plans/entitlements, broader
  businesses.
- **Prereq**: successful pilot. **External gate**: pricing (OQ-41), supported countries
  (OQ-23), plan structure.

---

## Cross-phase always-on
- Keep [DECISIONS.md](DECISIONS.md), [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md),
  [RISK_REGISTER.md](RISK_REGISTER.md), and the root docs current.
- Never regress an invariant; security + counsel gate every money/content-rights release.
- Do not implement any phase without explicit human go-ahead (design-only guardrail).
