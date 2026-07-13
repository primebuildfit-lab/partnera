/**
 * @partnera/platform-finance — Partnera's TWO separate financial ledgers.
 *
 * These are the platform's own books, distinct from the affiliate commission
 * ledger and the creator-payment stream (which are per-tenant). There are two,
 * and they must NEVER be commingled:
 *
 *   Bank A — Revenue Account: money Partnera OWNS (memberships, fees, platform
 *            commissions, services). Can be withdrawn/reinvested by Partnera.
 *   Bank B — Vault: third-party funds Partnera MANAGES temporarily (business
 *            deposits, committed/reserved payouts, disputes, guarantees). NOT
 *            revenue; never spendable by Partnera; every move is audited.
 *
 * Both are append-only event streams with derived balances and compensating
 * reversals — no destructive edits (D-006 discipline). In this phase NO real
 * money moves: this is a simulated engine (events + folds + tests). Real custody
 * needs a provider + legal review + KYC/AML + reconciliation (documented).
 */
export * from "./ids";
export * from "./revenue";
export * from "./vault";
export * from "./close";
