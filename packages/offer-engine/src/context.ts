import {
  type AffiliateId,
  type CampaignId,
  type ConversionId,
  type Money,
  type OfferId,
  type OrderId,
  type TenantId,
} from "@partnera/core";
import { type AttributionBasis, type RewardKind } from "./blocks";

/** A normalized order line item, platform-agnostic (see docs/05-tracking-engine.md). */
export interface OrderLine {
  readonly productId: string;
  readonly collectionIds: readonly string[];
  readonly categories: readonly string[];
  readonly brand: string | null;
  readonly quantity: number;
  readonly unitAmount: Money;
  readonly lineSubtotal: Money;
}

export interface OrderSnapshot {
  readonly id: OrderId;
  readonly tenantId: TenantId;
  readonly total: Money;
  readonly lines: readonly OrderLine[];
  readonly customerType: "new" | "returning";
}

export interface AttributionSnapshot {
  readonly basis: AttributionBasis;
  readonly affiliateId: AffiliateId;
  readonly affiliateTier: string | null;
  readonly campaignId: CampaignId | null;
}

/** Everything the engine needs to evaluate an offer against one conversion. */
export interface EvaluationContext {
  readonly conversionId: ConversionId;
  readonly order: OrderSnapshot;
  readonly attribution: AttributionSnapshot;
  readonly now: Date;
}

/**
 * The output of a successful evaluation: an instruction the Commission Engine
 * turns into a ledger entry. It is fully explainable via `reasonPath`, which
 * records the offer version and the blocks that produced the amount.
 */
export interface CommissionInstruction {
  readonly offerId: OfferId;
  readonly offerVersion: number;
  readonly affiliateId: AffiliateId;
  readonly conversionId: ConversionId;
  readonly amount: Money;
  readonly rewardKind: RewardKind;
  readonly reasonPath: readonly string[];
}
