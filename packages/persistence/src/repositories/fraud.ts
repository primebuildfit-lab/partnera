import { type FraudCaseId, type TenantId } from "@partnera/core";
import {
  type FraudCase,
  type ReviewDecision,
  type RiskScore,
  type RiskSignal,
  type RiskSubjectKind,
} from "@partnera/fraud-engine";
import { type Collection } from "../relational/store";

/** A persisted fraud signal observation (append-only). */
export interface FraudSignalRow {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly subjectKind: RiskSubjectKind;
  readonly subjectId: string;
  readonly signal: RiskSignal;
}

/** A persisted risk-score computation (append-only history; latest is derived). */
export interface RiskScoreRow {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly score: RiskScore;
}

/**
 * Fraud persistence: append-only signals and score history, plus mutable review
 * cases with an embedded, append-only decision trail. Money is held and routed,
 * never deleted (docs/08 invariant 1); scores are explainable and retained so a
 * future AI reviewer can train on labeled outcomes (docs/08 "Future: AI").
 */
export class FraudRepository {
  constructor(
    private readonly signals: Collection<FraudSignalRow>,
    private readonly scores: Collection<RiskScoreRow>,
    private readonly cases: Collection<FraudCase>,
  ) {}

  recordSignal(row: FraudSignalRow): void {
    this.signals.insertIdempotent(row);
  }

  listSignals(tenantId: TenantId, subjectId: string): RiskSignal[] {
    return this.signals
      .find((s) => s.tenantId === tenantId && s.subjectId === subjectId)
      .map((s) => s.signal);
  }

  recordScore(row: RiskScoreRow): void {
    this.scores.insertIdempotent(row);
  }

  latestScore(tenantId: TenantId, subjectId: string): RiskScore | null {
    const rows = this.scores
      .find((s) => s.tenantId === tenantId && s.score.subjectId === subjectId)
      .map((s) => s.score)
      .sort((a, b) => b.computedAt.getTime() - a.computedAt.getTime());
    return rows[0] ?? null;
  }

  openCase(fraudCase: FraudCase): void {
    this.cases.insert(fraudCase);
  }

  getCase(tenantId: TenantId, caseId: FraudCaseId): FraudCase | null {
    const row = this.cases.get(caseId);
    return row && row.tenantId === tenantId ? row : null;
  }

  listCases(tenantId: TenantId, filter?: { status?: FraudCase["status"] }): FraudCase[] {
    return this.cases.find(
      (c) => c.tenantId === tenantId && (filter?.status === undefined || c.status === filter.status),
    );
  }

  /** Replace a case with its next immutable snapshot (optimistic concurrency). */
  saveCase(next: FraudCase): void {
    const current = this.cases.getVersioned(next.id);
    if (current) this.cases.replace(next, current.version);
    else this.cases.insert(next);
  }

  /** Append a review decision to an open case, transitioning it to resolved. */
  appendDecision(tenantId: TenantId, caseId: FraudCaseId, decision: ReviewDecision): FraudCase | null {
    const current = this.cases.getVersioned(caseId);
    if (!current || current.row.tenantId !== tenantId) return null;
    const next: FraudCase = {
      ...current.row,
      status: "resolved",
      history: [...current.row.history, decision],
      resolvedAt: decision.decidedAt,
    };
    this.cases.replace(next, current.version);
    return next;
  }
}
