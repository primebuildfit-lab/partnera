import { IllegalStateError } from "@partnera/core";

/**
 * Payout lifecycle. Like the commission ledger, payout state is **derived** by
 * folding an append-only stream of payout events — never stored as mutable
 * truth. This keeps the money spine uniformly auditable: a payout's whole
 * history (requested → approved → executing → paid, plus failures and retries)
 * is reconstructable from immutable facts. See docs/07-payments.md.
 *
 *   requested → approved → executing → paid
 *        ↓         ↓           ↓
 *     rejected  canceled     failed → (retry) approved
 */
export type PayoutState =
  | "requested"
  | "approved"
  | "executing"
  | "paid"
  | "failed"
  | "rejected"
  | "canceled";

export type PayoutEventType =
  | "payout.requested"
  | "payout.approved"
  | "payout.rejected"
  | "payout.execution_started"
  | "payout.succeeded"
  | "payout.failed"
  | "payout.retry_scheduled"
  | "payout.canceled";

/** Legal event types from each state. Terminal states allow nothing further. */
const TRANSITIONS: Readonly<Record<PayoutState, ReadonlySet<PayoutEventType>>> = {
  requested: new Set(["payout.approved", "payout.rejected", "payout.canceled"]),
  approved: new Set(["payout.execution_started", "payout.canceled"]),
  executing: new Set(["payout.succeeded", "payout.failed"]),
  failed: new Set(["payout.retry_scheduled", "payout.canceled"]),
  paid: new Set([]),
  rejected: new Set([]),
  canceled: new Set([]),
};

export function canApplyPayout(state: PayoutState, event: PayoutEventType): boolean {
  return TRANSITIONS[state].has(event);
}

/** Compute the next state for a payout event, throwing on an illegal transition. */
export function applyPayoutTransition(state: PayoutState, event: PayoutEventType): PayoutState {
  if (!canApplyPayout(state, event)) {
    throw new IllegalStateError(`Cannot apply ${event} to a ${state} payout`, { state, event });
  }
  switch (event) {
    case "payout.approved":
      return "approved";
    case "payout.rejected":
      return "rejected";
    case "payout.execution_started":
      return "executing";
    case "payout.succeeded":
      return "paid";
    case "payout.failed":
      return "failed";
    case "payout.retry_scheduled":
      return "approved";
    case "payout.canceled":
      return "canceled";
    case "payout.requested":
      throw new IllegalStateError("payout.requested cannot be applied to an existing payout");
  }
}
