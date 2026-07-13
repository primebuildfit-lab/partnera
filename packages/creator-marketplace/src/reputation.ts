/**
 * Creator reputation: a derived, explainable standing computed from historical
 * facts. Deterministic and recomputable — never stored as an opaque mutable
 * number. The exact formula is provisional (OQ-13); this is a transparent,
 * anti-gaming default that a build-phase decision can tune.
 */
export interface ReputationInput {
  readonly jobsCompleted: number;
  readonly approved: number;
  readonly rejected: number;
  readonly revisionsRequested: number;
  readonly disputesLost: number;
  /** Optional average business rating of this creator, 0-5. */
  readonly avgBusinessRating?: number;
}

export interface ReputationResult {
  /** 0-100 standing. */
  readonly score: number;
  readonly tier: "new" | "bronze" | "silver" | "gold";
  readonly approvalRate: number; // 0-1
  readonly explanation: string;
}

/**
 * Compute reputation. New creators start neutral (not penalized for no history).
 * Approval rate dominates; revisions and lost disputes reduce standing; ratings
 * nudge. Everything is bounded and explainable.
 */
export function computeReputation(input: ReputationInput): ReputationResult {
  const decisions = input.approved + input.rejected;
  const approvalRate = decisions === 0 ? 0 : input.approved / decisions;

  if (input.jobsCompleted === 0 && decisions === 0) {
    return {
      score: 50,
      tier: "new",
      approvalRate: 0,
      explanation: "New creator — neutral starting standing (no completed jobs yet).",
    };
  }

  const base = approvalRate * 80; // up to 80 from approval rate
  const revisionPenalty = Math.min(15, input.revisionsRequested * 1.5);
  const disputePenalty = Math.min(25, input.disputesLost * 8);
  const ratingBonus = input.avgBusinessRating === undefined ? 10 : (input.avgBusinessRating / 5) * 20;

  const raw = base + ratingBonus - revisionPenalty - disputePenalty;
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  const tier: ReputationResult["tier"] =
    score >= 80 ? "gold" : score >= 60 ? "silver" : score >= 40 ? "bronze" : "new";

  return {
    score,
    tier,
    approvalRate: Math.round(approvalRate * 100) / 100,
    explanation: `approvalRate=${Math.round(approvalRate * 100)}% base=${Math.round(base)} +rating=${Math.round(ratingBonus)} -revisions=${Math.round(revisionPenalty)} -disputes=${Math.round(disputePenalty)} => ${score}`,
  };
}
