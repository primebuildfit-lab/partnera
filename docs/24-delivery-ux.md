# 24 — Delivery Activation & First User Experience (Mega Module 4)

> The first usable Partnera experience: three server-rendered apps over the
> existing application services. Thin presentation only — the domain remains the
> single source of truth. Nothing in the domain or architecture was redesigned.
> See also [23-persistence.md](23-persistence.md) and [../ARCHITECTURE.md](../ARCHITECTURE.md).

## What was built

A new `@partnera/web` package delivering:

- **Business Dashboard** — Overview, Analytics, Offers (+ detail/versions),
  Campaigns, Tracking, Conversions, Commissions, Balances, Fraud, Notifications,
  Configuration, Audit, Organization.
- **Affiliate Portal** — Performance, Profile, Referral Links, Coupons,
  Pending/Approved/Paid commission, History, Payouts, Notifications, Settings.
- **Admin Console** (operational structure) — Overview, Health, Logs,
  Organizations, Users, Permissions, Offers, Tracking, Fraud, Feature Flags,
  Configuration, Audit.
- A responsive, accessible **app shell** (sidebar/desktop, native `<details>`
  menu/mobile, app switcher, skip link, ARIA landmarks, `aria-current`).
- **Workflows** through the real services: create/activate/duplicate/archive
  offer, approve/reject commission, review fraud case, update configuration.
- **Analytics** computed from the ledger/repositories (revenue, conversions,
  affiliates, top offers, commission status, growth, fraud).
- **Auth preparation** and a dependency-free node HTTP host with a seeded demo.

## Rendering approach (D-215)

Pages are plain **React components reusing `@partnera/ui`**, rendered to static
HTML with `react-dom/server`'s `renderToStaticMarkup` — **no bundler, no client
runtime, no hydration**. This was chosen deliberately:

- **Stays green & offline.** react/react-dom are already installed; SSR to a
  string needs no network, no `next build`, no install scripts. The whole thing
  is verified by `tsc` + Vitest like every other package.
- **Reuses the design system.** The apps compose `@partnera/ui` (Card, Table,
  Badge, Button, Field, Alert, EmptyState, …) — no duplicated UI.
- **Accessible by default.** Multi-page, works without JavaScript; forms are
  real POSTs; navigation is real links.

For local exploration, `esbuild` (already in the workspace) bundles the node
server (`pnpm --filter @partnera/web serve`). The production delivery target
remains NestJS/Next per D-204/D-210 — this module fills the seam, not the host.

## Thin presentation over services (D-216)

Every page reads and writes **only through the application services**. A new
permission-gated `QueryService` (in `@partnera/application`) exposes the reads
the UI needs; it holds no business logic. So RBAC, tenant isolation, idempotency,
and audit hold uniformly — the UI cannot reach around the application layer to
the repositories.

```
Browser ── HTTP ─▶ @partnera/web (router + SSR pages)
                     │  builds RequestContext from the session (never from input)
                     ▼
                 @partnera/application services (permission-gated)
                     ▼
                 repositories → relational store   (money spine, ledger, …)
```

## Authentication preparation (D-217)

No real provider is connected. Prepared and documented:

- **Session / permission / tenant context** (`WebSession`, `buildWebContext`) —
  the tenant and actor come from the session, never from request input.
- **Protected-route guard** (`protectRoute`) and permission-gated navigation.
- **`AuthProvider` seam** with a `DevAuthProvider` placeholder (looks up seeded
  users, **no** credential check — local only). OAuth / SSO / MFA are declared as
  documented seams on the provider interface for a later module (D-104).

## Demo data is real, not faked (D-218)

`createDemoWorld()` seeds a PrimeBuild tenant, users, offers, links/coupons, and
then **runs the real money spine** (ingest → attribute → convert → commission →
approve → payout → paid, plus a fraud hold and a refund clawback). Every number
on every dashboard is derived from the append-only ledger and repositories.

## Documented assumptions / not-yet-built

- **Campaigns** and **Feature Flags** management surfaces show honest
  "operational structure" states — the engines model them, but dedicated
  repositories/management UIs are a later module (no data fabricated).
- **Admin Console** establishes structure and read surfaces; it does not
  implement every operator action (per the brief).
- **Health/Logs** are structural (logs surface from the audit trail); live
  probes/telemetry are later.
- **Payout method management** appears behind the `PayoutRail` seam once a
  provider is connected (D-105).
- Running the server uses an `esbuild` bundle because the monorepo emits
  bundler-style (extensionless) imports (D-203); native-Node execution or the
  production host resolves this the same way.

## How to run

```bash
pnpm install
pnpm --filter @partnera/web serve      # bundles + starts http://localhost:4000
# sign in with a demo user: owner@primebuild.test / brian@primebuild.test / admin@partnera.test
```
