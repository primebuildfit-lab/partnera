# Testing Architecture

Testing strategy for the Partnera platform foundation.

## Philosophy

The foundation is **pure domain logic**, which is the easiest kind of code to
test well: deterministic inputs, deterministic outputs, no I/O. We exploit that.
Money, attribution, ledger projection, permissions, fraud scoring, and offer
evaluation are all covered by fast unit tests with zero mocks.

## Layers

| Layer | Scope | Tooling | Status |
|---|---|---|---|
| **Unit** | A single engine function/aggregate in isolation. | Vitest | ✅ in place |
| **Contract** | An engine against an in-memory implementation of a store interface. | Vitest + `@partnera/testing` | ▶ ready (stores are interfaces) |
| **Integration** | Multiple engines wired via the event bus. | Vitest | ▶ next module (delivery layer) |
| **E2E** | A full surface (app) flow. | Playwright (planned) | ⏳ when apps exist |

## Conventions

- Test files live **beside the code** they cover: `foo.ts` → `foo.test.ts`.
- Tests are excluded from build output (`tsconfig` excludes `*.test.ts`) and run
  only by Vitest.
- Vitest resolves `@partnera/*` to package **source** (see `vitest.config.ts`),
  so tests never require a prior build.
- **Determinism is mandatory**: use `FixedClock` and `SequentialIdGenerator`
  from `@partnera/testing`; never rely on wall-clock time or random ids.
- One behavior per `it`; describe blocks named after the unit under test.
- Money assertions use `.toDecimalString()` for readable expectations.

## Shared helpers — `@partnera/testing`

- `FixedClock` — deterministic time (re-exported from core).
- `SequentialIdGenerator` — readable, stable ids (`offer_1`, `offer_2`).
- `usd()` / `eur()` — money constructors.
- `InMemoryRepository<T>` / `InMemoryEventBus` — wire engines without a database.

## What is covered today (47 tests)

- **core**: Money parsing, arithmetic, basis-point rounding, allocation (no lost
  minor units), JSON round-trip, comparison.
- **auth**: deny-by-default, exact + wildcard grants, platform-admin `*`,
  separation-of-duties.
- **offer-engine**: percentage on order total, product-scoped base, condition
  failure, per-conversion cap, schedule window, rejection of stateful calcs.
- **commission-engine**: pending→available→paid projection, adjustments as
  events, reversed bucket, illegal-transition guard.
- **tracking-engine**: attribution window, last/first touch, precedence tie-break.
- **fraud-engine**: weighted scoring, band→action, score cap, hard-floor review.
- **notification-engine**: capped backoff, retry→dead-letter, template render,
  preference gating.
- **extension-engine**: manifest validation, least-privilege, approval
  transitions, engine compatibility.
- **analytics**: KPI count/sum/unique, ordered funnel with conversion rates.
- **platform**: flag default/plan/tenant/rollout evaluation.

## Coverage intent

Correctness-critical modules (money, ledger, offer evaluation, permissions,
attribution) target the highest coverage. The rule: **every money path and every
authorization path has a test before it ships**.

## CI

`.github/workflows/ci.yml` runs `pnpm verify` (typecheck → lint → build → test)
on push/PR. See [docs/22-engineering.md](docs/22-engineering.md).
