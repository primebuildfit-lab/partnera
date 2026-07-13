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
| P1 | Shared types & configuration | ⬜ |
| P2 | Domain engines & state machines | ⬜ |
| P3 | Persistence & tenant isolation | ⬜ |
| P4 | Application services | ⬜ |
| P5 | Creator Portal (UI) | ⬜ |
| P6 | Business Creator Dashboard (UI) | ⬜ |
| P7 | Platform Admin & moderation (UI) | ⬜ |
| P8 | Content library & affiliate access | ⬜ |
| P9 | Human review workflows | ⬜ |
| P10 | AI-assisted review preparation (mock) | ⬜ |
| P11 | Payment & fee engine (simulated) | ⬜ |
| P12 | Notifications & analytics | ⬜ |
| P13 | Shopify preparation (contracts/runbooks only) | ⬜ |
| P14 | Local installation | ⬜ |
| P15 | Deep QA (detect → correct → certify) | ⬜ |
| P16 | Technical certification | ⬜ |

## Per-phase log

### P0 ✅
- **Files:** this tracker. **Tests:** baseline 105 green. **Assumptions:** none.
- **Blockers:** none. **Verification:** `pnpm verify` exit 0 on `main` before branching.

*(Phases below are appended as they land, each with files / tests / assumptions / blockers /
verification, and each committed as a milestone keeping `pnpm verify` green.)*

## Stop line (never crossed locally)
Real payment providers · real money movement · real payout credentials · Shopify production /
store install · external AI providers · public deployment · real creator personal/financial
data · legal/commercial launch. These are 🔒 external-activation gates (CM14+), documented not
executed.
