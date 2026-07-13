import { type Result, err, ok, ValidationError } from "@partnera/core";
import { type MandatoryGate, type ReviewCategory } from "./vocab";

/**
 * Review scoring: deterministic, explainable weighted scoring plus mandatory-pass
 * gates. A failed mandatory gate (legal/safety, file requirements) yields a
 * non-approvable outcome regardless of the weighted score — the rule that keeps
 * a beautiful video with an illegal claim from being approved.
 */
export type ScoreDecision = "approve" | "revision" | "reject";

export interface CategoryScore {
  readonly category: ReviewCategory;
  readonly score: number; // 0-100
}

export interface ScoringInput {
  readonly categories: readonly CategoryScore[];
  /** Category weights (need not sum to 100; they are normalized). */
  readonly weights: Readonly<Partial<Record<ReviewCategory, number>>>;
  /** Mandatory gates and whether each passed. Any false ⇒ not approvable. */
  readonly mandatory: Readonly<Partial<Record<MandatoryGate, boolean>>>;
  readonly minApprovalScore: number;
  readonly rejectionThreshold: number;
}

export interface ScoringResult {
  readonly weightedTotal: number; // 0-100, rounded to 2 decimals
  readonly decision: ScoreDecision;
  readonly mandatoryPassed: boolean;
  readonly failedGates: readonly MandatoryGate[];
  readonly explanation: string;
}

/** Compute an explainable scoring result. Returns a ValidationError on bad input. */
export function scoreSubmission(input: ScoringInput): Result<ScoringResult, ValidationError> {
  for (const c of input.categories) {
    if (c.score < 0 || c.score > 100 || !Number.isFinite(c.score)) {
      return err(new ValidationError("Category score must be within 0-100", { category: c.category, score: c.score }));
    }
  }

  let weightSum = 0;
  let acc = 0;
  for (const c of input.categories) {
    const w = input.weights[c.category] ?? 0;
    if (w < 0) return err(new ValidationError("Weight must be non-negative", { category: c.category, weight: w }));
    weightSum += w;
    acc += w * c.score;
  }
  const weightedTotal = weightSum === 0 ? 0 : Math.round((acc / weightSum) * 100) / 100;

  const failedGates = (Object.keys(input.mandatory) as MandatoryGate[]).filter(
    (g) => input.mandatory[g] === false,
  );
  const mandatoryPassed = failedGates.length === 0;

  let decision: ScoreDecision;
  let explanation: string;
  if (!mandatoryPassed) {
    decision = "reject";
    explanation = `Mandatory gate(s) failed: ${failedGates.join(", ")}. Not approvable regardless of score (${weightedTotal}).`;
  } else if (weightedTotal >= input.minApprovalScore) {
    decision = "approve";
    explanation = `Weighted score ${weightedTotal} ≥ approval threshold ${input.minApprovalScore}; all mandatory gates passed.`;
  } else if (weightedTotal < input.rejectionThreshold) {
    decision = "reject";
    explanation = `Weighted score ${weightedTotal} < rejection threshold ${input.rejectionThreshold}.`;
  } else {
    decision = "revision";
    explanation = `Weighted score ${weightedTotal} is between rejection (${input.rejectionThreshold}) and approval (${input.minApprovalScore}); revision recommended.`;
  }

  return ok({ weightedTotal, decision, mandatoryPassed, failedGates, explanation });
}
