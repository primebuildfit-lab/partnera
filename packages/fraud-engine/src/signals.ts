/**
 * Fraud signals and the risk model. Signals are individual observations; a
 * configurable, weighted aggregation produces a risk score and band, which maps
 * to an action (allow / hold / review / block). Weights and thresholds are
 * per-tenant configuration with platform hard floors. See docs/08-fraud-engine.md.
 */
export type RiskSignalType =
  | "self_purchase"
  | "duplicate_account"
  | "coupon_abuse"
  | "vpn_proxy"
  | "referral_loop"
  | "cookie_abuse"
  | "multi_device"
  | "velocity_spike"
  | "chargeback";

export type RiskSubjectKind = "affiliate" | "conversion" | "account";

export interface RiskSignal {
  readonly type: RiskSignalType;
  /** 0..1 strength of this individual observation. */
  readonly strength: number;
  readonly detail: string;
  readonly observedAt: Date;
}

export type RiskBand = "low" | "medium" | "high";
export type RiskAction = "allow" | "hold" | "review" | "block";

export interface RiskScore {
  readonly subjectKind: RiskSubjectKind;
  readonly subjectId: string;
  /** 0..100 aggregate. */
  readonly score: number;
  readonly band: RiskBand;
  readonly action: RiskAction;
  readonly contributing: readonly RiskSignalType[];
  readonly computedAt: Date;
}

export interface FraudConfig {
  /** Per-signal weight (points added, scaled by strength). Configurable. */
  readonly weights: Readonly<Record<RiskSignalType, number>>;
  readonly mediumAt: number;
  readonly highAt: number;
  readonly actionByBand: Readonly<Record<RiskBand, RiskAction>>;
  /**
   * Platform hard floor: these signal types force at least a review regardless
   * of score, and tenants cannot disable them (network protection).
   */
  readonly forceReviewSignals: readonly RiskSignalType[];
}

export const DEFAULT_FRAUD_CONFIG: FraudConfig = {
  weights: {
    self_purchase: 60,
    duplicate_account: 40,
    coupon_abuse: 30,
    vpn_proxy: 15,
    referral_loop: 50,
    cookie_abuse: 35,
    multi_device: 20,
    velocity_spike: 25,
    chargeback: 70,
  },
  mediumAt: 30,
  highAt: 60,
  actionByBand: { low: "allow", medium: "hold", high: "block" },
  forceReviewSignals: ["chargeback", "self_purchase"],
};
