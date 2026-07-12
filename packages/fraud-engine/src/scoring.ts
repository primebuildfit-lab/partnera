import {
  type FraudConfig,
  type RiskBand,
  type RiskScore,
  type RiskSignal,
  type RiskSubjectKind,
} from "./signals";

function bandFor(score: number, config: FraudConfig): RiskBand {
  if (score >= config.highAt) return "high";
  if (score >= config.mediumAt) return "medium";
  return "low";
}

/**
 * Aggregate signals into a risk score. The score is the weighted sum of signal
 * strengths, capped at 100. The result is fully explainable (contributing signal
 * types) — a hard requirement so fraud decisions can be reviewed and disputed.
 */
export function scoreSignals(
  subjectKind: RiskSubjectKind,
  subjectId: string,
  signals: readonly RiskSignal[],
  config: FraudConfig,
  now: Date,
): RiskScore {
  let score = 0;
  const contributing = new Set<RiskSignal["type"]>();
  for (const signal of signals) {
    const weight = config.weights[signal.type] ?? 0;
    const clampedStrength = Math.max(0, Math.min(1, signal.strength));
    const points = weight * clampedStrength;
    if (points > 0) contributing.add(signal.type);
    score += points;
  }
  score = Math.min(100, Math.round(score));

  const band = bandFor(score, config);
  let action = config.actionByBand[band];

  // Hard floor: certain signals always force at least a review, even at low score.
  const forced = signals.some((s) => config.forceReviewSignals.includes(s.type));
  if (forced && (action === "allow" || action === "hold")) {
    action = "review";
  }

  return {
    subjectKind,
    subjectId,
    score,
    band,
    action,
    contributing: [...contributing],
    computedAt: now,
  };
}
