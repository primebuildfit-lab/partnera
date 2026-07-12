import { ConflictError, InvariantViolation } from "@partnera/core";
import { foldPayout, type PayoutEvent } from "./payout";
import { canApplyPayout } from "./states";

/**
 * Guard enforcing the append-only, valid-transition invariant for payouts
 * *before* an event is written — the payout analogue of the ledger's
 * `assertAppendable`. A payout store wrapper calls this so illegal history
 * (double-request, executing a rejected payout, paying twice) is rejected at the
 * boundary rather than corrupting derived state.
 */
export function assertPayoutAppendable(
  priorEvents: readonly PayoutEvent[],
  next: PayoutEvent,
): void {
  if (next.type === "payout.requested") {
    if (priorEvents.length > 0) {
      throw new ConflictError("payout.requested for an existing payout", {
        payoutId: next.payoutId,
      });
    }
    return;
  }

  if (priorEvents.length === 0) {
    throw new InvariantViolation("Cannot apply an event before payout.requested", {
      type: next.type,
      payoutId: next.payoutId,
    });
  }

  const current = foldPayout(priorEvents);
  if (!canApplyPayout(current.state, next.type)) {
    throw new ConflictError(`Illegal payout transition: ${next.type} from ${current.state}`, {
      payoutId: next.payoutId,
      from: current.state,
      event: next.type,
    });
  }
}

/**
 * Append-only payout event store contract. Mirrors {@link
 * import("@partnera/commission-engine").LedgerStore}: events are never mutated,
 * appends are idempotent by event id, reads return occurrence order.
 */
export interface PayoutStore {
  append(event: PayoutEvent): Promise<void>;
  readByPayout(
    tenantId: PayoutEvent["tenantId"],
    payoutId: PayoutEvent["payoutId"],
  ): Promise<readonly PayoutEvent[]>;
  readByAffiliate(
    tenantId: PayoutEvent["tenantId"],
    affiliateId: PayoutEvent["affiliateId"],
  ): Promise<readonly PayoutEvent[]>;
}
