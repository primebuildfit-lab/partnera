import {
  type CalculationBlock,
  type ConditionBlock,
  type LimitBlock,
  type RewardBlock,
  type ScheduleBlock,
  type ScopeBlock,
} from "./blocks";

/**
 * An offer template is a reusable blueprint — an offer minus its identity and
 * lifecycle fields. Templates can ship with the platform, be authored by a
 * business, or arrive (approved) from the marketplace. They are pure data.
 */
export interface OfferTemplate {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly scope: readonly ScopeBlock[];
  readonly conditions: readonly ConditionBlock[];
  readonly calculation: CalculationBlock;
  readonly reward: RewardBlock;
  readonly schedule: ScheduleBlock;
  readonly limits: readonly LimitBlock[];
  readonly stackingPriority: number;
}

/** A small starter catalog demonstrating the block model. */
export const BUILTIN_OFFER_TEMPLATES: readonly OfferTemplate[] = [
  {
    key: "flat_percentage",
    name: "Flat percentage commission",
    description: "Pay affiliates a fixed percentage of every attributed order.",
    scope: [{ kind: "all" }],
    conditions: [{ kind: "attribution", via: ["link", "coupon"] }],
    calculation: { kind: "percentage", basisPoints: 1000 },
    reward: { kind: "cash" },
    schedule: { kind: "always" },
    limits: [{ kind: "clawback_window", days: 30 }],
    stackingPriority: 0,
  },
  {
    key: "fixed_per_conversion",
    name: "Fixed bounty per conversion",
    description: "Pay a flat cash amount for each attributed order.",
    scope: [{ kind: "all" }],
    conditions: [{ kind: "attribution", via: ["link"] }],
    calculation: { kind: "fixed", amount: { currency: "USD", minorUnits: "1000" } },
    reward: { kind: "cash" },
    schedule: { kind: "always" },
    limits: [{ kind: "clawback_window", days: 30 }],
    stackingPriority: 0,
  },
];
