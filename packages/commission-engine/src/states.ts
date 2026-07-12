import { IllegalStateError } from "@partnera/core";

/**
 * Commission lifecycle. State is *derived* by folding the append-only ledger —
 * it is never stored as mutable truth. See docs/06-commission-engine.md.
 *
 *   created(pending) → held ⇄ pending → approved → paid
 *                        ↘ rejected            ↘ reversed
 *   approved/paid → reversed (clawback within window)
 */
export type CommissionState =
  | "pending"
  | "held"
  | "approved"
  | "rejected"
  | "paid"
  | "reversed";

export type LedgerEventType =
  | "commission.created"
  | "commission.held"
  | "commission.released"
  | "commission.approved"
  | "commission.rejected"
  | "commission.adjusted"
  | "commission.paid"
  | "commission.reversed";

/** Which event types are legal from a given state. `adjusted` never changes state. */
const TRANSITIONS: Readonly<Record<CommissionState, ReadonlySet<LedgerEventType>>> = {
  pending: new Set(["commission.held", "commission.approved", "commission.rejected", "commission.adjusted"]),
  held: new Set(["commission.released", "commission.rejected", "commission.approved", "commission.adjusted"]),
  approved: new Set(["commission.paid", "commission.reversed", "commission.adjusted"]),
  paid: new Set(["commission.reversed"]),
  rejected: new Set([]),
  reversed: new Set([]),
};

export function canApply(state: CommissionState, event: LedgerEventType): boolean {
  return TRANSITIONS[state].has(event);
}

/** Compute the next state for an event, throwing on an illegal transition. */
export function applyTransition(state: CommissionState, event: LedgerEventType): CommissionState {
  if (!canApply(state, event)) {
    throw new IllegalStateError(`Cannot apply ${event} to a ${state} commission`, { state, event });
  }
  switch (event) {
    case "commission.held":
      return "held";
    case "commission.released":
      return "pending";
    case "commission.approved":
      return "approved";
    case "commission.rejected":
      return "rejected";
    case "commission.paid":
      return "paid";
    case "commission.reversed":
      return "reversed";
    case "commission.adjusted":
      return state;
    case "commission.created":
      throw new IllegalStateError("commission.created cannot be applied to an existing commission");
  }
}
