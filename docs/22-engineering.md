# 22 — Engineering Foundation

How the Partnera codebase is organized and built. This documents the platform's
technical skeleton created in Mega Module 2 (Platform Foundation).

## Stack (decided — see [../DECISIONS.md](../DECISIONS.md) D-100…D-107)

| Concern | Choice | Why |
|---|---|---|
| Language | **TypeScript** (strict) | One language across engines and apps; shared types. |
| Monorepo | **pnpm workspaces + Turborepo** | Fast, cache-aware orchestration of many packages. |
| Build/typecheck | **`tsc -b`** project references | Canonical, single-tool, correct build ordering. |
| Tests | **Vitest** | Fast, ESM-native, TS-first. |
| Lint | **ESLint 9 flat config + typescript-eslint** | Modern, type-aware-ready. |
| Format | **Prettier** | Deterministic style. |
| Persistence (target) | **PostgreSQL + Prisma** | Fits multi-tenant + append-only ledger (modeled as contracts this module; no live DB yet). |
| Delivery (target) | **NestJS** (engines) · **Next.js/React** (apps) | Map cleanly to modular engines / three surfaces; wired in a later module. |

### Foundational principle: framework-agnostic domain core

The engines are **pure-domain TypeScript packages** with no dependency on
NestJS, Next, Prisma, or HTTP. This is deliberate: the domain (offers, ledger,
attribution, fraud, permissions) is the part that must survive for years, and
coupling it to a framework now would be exactly the technical debt the brief
forbids. Frameworks are **delivery layers** added on top later.

## Module resolution

Packages use `moduleResolution: "Bundler"` with `module: "ESNext"`. They are
consumed by bundled apps (Next/Nest via SWC), so no file extensions are required
in imports and the source stays clean. If native Node-ESM execution of a package
is ever needed, switch that package to `NodeNext` + explicit `.js` specifiers or
add a bundler build step (documented in DECISIONS).

## Repository layout

```
partnera/
├─ package.json            # workspace root, scripts (verify = typecheck+lint+build+test)
├─ pnpm-workspace.yaml
├─ turbo.json              # task graph (build/typecheck/lint/test)
├─ tsconfig.base.json      # strict compiler options, shared
├─ tsconfig.json           # solution file: references every package
├─ eslint.config.mjs       # flat config
├─ vitest.config.ts        # aliases @partnera/* → package source
├─ .github/workflows/ci.yml
├─ docs/                   # product + engineering documentation (00–22)
└─ packages/
   ├─ core/                @partnera/core            kernel (money, result, ids, tenancy, events, clock)
   ├─ auth/                @partnera/auth            identity, tenancy, RBAC permission engine
   ├─ offer-engine/        @partnera/offer-engine    configurable offer blocks + evaluator
   ├─ tracking-engine/     @partnera/tracking-engine touches + attribution resolver
   ├─ commission-engine/   @partnera/commission-engine append-only ledger + balances
   ├─ fraud-engine/        @partnera/fraud-engine    signals, risk scoring, cases
   ├─ notification-engine/ @partnera/notification-engine channels, templates, retries
   ├─ extension-engine/    @partnera/extension-engine manifest, validation, approval lifecycle
   ├─ analytics/           @partnera/analytics       KPIs, funnels, reports
   ├─ platform/            @partnera/platform        feature flags, audit, config, navigation
   ├─ testing/             @partnera/testing         deterministic test utilities
   └─ ui/                  @partnera/ui              design system (tokens + React components)
```

## Package dependency graph

```
core ──┬── auth
       ├── offer-engine
       ├── tracking-engine
       ├── commission-engine
       ├── fraud-engine
       ├── notification-engine
       ├── extension-engine
       ├── analytics
       ├── platform
       └── testing

ui  (standalone: React + tokens, no domain deps)
```

`core` depends on nothing. Every other domain package depends only on `core`.
Engines do **not** depend on each other — they compose via events/contracts at
the (future) delivery layer, keeping the graph acyclic and the modules
independently testable. `ui` is intentionally isolated from the domain.

## Conventions

- **Ids** are branded types (`UserId`, `OfferId`, …) — never bare strings.
- **Money** is `Money` (bigint minor units); never floats. Serialize via `MoneyJSON`.
- **Errors**: return `Result<T, DomainError>` for expected failures; `throw` only
  for broken invariants (`invariant`, `InvariantViolation`).
- **Time** is injected via `Clock`; never call `Date.now()` in engine logic.
- **Tenancy**: every operational type is tenant-scoped; isolation is an invariant.
- **Money is append-only**: never mutate a balance; append a ledger event.
- **Config over code**: offers, roles, flags, and workflows are data.
- **Type-only imports** use `import type` (enforced by lint).
- **Tests** live beside source as `*.test.ts` and are excluded from build output.

## Commands

| Command | Does |
|---|---|
| `pnpm verify` | typecheck → lint → build → test (the pre-merge gate). |
| `pnpm typecheck` | `tsc -b` across all packages. |
| `pnpm build` | `turbo run build` (per-package `tsc -b`, cached). |
| `pnpm lint` / `pnpm format` | ESLint / Prettier. |
| `pnpm test` | Vitest across the workspace. |

## Notes for this machine

Install scripts are blocked by default; `esbuild` (used by Vitest) is explicitly
allowed via `package.json > pnpm.onlyBuiltDependencies`. pnpm is provided
user-globally (corepack requires admin here).
