# Deployment & Environments — Partnera Shopify Pilot

> **Part 22.** Clean separation of local / staging / production, with **environment validation**
> that refuses unsafe or mixed configuration (`@partnera/shopify` `env.ts`).

## Modes

| Mode | Persistence | Shopify | Money | AI | Billing |
|---|---|---|---|---|---|
| `local` | file | optional (dev app) | simulated | mock | off |
| `staging` | **database** | real install (pilot) | simulated | mock | test-mode |
| `production` (future) | database | real | 🔒 real | 🔒 real | 🔒 real |

`validateEnvironment(config)` rejects e.g. `local + realPayments`, `production + file`,
`staging + file`, or real money/AI/billing outside production — the app should call it at startup
and refuse to boot on failure.

## Staging bring-up (🔒 requires Brian for hosting/DB/DNS)
1. Provision a hosted Postgres (the canonical model is `packages/persistence/prisma/schema.prisma`
   + `sql/0001_init.sql`; the Shopify tables here extend it — see TENANT_MIGRATION.md).
2. Implement the Prisma-backed store behind the existing `Collection`/`UnitOfWork` ports (no
   engine/app change; same contract tests must pass).
3. Deploy `@partnera/web` behind a host (NestJS/Next or the node host) at a public URL over HTTPS.
4. Set env/secrets (SHOPIFY_API_KEY/SECRET, DATABASE_URL, TOKEN_ENCRYPTION_KEY, SESSION_SECRET).
5. Run migrations; run the tenant-isolation suite against the **real** DB before installing.

## Local (unchanged, still available)
`pnpm --filter @partnera/web serve` / launcher `open`. File persistence, simulated everything.

## What Partnera provides vs what Brian provides
Provided: schema, migrations, adapter, env validator, install/onboarding services, docs.
🔒 Brian: hosting account, database, DNS/URL, Shopify Partner app + secrets, and consent to deploy.
