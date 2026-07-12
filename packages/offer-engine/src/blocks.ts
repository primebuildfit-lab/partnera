/**
 * Offer building blocks.
 *
 * An offer is a composition of typed blocks across six sections — Scope,
 * Condition, Calculation, Reward, Schedule, Limit. The engine interprets these;
 * they are pure configuration (data), which is what makes "Design Your Own
 * Offer" possible without shipping code per business. See docs/04-offer-engine.md.
 */

/** Money as it appears in stored configuration (JSON-safe). */
export interface MoneyLiteral {
  readonly currency: string;
  readonly minorUnits: string;
}

// --- WHAT the offer applies to ---
export type ScopeBlock =
  | { readonly kind: "all" }
  | { readonly kind: "product"; readonly productIds: readonly string[] }
  | { readonly kind: "collection"; readonly collectionIds: readonly string[] }
  | { readonly kind: "category"; readonly categories: readonly string[] }
  | { readonly kind: "brand"; readonly brands: readonly string[] }
  | {
      readonly kind: "order_value";
      readonly min?: MoneyLiteral;
      readonly max?: MoneyLiteral;
    };

// --- WHEN / eligibility ---
export type AttributionBasis = "link" | "coupon" | "session";

export type ConditionBlock =
  | { readonly kind: "attribution"; readonly via: readonly AttributionBasis[] }
  | { readonly kind: "affiliate_tier"; readonly tiers: readonly string[] }
  | { readonly kind: "customer_type"; readonly customerType: "new" | "returning" }
  | { readonly kind: "min_order_value"; readonly amount: MoneyLiteral }
  | { readonly kind: "campaign"; readonly campaignId: string }
  | { readonly kind: "date_window"; readonly startsAt?: string; readonly endsAt?: string };

// --- HOW MUCH is earned ---
export interface TieredRate {
  /** Inclusive lower bound of order value for this tier. */
  readonly threshold: MoneyLiteral;
  readonly basisPoints: number;
}

export type CalculationBlock =
  | { readonly kind: "percentage"; readonly basisPoints: number }
  | { readonly kind: "fixed"; readonly amount: MoneyLiteral }
  | { readonly kind: "per_unit"; readonly amount: MoneyLiteral }
  | { readonly kind: "tiered"; readonly tiers: readonly TieredRate[] }
  // Declared for the model; not evaluated by the reference evaluator yet.
  | { readonly kind: "level"; readonly perLevelBasisPoints: readonly number[]; readonly maxDepth: number }
  | { readonly kind: "bonus"; readonly amount: MoneyLiteral; readonly targetCount: number };

// --- IN WHAT FORM it is paid ---
export type RewardBlock =
  | { readonly kind: "cash" }
  | { readonly kind: "points"; readonly multiplier: number }
  | { readonly kind: "gift_card" }
  | { readonly kind: "store_credit" }
  | { readonly kind: "hybrid"; readonly cashBasisPoints: number };

// --- WHEN active ---
export type ScheduleBlock =
  | { readonly kind: "always" }
  | { readonly kind: "window"; readonly startsAt: string; readonly endsAt: string }
  | {
      readonly kind: "recurring";
      readonly interval: "weekly" | "monthly" | "yearly";
      readonly maxCycles?: number;
    };

// --- Guardrails ---
export type LimitBlock =
  | { readonly kind: "max_per_conversion"; readonly amount: MoneyLiteral }
  | {
      readonly kind: "max_per_affiliate_period";
      readonly amount: MoneyLiteral;
      readonly period: "day" | "week" | "month";
    }
  | { readonly kind: "budget"; readonly amount: MoneyLiteral }
  | { readonly kind: "clawback_window"; readonly days: number };

export type RewardKind = RewardBlock["kind"];
