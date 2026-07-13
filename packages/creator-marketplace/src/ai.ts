import { type Money } from "@partnera/core";
import { type ApprovalMode, type ReviewCategory } from "./vocab";

/**
 * Provider-independent AI-assisted review. The contract produces **advisory**
 * evidence — scores, objective-check results, risk flags, a recommendation, and
 * an explanation — with a pinned model/policy version. It never moves money.
 *
 * NO external AI provider is connected. The local implementation is a
 * **deterministic mock** clearly labelled as such; a mock score is never a real
 * AI judgment (D-307, AI_REVIEW_ARCHITECTURE.md).
 */
export interface AIReviewInput {
  readonly submissionVersionId: string;
  /** Objective, machine-checkable facts extracted from the submission metadata. */
  readonly objective: {
    readonly widthPx?: number;
    readonly heightPx?: number;
    readonly durationSec?: number;
    readonly hasAudio?: boolean;
    readonly hasCta?: boolean;
    readonly language?: string;
  };
  /** The requirement spec to check against (subset used by the mock). */
  readonly requirement: {
    readonly minWidthPx?: number;
    readonly minHeightPx?: number;
    readonly minDurationSec?: number;
    readonly maxDurationSec?: number;
    readonly requiresAudio?: boolean;
    readonly requiresCta?: boolean;
    readonly language?: string;
  };
  /** Optional pre-computed risk flags surfaced by safety scanning. */
  readonly riskFlags?: readonly string[];
}

export interface AIObjectiveCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface AIReviewRunResult {
  readonly modelVersion: string;
  readonly policyVersion: string;
  readonly objectiveChecks: readonly AIObjectiveCheck[];
  readonly scores: Readonly<Partial<Record<ReviewCategory, number>>>;
  readonly flags: readonly string[];
  readonly confidence: number; // 0-1
  readonly recommendation: "approve" | "revision" | "reject" | "abstain";
  readonly explanation: string;
  /** Always false for the mock: advisory only, never authorizes payment. */
  readonly authorizesPayment: false;
  readonly isMock: boolean;
}

export interface AIReviewer {
  review(input: AIReviewInput): AIReviewRunResult;
}

/**
 * A deterministic, explainable mock reviewer for local mode. Objective checks are
 * real (they compare metadata to the requirement); the "quality" scores are a
 * deterministic function of objective pass-rate, plainly labelled as a mock so no
 * one mistakes them for a model's creative judgment.
 */
export class DeterministicMockReviewer implements AIReviewer {
  constructor(private readonly modelVersion = "mock-1.0.0") {}

  review(input: AIReviewInput): AIReviewRunResult {
    const checks: AIObjectiveCheck[] = [];
    const req = input.requirement;
    const obj = input.objective;
    const check = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail });

    if (req.minWidthPx !== undefined) {
      check("min_width", (obj.widthPx ?? 0) >= req.minWidthPx, `${obj.widthPx ?? 0} ≥ ${req.minWidthPx}`);
    }
    if (req.minHeightPx !== undefined) {
      check("min_height", (obj.heightPx ?? 0) >= req.minHeightPx, `${obj.heightPx ?? 0} ≥ ${req.minHeightPx}`);
    }
    if (req.minDurationSec !== undefined) {
      check("min_duration", (obj.durationSec ?? 0) >= req.minDurationSec, `${obj.durationSec ?? 0}s ≥ ${req.minDurationSec}s`);
    }
    if (req.maxDurationSec !== undefined) {
      check("max_duration", (obj.durationSec ?? 0) <= req.maxDurationSec, `${obj.durationSec ?? 0}s ≤ ${req.maxDurationSec}s`);
    }
    if (req.requiresAudio) check("audio_present", obj.hasAudio === true, `hasAudio=${obj.hasAudio ?? false}`);
    if (req.requiresCta) check("cta_present", obj.hasCta === true, `hasCta=${obj.hasCta ?? false}`);
    if (req.language) check("language", obj.language === req.language, `${obj.language ?? "?"} == ${req.language}`);

    const total = checks.length;
    const passed = checks.filter((c) => c.passed).length;
    const passRate = total === 0 ? 1 : passed / total;
    const flags = [...(input.riskFlags ?? [])];

    // Deterministic advisory scores derived from objective pass rate (mock).
    const q = Math.round(passRate * 100);
    const scores: Partial<Record<ReviewCategory, number>> = {
      brief_compliance: q,
      technical_quality: q,
      brand_alignment: Math.round(q * 0.9),
      creativity: Math.round(q * 0.85),
      product_clarity: q,
    };

    let recommendation: AIReviewRunResult["recommendation"];
    if (flags.length > 0) recommendation = "abstain"; // risk flags → human, never auto
    else if (passRate === 1) recommendation = "approve";
    else if (passRate >= 0.6) recommendation = "revision";
    else recommendation = "reject";

    const confidence = flags.length > 0 ? 0.3 : total === 0 ? 0.5 : 0.6 + passRate * 0.3;

    return {
      modelVersion: this.modelVersion,
      policyVersion: "policy-1",
      objectiveChecks: checks,
      scores,
      flags,
      confidence: Math.round(confidence * 100) / 100,
      recommendation,
      explanation: `MOCK reviewer: ${passed}/${total} objective checks passed (${q}%). ${flags.length} risk flag(s). Advisory only — does not authorize payment.`,
      authorizesPayment: false,
      isMock: true,
    };
  }
}

/**
 * Two-score advisory evaluation (technical + commercial) plus a recommended
 * category — the AI's advisory role. It NEVER sets the payment; the business's
 * saved scheme maps the human-confirmed category to money. The commercial score
 * is a deterministic mock function of clearly-labelled signals.
 */
export interface TwoScoreInput extends AIReviewInput {
  /** Optional commercial signals (mock): note length, hook, etc. */
  readonly commercial?: {
    readonly hasHook?: boolean;
    readonly noteLength?: number;
    readonly brandMentioned?: boolean;
  };
}

export interface TwoScoreResult {
  readonly technicalScore: number; // 0-100 (objective pass rate)
  readonly commercialScore: number; // 0-100 (deterministic mock)
  readonly combinedScore: number;
  readonly confidence: number;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly failedRequirements: readonly string[];
  readonly modelVersion: string;
  readonly isMock: true;
  readonly authorizesPayment: false;
}

/** Deterministic two-score mock. Advisory only; never authorizes payment. */
export function mockTwoScoreReview(input: TwoScoreInput, modelVersion = "mock-1.0.0"): TwoScoreResult {
  const base = new DeterministicMockReviewer(modelVersion).review(input);
  const technicalScore = Math.round((base.objectiveChecks.filter((c) => c.passed).length / Math.max(1, base.objectiveChecks.length)) * 100);
  const failedRequirements = base.objectiveChecks.filter((c) => !c.passed).map((c) => c.name);

  // Commercial score: deterministic mock from labelled signals.
  const c = input.commercial ?? {};
  let commercial = 40;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (input.objective.hasCta) { commercial += 20; strengths.push("clear call-to-action"); } else weaknesses.push("no call-to-action");
  if (c.hasHook) { commercial += 15; strengths.push("strong hook"); } else weaknesses.push("weak/absent hook");
  if (c.brandMentioned) { commercial += 10; strengths.push("brand mentioned"); }
  if ((c.noteLength ?? 0) > 20) { commercial += 5; strengths.push("detailed creator notes"); }
  if (input.objective.hasAudio) commercial += 10; else weaknesses.push("no audio");
  commercial = Math.max(0, Math.min(100, commercial));
  if (technicalScore >= 80) strengths.push("meets technical requirements");
  else weaknesses.push("technical requirements not fully met");

  const combinedScore = Math.round(technicalScore * 0.5 + commercial * 0.5);
  const confidence = base.flags.length > 0 ? 0.3 : Math.round((0.6 + (technicalScore / 100) * 0.3) * 100) / 100;

  return {
    technicalScore,
    commercialScore: commercial,
    combinedScore,
    confidence,
    strengths,
    weaknesses,
    failedRequirements,
    modelVersion,
    isMock: true,
    authorizesPayment: false,
  };
}

/**
 * Whether a run may drive **bounded automated** approval. Only in that mode, only
 * for objective-only deliverables, only with no risk flags, high confidence, an
 * approve recommendation, and a value under the configured ceiling (D-307/D-336).
 * Any other mode ⇒ a human must decide.
 */
export function mayAutoApprove(
  mode: ApprovalMode,
  run: AIReviewRunResult,
  gross: Money,
  valueCeiling: Money,
  objectiveOnly: boolean,
  confidenceFloor = 0.8,
): boolean {
  if (mode !== "bounded_automated") return false;
  if (!objectiveOnly) return false;
  if (run.flags.length > 0) return false;
  if (run.recommendation !== "approve") return false;
  if (run.confidence < confidenceFloor) return false;
  if (gross.compare(valueCeiling) > 0) return false;
  return true;
}
