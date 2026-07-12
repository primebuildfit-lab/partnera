import {
  type AffiliateId,
  type CommissionId,
  type ConversionId,
  InvariantViolation,
  Money,
  type OfferId,
} from "@partnera/core";
import { type LedgerEvent } from "./ledger";
import { applyTransition, type CommissionState } from "./states";

/**
 * A commission as derived from its ledger events — the read model. Never stored
 * as mutable state; always recomputed from the immutable event stream so it is
 * always reconcilable and fully explainable.
 */
export interface CommissionRecord {
  readonly commissionId: CommissionId;
  readonly affiliateId: AffiliateId;
  readonly conversionId: ConversionId;
  readonly offerId: OfferId;
  readonly offerVersion: number;
  readonly rewardKind: string;
  readonly state: CommissionState;
  readonly amount: Money;
  readonly reasonPath: readonly string[];
  readonly createdAt: Date;
  readonly lastEventAt: Date;
}

/** Fold one commission's ordered events into its current record. */
export function foldCommission(events: readonly LedgerEvent[]): CommissionRecord {
  const ordered = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const first = ordered[0];
  if (!first || first.type !== "commission.created") {
    throw new InvariantViolation("Commission event stream must begin with commission.created");
  }

  let state: CommissionState = "pending";
  let amount = Money.fromJSON(first.amount);

  for (const event of ordered.slice(1)) {
    if (event.type === "commission.adjusted") {
      // Validate the transition is legal, then apply the monetary delta.
      applyTransition(state, event.type);
      amount = amount.add(Money.fromJSON(event.delta));
      continue;
    }
    state = applyTransition(state, event.type);
  }

  const last = ordered[ordered.length - 1]!;
  return {
    commissionId: first.commissionId,
    affiliateId: first.affiliateId,
    conversionId: first.conversionId,
    offerId: first.offerId,
    offerVersion: first.offerVersion,
    rewardKind: first.rewardKind,
    state,
    amount,
    reasonPath: first.reasonPath,
    createdAt: first.occurredAt,
    lastEventAt: last.occurredAt,
  };
}
