import { type FraudCaseId, NotFoundError, type RequestContext, type UserId } from "@partnera/core";
import {
  DEFAULT_FRAUD_CONFIG,
  type FraudCase,
  type FraudConfig,
  type ReviewOutcome,
  type RiskScore,
  type RiskSignal,
  type RiskSubjectKind,
  scoreSignals,
} from "@partnera/fraud-engine";
import { ServiceBase } from "../context";

export interface AssessInput {
  readonly subjectKind: RiskSubjectKind;
  readonly subjectId: string;
  readonly signals: readonly RiskSignal[];
  readonly config?: FraudConfig;
}

export interface ReviewInput {
  readonly outcome: ReviewOutcome;
  readonly note: string;
}

/**
 * Fraud assessment and review. Signals and scores are persisted (append-only)
 * and explainable; a non-`allow` action opens a review case. Money is only ever
 * held via the ledger, never deleted, keeping the append-only invariant intact.
 */
export class FraudService extends ServiceBase {
  async assess(ctx: RequestContext, input: AssessInput): Promise<RiskScore> {
    this.require(ctx, "fraud.review");
    const now = this.clock.now();
    const config = input.config ?? DEFAULT_FRAUD_CONFIG;
    const score = scoreSignals(input.subjectKind, input.subjectId, input.signals, config, now);

    for (const signal of input.signals) {
      this.uow.fraud.recordSignal({
        id: this.ids.next(),
        tenantId: ctx.tenantId,
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
        signal,
      });
    }
    this.uow.fraud.recordScore({ id: this.ids.next(), tenantId: ctx.tenantId, score });

    if (score.action !== "allow") {
      this.uow.fraud.openCase({
        id: this.ids.next<FraudCaseId>(),
        tenantId: ctx.tenantId,
        subjectKind: input.subjectKind,
        subjectId: input.subjectId,
        status: "open",
        evidence: [
          {
            kind: "risk_score",
            summary: `score ${score.score} (${score.band}) → ${score.action}`,
            signals: [...input.signals],
            capturedAt: now,
          },
        ],
        history: [],
        openedAt: now,
        resolvedAt: null,
      });
      await this.audit(ctx, "fraud.open_case", "fraud_subject", input.subjectId, {
        score: score.score,
      });
    }
    return score;
  }

  listCases(ctx: RequestContext, status?: FraudCase["status"]): FraudCase[] {
    this.require(ctx, "fraud.read");
    return this.uow.fraud.listCases(ctx.tenantId, status ? { status } : undefined);
  }

  getCase(ctx: RequestContext, caseId: FraudCaseId): FraudCase {
    this.require(ctx, "fraud.read");
    const found = this.uow.fraud.getCase(ctx.tenantId, caseId);
    if (!found) throw new NotFoundError("Fraud case not found", { caseId });
    return found;
  }

  async review(ctx: RequestContext, caseId: FraudCaseId, input: ReviewInput): Promise<FraudCase> {
    this.require(ctx, "fraud.review");
    const next = this.uow.fraud.appendDecision(ctx.tenantId, caseId, {
      reviewerUserId: ctx.actorUserId as UserId,
      outcome: input.outcome,
      note: input.note,
      decidedAt: this.clock.now(),
    });
    if (!next) throw new NotFoundError("Fraud case not found", { caseId });
    await this.audit(ctx, "fraud.review", "fraud_case", caseId, { outcome: input.outcome });
    return next;
  }
}
