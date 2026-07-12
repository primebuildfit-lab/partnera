import { type FraudCaseId, type TenantId, type UserId } from "@partnera/core";
import { type RiskSignal, type RiskSubjectKind } from "./signals";

/**
 * A fraud case routes a flagged subject to human review with its evidence and an
 * audited decision history. Decisions feed back as labels to tune the rules.
 */
export type FraudCaseStatus = "open" | "in_review" | "resolved";
export type ReviewOutcome = "cleared" | "confirmed_fraud" | "suspended";

export interface Evidence {
  readonly kind: string;
  readonly summary: string;
  readonly signals: readonly RiskSignal[];
  readonly capturedAt: Date;
}

export interface ReviewDecision {
  readonly reviewerUserId: UserId;
  readonly outcome: ReviewOutcome;
  readonly note: string;
  readonly decidedAt: Date;
}

export interface FraudCase {
  readonly id: FraudCaseId;
  readonly tenantId: TenantId;
  readonly subjectKind: RiskSubjectKind;
  readonly subjectId: string;
  readonly status: FraudCaseStatus;
  readonly evidence: readonly Evidence[];
  readonly history: readonly ReviewDecision[];
  readonly openedAt: Date;
  readonly resolvedAt: Date | null;
}

/** Apply a review decision to a case, producing the next immutable snapshot. */
export function decideCase(fraudCase: FraudCase, decision: ReviewDecision): FraudCase {
  return {
    ...fraudCase,
    status: "resolved",
    history: [...fraudCase.history, decision],
    resolvedAt: decision.decidedAt,
  };
}
