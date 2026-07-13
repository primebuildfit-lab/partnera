import { type Result, err, ok, ValidationError } from "@partnera/core";
import { type ApprovalMode } from "./vocab";

/**
 * Platform-fee configuration and other provisional defaults for the module.
 *
 * The fee is expressed in **basis points** (bps) — integer hundredths of a
 * percent — to stay exact and consistent with the money kernel (no floats). The
 * approved range is **2%–4%** (200–400 bps); values outside it are rejected.
 * A fee is **snapshotted** at terms acceptance and never re-read live (D-310).
 */
export const FEE_MIN_BPS = 200; // 2.00%
export const FEE_MAX_BPS = 400; // 4.00%

/** Who bears the platform fee. Business by default (D-311). */
export type FeePayer = "business" | "creator";

export interface FeeConfig {
  /** Platform-fee rate in basis points; must be within [FEE_MIN_BPS, FEE_MAX_BPS]. */
  readonly rateBps: number;
  readonly payer: FeePayer;
}

/**
 * An immutable snapshot of the fee that applied when a creator accepted terms.
 * Authorization and recognition read this, never the live config, so a later
 * config change can never silently alter an in-flight job (D-310).
 */
export interface FeeSnapshot {
  readonly rateBps: number;
  readonly payer: FeePayer;
  readonly configVersion: number;
  readonly snapshotAt: Date;
}

/** Validate a fee rate against the approved global range. */
export function validateFeeBps(rateBps: number): Result<number, ValidationError> {
  if (!Number.isInteger(rateBps)) {
    return err(new ValidationError("Fee rate must be an integer number of basis points", { rateBps }));
  }
  if (rateBps < FEE_MIN_BPS || rateBps > FEE_MAX_BPS) {
    return err(
      new ValidationError(`Fee rate ${rateBps}bps is outside the approved 2%-4% range`, {
        rateBps,
        min: FEE_MIN_BPS,
        max: FEE_MAX_BPS,
      }),
    );
  }
  return ok(rateBps);
}

/** Validate and normalize a fee configuration. */
export function validateFeeConfig(config: FeeConfig): Result<FeeConfig, ValidationError> {
  const rate = validateFeeBps(config.rateBps);
  if (!rate.ok) return rate;
  return ok(config);
}

/**
 * Provisional module defaults (D-330–D-336). Each is labeled provisional and is
 * configurable; none is hardcoded into logic beyond being the default value.
 */
export const CREATOR_MARKETPLACE_DEFAULTS = {
  /** Default fee 3.00% (mid of the approved range), business-paid. */
  fee: { rateBps: 300, payer: "business" } satisfies FeeConfig,
  /** Default review SLA in business days before nudge/escalation. */
  reviewSlaDays: 5,
  /** Default dispute window in days after decision/payment. */
  disputeWindowDays: 14,
  /** Default revisions allowed per deliverable. */
  revisionAllowance: 2,
  /** Minimum creator age; KYC required above a payout threshold (external-gated). */
  minCreatorAge: 18,
  /** Default approval mode: a human always decides. */
  approvalMode: "ai_recommend_human_decide" as ApprovalMode,
  /** Minimum weighted score (0-100) for approval, absent business override. */
  minApprovalScore: 70,
  /** Below this weighted score, default to reject rather than revision. */
  rejectionThreshold: 50,
  /** In local mode, all payouts are simulated — no provider, no money moves. */
  localPayoutMode: "simulated" as const,
} as const;

/** Default per-category scoring weights (sum to 100). Business-configurable. */
export const DEFAULT_SCORING_WEIGHTS = {
  brief_compliance: 30,
  technical_quality: 20,
  brand_alignment: 20,
  creativity: 15,
  product_clarity: 10,
} as const;
