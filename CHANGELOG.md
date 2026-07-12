# Changelog

All notable changes to Partnera. Milestones only; full history in git + [DECISIONS.md](DECISIONS.md).

## [0.3.0] — 2026-07-12 — Mega Module 3: Persistence & Money Spine

The pure-domain foundation becomes a **persistent platform**. The append-only
commission ledger is now the centre of the implementation, with everything
integrating around it. No product or architecture redesign; every gate green.

### Added
- **`@partnera/persistence`** — repository layer behind clean ports over an
  in-memory relational store that enforces append-only tables, unique-constraint
  idempotency, optimistic concurrency, atomic transactions, and tenant scoping.
  Repositories: identity, offer (+ versions), tracking, ledger, payout, fraud,
  notification, extension, config, audit, idempotency.
- **Canonical database model** — `packages/persistence/prisma/schema.prisma`
  (all tables: tenants, organizations, users, memberships, roles, offers, offer
  versions, tracking links, coupons, sessions, clicks, orders, conversions,
  refunds, ledger events, payout events, balance snapshots, fraud signals/scores/
  cases, notifications, extensions, configuration, audit, idempotency keys) and
  `sql/0001_init.sql` (append-only triggers, money integrity, RLS template).
- **`@partnera/payment-engine`** — new pure-domain engine: append-only payout
  event stream + state machine + provider-less `PayoutRail` abstraction
  (non-custodial; no real provider ships).
- **`@partnera/application`** — permission-aware use-case services
  (organizations, offers, tracking/money-spine, ledger, payments, fraud,
  notifications, configuration). Tenant + actor always from the request context;
  deny-by-default authorization; audited.
- **`@partnera/http-api`** — dependency-free HTTP delivery adapter over the
  application services, with domain-error → HTTP-status mapping.
- **Money spine, end to end** — attribute → convert → commission → approve →
  payout → paid, with fraud gating, clawbacks/reversals, idempotency, optimistic
  concurrency, and separation of duties. 37 new tests (47 → 84).

### Changed
- Docs: `PROJECT_CONTEXT`, `BUILD_STATUS`, `ROADMAP`, `DECISIONS` updated;
  added `docs/23-persistence.md`, `ARCHITECTURE.md`, `TECHNICAL_HANDOFF.md`.

### Unchanged (deliberately)
- Every existing engine package and its public contracts. The persistence and
  delivery layers sit entirely behind them.

### Not yet built (documented, behind contracts)
- Live Postgres/Prisma wiring, NestJS host, auth provider, real commerce
  adapter, real payout rails.

## [0.2.0] — 2026-07-11 — Mega Module 2: Platform Foundation
- 12-package pure-domain TypeScript monorepo; verified green (47 tests).

## [0.1.0] — 2026-07-11 — Phase 0: Product Design
- 26-document product + engineering design set.
