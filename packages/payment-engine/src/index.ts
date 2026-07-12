/**
 * @partnera/payment-engine — non-custodial payout orchestration.
 *
 * The payout lifecycle is an append-only event stream (like the commission
 * ledger); state is always derived. Provider rails are an abstraction with **no**
 * concrete implementation here (D-105) — the platform records and orchestrates
 * payouts; businesses fund them (D-050 non-custodial). See docs/07-payments.md.
 */
export * from "./states";
export * from "./payout";
export * from "./rail";
export * from "./service";
