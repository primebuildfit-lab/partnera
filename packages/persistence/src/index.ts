/**
 * @partnera/persistence — the persistence layer for Partnera.
 *
 * Repository implementations behind clean ports, over a small relational store
 * that enforces the guarantees the platform's invariants depend on: append-only
 * money tables, unique-constraint-backed idempotency, optimistic concurrency,
 * atomic transactions, and tenant scoping. The reference store is in-memory; the
 * canonical production model is prisma/schema.prisma + sql/0001_init.sql, and a
 * Prisma-backed store drops in behind the same repositories with no engine or
 * application change. See docs/23-persistence.md.
 */
export * from "./relational/store";
export * from "./unit-of-work";

export * from "./repositories/identity";
export * from "./repositories/offer";
export * from "./repositories/tracking";
export * from "./repositories/ledger";
export * from "./repositories/payout";
export * from "./repositories/fraud";
export * from "./repositories/notification";
export * from "./repositories/extension";
export * from "./repositories/config";
export * from "./repositories/audit";
export * from "./repositories/idempotency";
