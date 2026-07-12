# Contributing to Partnera

## Prerequisites

- Node ≥ 20
- pnpm 9 (`npm i -g pnpm@9` if corepack is unavailable)

## Getting started

```bash
pnpm install
pnpm verify   # typecheck + lint + build + test
```

## Golden rules (do not violate)

These encode the platform's core invariants. A PR that breaks one should not merge.

1. **Platform-first.** No feature is designed for one tenant. PrimeBuild is just
   Tenant #1.
2. **Configuration over code.** New commercial behavior is new *data*
   (offer blocks, roles, flags), not new branches.
3. **Money is append-only.** Never mutate a balance. Append a ledger event.
   Balances are always derived.
4. **Tenant isolation.** Every operational record is tenant-scoped. No
   cross-tenant access except audited operator paths and agreed partnerships.
5. **No arbitrary code execution** for extensions. Declarative-first, sandboxed
   exception only.
6. **Explainability.** Every commission records the offer version + block path +
   attribution basis.
7. **Deterministic engines.** Inject `Clock`; brand your ids; return `Result`
   for expected failures.

## Coding standards

- TypeScript strict; no `any` without justification (lint warns).
- Branded ids (`UserId`), `Money` for money, `Result` for expected failures.
- `import type` for type-only imports (lint enforces).
- Tests beside source as `*.test.ts`; keep engines pure and mock-free where
  possible. See [TESTING.md](TESTING.md).
- Engines depend only on `@partnera/core`, never on each other.

## Decisions

Record any meaningful architectural or product decision in
[DECISIONS.md](DECISIONS.md). Update [BUILD_STATUS.md](BUILD_STATUS.md) when the
build state changes.

## Commit / PR

- Small, focused commits. Run `pnpm verify` before pushing.
- Never weaken a money or authorization invariant to make a test pass.
