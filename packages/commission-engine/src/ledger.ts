import {
  type AffiliateId,
  type CommissionId,
  type ConversionId,
  type LedgerEventId,
  type MoneyJSON,
  type OfferId,
  type PayoutId,
  type TenantId,
} from "@partnera/core";

/** JSON-safe money as stored in the ledger (the canonical {@link MoneyJSON}). */
export type LedgerMoney = MoneyJSON;

interface LedgerEventBase {
  readonly id: LedgerEventId;
  readonly tenantId: TenantId;
  readonly affiliateId: AffiliateId;
  readonly commissionId: CommissionId;
  readonly occurredAt: Date;
  readonly correlationId: string;
}

/**
 * The append-only ledger events. These are immutable facts. Balances and
 * commission state are *derived* from the ordered stream of these events —
 * nothing is ever edited or deleted. Corrections are new events
 * (`commission.adjusted`, `commission.reversed`).
 */
export type LedgerEvent =
  | (LedgerEventBase & {
      readonly type: "commission.created";
      readonly conversionId: ConversionId;
      readonly offerId: OfferId;
      readonly offerVersion: number;
      readonly amount: LedgerMoney;
      readonly rewardKind: string;
      readonly reasonPath: readonly string[];
    })
  | (LedgerEventBase & { readonly type: "commission.held"; readonly reason: string })
  | (LedgerEventBase & { readonly type: "commission.released" })
  | (LedgerEventBase & { readonly type: "commission.approved" })
  | (LedgerEventBase & { readonly type: "commission.rejected"; readonly reason: string })
  | (LedgerEventBase & {
      readonly type: "commission.adjusted";
      readonly delta: LedgerMoney;
      readonly reason: string;
    })
  | (LedgerEventBase & { readonly type: "commission.paid"; readonly payoutId: PayoutId })
  | (LedgerEventBase & { readonly type: "commission.reversed"; readonly reason: string });

/**
 * Append-only event store contract. Implementations must guarantee:
 *  - events are never updated or deleted;
 *  - appends are idempotent by event id (safe to retry);
 *  - reads return events in occurrence order.
 * The concrete persistence is a build-phase decision (see DECISIONS.md).
 */
export interface LedgerStore {
  append(event: LedgerEvent): Promise<void>;
  readByCommission(tenantId: TenantId, commissionId: CommissionId): Promise<readonly LedgerEvent[]>;
  readByAffiliate(tenantId: TenantId, affiliateId: AffiliateId): Promise<readonly LedgerEvent[]>;
}
