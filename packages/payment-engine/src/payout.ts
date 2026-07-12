import {
  type AffiliateId,
  type Brand,
  type CommissionId,
  InvariantViolation,
  Money,
  type MoneyJSON,
  type PayoutId,
  type TenantId,
  type UserId,
} from "@partnera/core";
import { applyPayoutTransition, type PayoutState } from "./states";

/** Id of a single append-only payout event. */
export type PayoutEventId = Brand<string, "PayoutEventId">;

interface PayoutEventBase {
  readonly id: PayoutEventId;
  readonly tenantId: TenantId;
  readonly payoutId: PayoutId;
  readonly affiliateId: AffiliateId;
  readonly occurredAt: Date;
  readonly correlationId: string;
  /** The actor who caused this event (separation-of-duties is enforced above). */
  readonly actorUserId: UserId;
}

/**
 * Append-only payout events. Immutable facts; the {@link PayoutRequest} read
 * model is derived by folding them. Non-custodial by design (D-050): Partnera
 * records and orchestrates the payout, the business funds it. No provider is
 * implemented here — a {@link import("./rail").PayoutRail} adapter is invoked by
 * the delivery layer and its outcome recorded as `succeeded`/`failed`.
 */
export type PayoutEvent =
  | (PayoutEventBase & {
      readonly type: "payout.requested";
      readonly amount: MoneyJSON;
      /** Commissions this payout disburses (each must be `approved`). */
      readonly commissionIds: readonly CommissionId[];
      /** Opaque, tenant-owned destination reference (never card/bank data). */
      readonly destinationRef: string;
    })
  | (PayoutEventBase & { readonly type: "payout.approved" })
  | (PayoutEventBase & { readonly type: "payout.rejected"; readonly reason: string })
  | (PayoutEventBase & { readonly type: "payout.execution_started"; readonly railName: string })
  | (PayoutEventBase & { readonly type: "payout.succeeded"; readonly providerRef: string })
  | (PayoutEventBase & { readonly type: "payout.failed"; readonly reason: string })
  | (PayoutEventBase & { readonly type: "payout.retry_scheduled"; readonly notBefore: Date })
  | (PayoutEventBase & { readonly type: "payout.canceled"; readonly reason: string });

/** The derived payout read model. Never persisted as mutable state. */
export interface PayoutRequest {
  readonly payoutId: PayoutId;
  readonly tenantId: TenantId;
  readonly affiliateId: AffiliateId;
  readonly amount: Money;
  readonly commissionIds: readonly CommissionId[];
  readonly destinationRef: string;
  readonly state: PayoutState;
  /** Number of execution attempts (retries increment this). */
  readonly attempts: number;
  readonly lastFailureReason: string | null;
  readonly providerRef: string | null;
  readonly nextAttemptAt: Date | null;
  readonly createdAt: Date;
  readonly lastEventAt: Date;
}

/** Fold one payout's ordered events into its current record. */
export function foldPayout(events: readonly PayoutEvent[]): PayoutRequest {
  const ordered = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const first = ordered[0];
  if (!first || first.type !== "payout.requested") {
    throw new InvariantViolation("Payout event stream must begin with payout.requested");
  }

  let state: PayoutState = "requested";
  let attempts = 0;
  let lastFailureReason: string | null = null;
  let providerRef: string | null = null;
  let nextAttemptAt: Date | null = null;

  for (const event of ordered.slice(1)) {
    state = applyPayoutTransition(state, event.type);
    switch (event.type) {
      case "payout.execution_started":
        attempts += 1;
        nextAttemptAt = null;
        break;
      case "payout.failed":
        lastFailureReason = event.reason;
        break;
      case "payout.succeeded":
        providerRef = event.providerRef;
        break;
      case "payout.retry_scheduled":
        nextAttemptAt = event.notBefore;
        break;
      default:
        break;
    }
  }

  const last = ordered[ordered.length - 1]!;
  return {
    payoutId: first.payoutId,
    tenantId: first.tenantId,
    affiliateId: first.affiliateId,
    amount: Money.fromJSON(first.amount),
    commissionIds: first.commissionIds,
    destinationRef: first.destinationRef,
    state,
    attempts,
    lastFailureReason,
    providerRef,
    nextAttemptAt,
    createdAt: first.occurredAt,
    lastEventAt: last.occurredAt,
  };
}
