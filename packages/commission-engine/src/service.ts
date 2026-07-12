import { ConflictError, InvariantViolation } from "@partnera/core";
import { foldCommission } from "./commission";
import { type LedgerEvent } from "./ledger";
import { canApply } from "./states";

/**
 * Guard that enforces the append-only, valid-transition invariant *before* an
 * event is written. A `LedgerStore` wrapper calls this so illegal history (e.g.
 * approving an already-paid commission, or a second `created`) is rejected at
 * the boundary rather than corrupting derived balances.
 */
export function assertAppendable(
  priorEvents: readonly LedgerEvent[],
  next: LedgerEvent,
): void {
  if (next.type === "commission.created") {
    if (priorEvents.length > 0) {
      throw new ConflictError("commission.created for an existing commission", {
        commissionId: next.commissionId,
      });
    }
    return;
  }

  if (priorEvents.length === 0) {
    throw new InvariantViolation("Cannot apply an event before commission.created", {
      type: next.type,
      commissionId: next.commissionId,
    });
  }

  const current = foldCommission(priorEvents);
  if (!canApply(current.state, next.type)) {
    throw new ConflictError(`Illegal transition: ${next.type} from ${current.state}`, {
      commissionId: next.commissionId,
      from: current.state,
      event: next.type,
    });
  }
}
