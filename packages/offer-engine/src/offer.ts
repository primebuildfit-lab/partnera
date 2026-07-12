import { type OfferId, type ProgramId, type TenantId } from "@partnera/core";
import {
  type CalculationBlock,
  type ConditionBlock,
  type LimitBlock,
  type RewardBlock,
  type ScheduleBlock,
  type ScopeBlock,
} from "./blocks";

export type OfferStatus = "draft" | "active" | "paused" | "archived";

/**
 * A fully-configured offer. Offers are **versioned**: editing an active offer
 * produces a new version, and every commission records the version that
 * generated it, so historical payouts are always reproducible
 * (see docs/06-commission-engine.md).
 */
export interface OfferDefinition {
  readonly id: OfferId;
  readonly tenantId: TenantId;
  readonly programId: ProgramId;
  readonly version: number;
  readonly name: string;
  readonly status: OfferStatus;

  readonly scope: readonly ScopeBlock[];
  readonly conditions: readonly ConditionBlock[];
  readonly calculation: CalculationBlock;
  readonly reward: RewardBlock;
  readonly schedule: ScheduleBlock;
  readonly limits: readonly LimitBlock[];

  /** Higher wins when multiple offers match and stacking is disabled. */
  readonly stackingPriority: number;
}
