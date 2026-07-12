# TECHNICAL_HANDOFF

Everything a new engineer (or AI session) needs to continue after Mega Module 3.
Read [docs/PROJECT_CONTEXT.md](docs/PROJECT_CONTEXT.md) first; this is the
build-level companion.

## Run it

```bash
pnpm install
pnpm verify        # typecheck → lint → build → test  (the gate; must stay green)
pnpm test          # 98 tests / 16 files
pnpm --filter @partnera/web serve   # bundles + starts the apps at http://localhost:4000
#   sign in: owner@primebuild.test · brian@primebuild.test (affiliate) · admin@partnera.test
```

Machine note: install scripts are blocked by default; `esbuild` is allow-listed
via `package.json > pnpm.onlyBuiltDependencies`. Run `npm approve-scripts` if
Prisma/esbuild ever misbehave. pnpm is user-global (corepack needs admin here).

## Package map (16)

Kernel/engines (unchanged this module): `core`, `auth`, `offer-engine`,
`tracking-engine`, `commission-engine`, `fraud-engine`, `notification-engine`,
`extension-engine`, `analytics`, `platform`, `testing`, `ui`.

Delivery/persistence/domain (MM3):
- `payment-engine` — append-only payout events, state machine, `PayoutRail`.
- `persistence` — repository ports + relational store + `prisma/` + `sql/`.
- `application` — permission-aware services (`createServices(deps, rail?)`), incl. `QueryService` (reads).
- `http-api` — `buildApiRouter(services)` + `Router` + error mapping.

Presentation (MM4):
- `web` — three SSR React apps over the services. Entry points: `handle(world, req)`
  (`src/app.tsx`), `createDemoWorld()` (`src/demo.ts`), `AppShell` (`src/shell.tsx`),
  auth prep (`src/auth.ts`). Rendered via `react-dom/server`; `pnpm --filter @partnera/web serve`.

## How to wire a running system (deploy checklist)

1. **Database** — implement a Prisma-backed store exposing the same `Collection`
   surface as `relational/store.ts`; construct `UnitOfWork` over it. Generate the
   client (`prisma generate`) and run `prisma migrate deploy` + `sql/0001_init.sql`.
   *No engine or application change is required.*
2. **Ids** — inject a real `IdGenerator` (UUIDv7/ULID) into `AppDeps`.
3. **Auth** — an authentication adapter builds `RequestContext` from the verified
   session/token (never from request bodies) and calls the services/router.
4. **HTTP host** — a NestJS/Express host adapts requests into `HttpRequest` and
   calls `Router.handle`; map `HttpResponse.status/body` back.
5. **Commerce adapter** — normalize platform orders/refunds into
   `NormalizedOrder`/`Refund` and call `TrackingService.ingestOrder` /
   `processConversion` / `recordRefund`.
6. **Payout rail** — implement `PayoutRail` for a real provider and pass it to
   `createServices(deps, rail)`.

## Key entry points

- Money spine: `TrackingService.processConversion` (`application/src/services/tracking.ts`).
- Ledger: `LedgerRepository.appendGuarded` (`persistence/src/repositories/ledger.ts`).
- Commission lifecycle: `LedgerService` (`application/src/services/ledger.ts`).
- Payouts: `PaymentService` (`application/src/services/payment.ts`).
- Security spine: `ServiceBase` (`application/src/context.ts`).
- Store invariants: `RelationalStore` / `Collection` (`persistence/src/relational/store.ts`).

## Invariants you must not regress

Append-only money (derived balances) · tenant isolation from context, never
client input · idempotency/at-most-once on money events · explainable + versioned
commissions · deterministic engines (inject `Clock`, brand ids) · config over
code · no engine depends on persistence/application/delivery.

## Open decisions blocking production

D-102b (physical tenancy), D-104 (auth provider), D-105/D-106 (payment rails /
custodial stance — counsel-gated), D-101 (hosting). See [DECISIONS.md](DECISIONS.md).

## Recommended next: Mega Module 5 — Live Infrastructure & Pilot

Prisma-backed store (same ports/tests) on live Postgres + NestJS/Next production
host wrapping `@partnera/web` + real auth provider + first Shopify adapter +
telemetry → prove one real PrimeBuild conversion → payout through the UI on live
infrastructure.
