# Implementation Status — Creator Marketplace

> Live tracker for the local implementation program (architecture → local install →
> technical certification). **No external providers, no real money, no production.** The
> architecture package (CM0) is the approved design; existing Partnera invariants win on
> conflict. Certification verdict lives in [FINAL_CERTIFICATION.md](FINAL_CERTIFICATION.md).

**Branch:** `feat/creator-marketplace` · **Baseline:** 17 packages, 105 tests green (main).
**Legend:** ✅ done · 🟡 in progress · ⬜ not started · 🔒 external/legal gated (out of local scope).

## Phase 0 — Pre-implementation reconciliation ✅

Green baseline confirmed (`pnpm verify` → typecheck+lint+build+test, 105 tests, exit 0),
clean working tree, dedicated branch created, tracker created.

### Capability → existing-package map (reuse, do not duplicate)

| Creator capability | Reuses | New work |
|---|---|---|
| Identity / users / memberships / tenants | `@partnera/auth`, `@partnera/persistence` identity | Creator = actor (not tenant); per-business relationship |
| Permissions (RBAC) | `@partnera/auth` PermissionEngine + catalog | New permission keys + role templates |
| Append-only money + derived balances | `@partnera/commission-engine` discipline; `@partnera/payment-engine` (separate payout stream precedent) | Creator-payment **append-only event stream** + fee events (same discipline, distinct stream) |
| Payout rails (provider-independent) | `@partnera/payment-engine` `PayoutRail` (`UnconfiguredPayoutRail`) | Creator payout orchestration (simulated in local mode) |
| Fraud signals / cases | `@partnera/fraud-engine` | Creator-domain signals |
| Notifications | `@partnera/notification-engine` | New event types |
| Analytics | `@partnera/analytics` | Role-scoped creator metrics |
| Feature flags / entitlements / audit / config | `@partnera/platform` | Entitlement flags |
| Relational store (append-only/idempotency/concurrency/tenant scope) | `@partnera/persistence` `RelationalStore`/`Collection`/`UnitOfWork` | New collections + repositories |
| Application security spine | `@partnera/application` `ServiceBase` pattern | Creator services |
| UI + SSR shell + local persistence + launcher | `@partnera/web`, `@partnera/ui`, `.partnera/` runtime, `scripts/partnera.*` | Creator surfaces + seed |

### Genuinely new engines
Creator identity graph · opportunity/submission/review lifecycle + scoring · AI-review seam
(mock) · content library + licenses + rank unlocks · creator-payment + platform-fee engine.

### Money-spine reconciliation (invariant-preserving)
Creator money is an **append-only event stream with derived balances and compensating
reversals** — the *same discipline* as the commission ledger, implemented as a **distinct
stream** exactly as `@partnera/payment-engine` already keeps payout events separate from
commission events. This honors D-006/D-315 (append-only, derived, no destructive edits, one
money discipline) without overloading the affiliate `LedgerEvent` (which is keyed on
affiliate+commission). Documented in [PAYMENTS_AND_FEES.md](PAYMENTS_AND_FEES.md) and
[ARCHITECTURE_RECONCILIATION.md](ARCHITECTURE_RECONCILIATION.md).

## Phase tracker

| Phase | Title | Status |
|---|---|---|
| CM0 | Architecture lock | ✅ |
| P0 | Reconciliation & baseline | ✅ |
| P1 | Shared types & configuration | ✅ |
| P2 | Domain engines & state machines | ✅ |
| P3 | Persistence & tenant isolation | ✅ |
| P4 | Application services | ✅ |
| P5 | Creator Portal (UI) | ✅ |
| P6 | Business Creator Dashboard (UI) | ✅ |
| P7 | Platform Admin & moderation (UI) | 🟡 (audit/events reused; dedicated admin creator console deferred) |
| P8 | Content library & affiliate access | ✅ |
| P9 | Human review workflows | ✅ (single + AI-advisory; multi-reviewer deferred) |
| P10 | AI-assisted review preparation (mock) | ✅ |
| P11 | Payment & fee engine (simulated) | ✅ |
| P12 | Notifications & analytics | 🟡 (events emitted + role reads; dashboards partial) |
| P13 | Shopify preparation (contracts/runbooks only) | 🟡 (design locked in SHOPIFY_INTEGRATION.md; no code — correct per scope) |
| P14 | Local installation | ✅ (seed + persistence + restart verified over HTTP) |
| P15 | Deep QA (detect → correct → certify) | ✅ (verify green; live HTTP drive; invariant audit) |
| P16 | Technical certification | ✅ READY FOR LOCAL USE |

## Per-phase log

### P0 ✅
- **Files:** this tracker. **Tests:** baseline 105 green. **Assumptions:** none.
- **Blockers:** none. **Verification:** `pnpm verify` exit 0 on `main` before branching.

### P1 ✅ Shared types & configuration
- **Files:** new package `@partnera/creator-marketplace` — `ids.ts` (branded ids),
  `vocab.ts` (status/format/platform/rights/rank vocabularies + `isMember` guard),
  `config.ts` (fee config in **bps**, 2%–4% validation, fee snapshot, provisional defaults,
  scoring weights), `events.ts` (versioned event names). Registered in `tsconfig.json`,
  `vitest.config.ts`.
- **Tests:** `config.test.ts` (6) — fee range, non-integer rejection, defaults, vocab.
- **Assumptions:** default fee 3% business-paid; SLA 5d; dispute 14d; revisions 2; age 18
  (all provisional, D-330–D-336). **Blockers:** none. **Verification:** `pnpm verify` green.

### P2 ✅ Domain engines & state machines
- **Files:** `state.ts` (opportunity/application/submission/payment/dispute/asset/license
  transition maps + guarded `transition`), `scoring.ts` (weighted score + mandatory-pass
  gates + decision), `money.ts` (creator-payment **append-only event stream**, `computeFee`,
  `assertCreatorAppendable`, `foldCreatorBalances`), `rank.ts` (hard rules + rank-unlock
  resolution), `reputation.ts` (explainable standing), `ai.ts` (AIReviewer contract +
  deterministic mock + `mayAutoApprove`), `entities.ts` (persisted record shapes).
- **Tests:** `state.test.ts` (11), `money.test.ts` (7), `domain.test.ts` (12) — 30 tests
  covering legal/illegal transitions, fee math (business/creator payer), append guard,
  balance folding incl. reversal, scoring mandatory-gate override, rank resolution + leak
  prevention, reputation, AI mock never authorizing payment, `mayAutoApprove` bounds.
- **Assumptions:** creator money is a distinct append-only stream (same discipline as the
  ledger; mirrors payment-engine's payout stream) — documented in P0 reconciliation.
- **Blockers:** none. **Verification:** 18 packages, 140 tests, `pnpm verify` exit 0.

### P3 ✅ Persistence & tenant isolation
- **Files:** `persistence/src/repositories/creator.ts` (`CreatorRepository`), wired into
  `unit-of-work.ts` (16 new collections; append-only versions/reviews/creator-ledger;
  unique constraints for profile-per-user, tenant+slug, opp+creator, asset-license),
  exported from `index.ts`.
- **Tests:** `creator.test.ts` (4) — tenant scoping, append-only rejection, guarded money
  append (illegal-first + legal chain), durable snapshot round-trip (dates + money intact).
- **Assumptions:** creator profiles cross-tenant; business records tenant-scoped.
- **Blockers:** none. **Verification:** workspace 144 tests green.

### P4 ✅ Application services
- **Files:** `application/src/services/creator.ts` (`CreatorService`, reuses `ServiceBase`);
  wired into `createServices`/`Services`. Extended `auth` permission catalog (23 creator
  keys) + roles (business_owner, finance, affiliate, new content_reviewer + creator roles).
  Covers: registerProfile, discover, apply, acceptTerms (fee snapshot lock), submit,
  runAIReview (mock, advisory), decide (approve/revision/reject with scoring + mandatory
  gate), authorizePayment (SoD, fee from snapshot), executePayout (SIMULATED), publishToLibrary,
  createRankRule, resolveAffiliateAccess, myBalances. Business actions = tenant RBAC; creator
  self-actions = identity-ownership authorization (D-316).
- **Tests:** `creator-spine.test.ts` (5) — full end-to-end money spine; money-never-before-
  approval; SoD (approver ≠ authorizer); mandatory-gate blocks approval; RBAC denial; tenant
  isolation. Plus AI-never-authorizes and fee math asserted in the flow.
- **Assumptions:** payer default business (creator keeps full gross); SoD = approver ≠
  authorizer; execute is a separate permission. **Blockers:** real payout provider (🔒 CM14).
- **Verification:** 24 files, 149 tests, `pnpm verify` exit 0.

### P5–P12 ✅/🟡 UI surfaces + seed + review/payment/AI/library
- **Files:** new `web/src/pages/creator.tsx` (Creator Portal + business "Creators" section +
  affiliate Content Library); new **"creator" AppScope** across `auth.ts`, `nav.ts`,
  `shell.tsx` (app switcher + titles), `app.tsx` (routing + creator/business workflow POST
  handlers), `login.tsx` (scope + demo user). `business.tsx`/`affiliate.tsx` routers wire the
  new sections. `demo.ts` seed extended: a full creator flow through the **real services**
  (register → program/campaign/opportunity → publish → apply → accept (fee snapshot) →
  submit → AI advisory → approve → authorize → **SIMULATED** payout → publish to library →
  rank rule), plus a second opportunity left in the review queue. Creator user **Cora**
  (`cora@creators.test`). Read methods added to `CreatorService` for the UI (permission-gated).
- **Surfaces:** Creator Portal (overview/discover/jobs/earnings/profile); Business Creators
  (dashboard/opportunities/review queue/payments/library) with approve/reject/revision +
  authorize/execute(sim)/publish actions; Affiliate Content Library (rank-gated unlock view).
  All render **real service data**; local storage + payouts are clearly labelled SIMULATED.
- **Tests:** 5 new web tests (creator portal earnings $150 simulated; business dashboard +
  review queue; affiliate rank unlock; apply workflow; SoD-safe payments view). Existing 17
  web tests unchanged and green.
- **Deferred (honestly):** dedicated Admin creator-moderation console (audit/events reused
  now); multi-reviewer approval UI; full analytics dashboards; page-builder UI (P13 Shopify
  prep, P-analytics dashboards) — tracked, not built.
- **Verification:** 24 files, **154 tests**, `pnpm verify` exit 0 (3 pre-existing warnings).

### P14–P16 ✅ Local installation, QA, certification
- **P14:** the creator module runs inside the existing local app (`pnpm --filter @partnera/web
  serve` / launcher). Seed runs the real creator spine; **verified live over HTTP**: creator
  portal (earnings $150 simulated), business review queue + payments, affiliate rank-unlocked
  library; a live approve created an authorizable payable; **restart loaded existing data and
  the payable persisted** (durable `.partnera/data.json` covers all creator collections).
- **P15:** three-pass QA — `pnpm verify` green (typecheck+lint+build+154 tests); live HTTP
  drive of every new surface; invariant/security audit (see certification §5). No Critical/High.
- **P16:** [FINAL_CERTIFICATION.md](FINAL_CERTIFICATION.md) → **CREATOR MARKETPLACE READY FOR
  LOCAL USE**. Payouts/AI/storage simulated + labelled; external activation not started.

## Summary
Local build complete through certification: pure-domain engine → persistence → permission-aware
services → UI across creator/business/affiliate → local install + persistence, all green and
verified. **External activation (real money, providers, Shopify, deployment, legal) not started
— by design.**

---

## Phase 2 — Configurable Business Programs & Content Operations ✅

Extended (not rebuilt) the certified module so every business controls its own program.
**Workspace 26 packages test-files / 176 tests green; live HTTP + restart verified.**

### Locked clarifications now enforced in code
- **Businesses configure their own categories & payments.** `EvaluationScheme` + custom
  `EvaluationCategory[]` (name/description/order/color/band/payment/payable/library/affiliate/
  human-approval). Partnera imposes none. Supports **one or more** categories (four never
  required). `saveScheme`/`validateScheme`. PrimeBuild's **$0/$10/$20/$35** is seeded as
  **editable PrimeBuild data**, not a global constant; UI carries the "Partnera does not
  determine creator compensation" notice.
- **AI recommends a category; the business config maps category → payment.** Two advisory
  scores (`mockTwoScoreReview`: technical + commercial) + recommended category; the human
  confirms the category and the **scheme** sets the money (`reviewWithScheme`). AI never sets
  or releases payment.
- **Capacity & budget are configurable; over-limit content waits, never auto-rejected.**
  `ProgramCapacity` + `ProgramBudget` + `capacityGate` route accepted-but-over-limit items to
  `waiting_for_capacity` / `waiting_for_budget`; `computeExposure` shows committed/paid/
  remaining/projected-fee before accepting more. Waiting Queue UI with promote/retain/archive.
- **Pay / quality / reuse are independent decisions.** `SubmissionDisposition` has separate
  fields (paymentEligible, categoryKey, libraryStatus, affiliateAccess, editingStatus,
  commercialStatus, legalStatus, internalUse). Low-score content can be retained internal_only.
- **Money-flow clarity.** Review workspace shows per-category creator payment / Partnera fee /
  business total / creator net; fee snapshot locked at acceptance (unchanged).
- **Provisional plans/trials + disclosed promotional channels** (`BusinessPlanDefinition`,
  `BusinessTrialState`, `PromotionalChannel`, `PromotedPlacement`) seeded as editable local
  data; **no billing, no paid media**; every placement carries a disclosure.

### Files
- Engine: `programs.ts` (+ vocab queue/disposition, ai two-score, new ids). Persistence:
  8 new collections in `UnitOfWork` + `CreatorRepository` methods. Application: `saveScheme`,
  `setCapacity`, `setBudget`, `exposureFor`, `recommend`/`recommendPreview`, `reviewWithScheme`,
  `setDisposition`, `promoteFromQueue`, reads. Web: Program Setup, Waiting Queue, scheme-driven
  Review Workspace; PrimeBuild pilot seed.

### Tests
- `programs.test.ts` (10, engine), `creator-programs.test.ts` (8, service incl. negatives:
  creator can't configure, tenant-isolated scheme, AI never pays), 4 new web tests.

### Deferred (honest, non-blocking for local pilot)
- Full page-builder UI, admin promo-channel console, plan-management UI, multi-reviewer screens
  (domain/data present; screens minimal). Shopify prep remains contracts/runbooks only.

### External gates (🔒 unchanged, not crossed)
Real payments/providers, Shopify install, external AI, production DB, deploy, legal launch.

---

## Phase 3 — UX Simplification & Commercial Readiness ✅

Turned the technically-complete module into a clear, professional, easy-to-operate product.
**26 packages / 180 tests green; live daily-use sweep + restart verified.**

### Delivered
- Removed internal architecture jargon from user-facing pages (automated no-jargon test + live
  scan, 0 hits); commercial nav labels; role-focused business home with a dismissible **first-run
  checklist**; a 10-step **Setup guide** wizard; itemised **simulated-payment breakdown**
  (creator pay / Partnera fee / business total / creator net + "no money moved"); **`ConfirmButton`**
  no-JS confirmation before authorize/pay/publish (no accidental single click); improved empty
  states; pilot seed now leaves an **approved payable** so the authorize step is demonstrable.
- Files: `components.tsx` (`ConfirmButton`), `shell.tsx`, `nav.ts`, `page.ts`+`app.tsx` (cookie
  thread + checklist routes), `pages/creator.tsx` (home, setup guide, payments, confirmations),
  `pages/business.tsx`/`pages/admin.tsx` (wording), `demo.ts` (approved-payable seed).
- Docs: `UX_AUDIT.md`, `UX_RELEASE_STATUS.md`; updated certification.

### Verdict
[FINAL_CERTIFICATION.md](FINAL_CERTIFICATION.md) → **PARTNERA READY FOR REAL-WORLD LOCAL PILOT**.
Deferred (non-blocking): business content-library grid/filters, admin promo/plan consoles,
opportunity-creation wizard/templates. External gates unchanged.

## Stop line (never crossed locally)
Real payment providers · real money movement · real payout credentials · Shopify production /
store install · external AI providers · public deployment · real creator personal/financial
data · legal/commercial launch. These are 🔒 external-activation gates (CM14+), documented not
executed.
