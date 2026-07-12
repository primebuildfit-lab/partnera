import {
  type AffiliateId,
  type CommissionId,
  type LedgerEventId,
  Money,
  NotFoundError,
  type RequestContext,
  ValidationError,
} from "@partnera/core";
import { type Balance, type CommissionRecord, type LedgerEvent } from "@partnera/commission-engine";
import { ServiceBase } from "../context";

export interface AdjustInput {
  readonly deltaMinorUnits: string;
  readonly currency: string;
  readonly reason: string;
}

/**
 * Commission lifecycle and balances. Every state change is a new append-only
 * ledger event validated by the engine's state machine before it is written —
 * balances are always derived, never edited. Separation of duties is respected
 * via distinct permissions (approve vs. adjust vs. fraud hold/release).
 */
export class LedgerService extends ServiceBase {
  getCommission(ctx: RequestContext, commissionId: CommissionId): Promise<CommissionRecord | null> {
    this.require(ctx, "commissions.read");
    return this.uow.ledger.getCommission(ctx.tenantId, commissionId);
  }

  balances(ctx: RequestContext, affiliateId: AffiliateId): Promise<Balance[]> {
    this.require(ctx, "commissions.read");
    return this.uow.ledger.balancesForAffiliate(ctx.tenantId, affiliateId);
  }

  approve(ctx: RequestContext, commissionId: CommissionId): Promise<void> {
    return this.transition(ctx, commissionId, "commissions.approve", "commissions.approve", (base) => ({
      ...base,
      type: "commission.approved",
    }));
  }

  reject(ctx: RequestContext, commissionId: CommissionId, reason: string): Promise<void> {
    return this.transition(ctx, commissionId, "commissions.approve", "commissions.reject", (base) => ({
      ...base,
      type: "commission.rejected",
      reason,
    }));
  }

  hold(ctx: RequestContext, commissionId: CommissionId, reason: string): Promise<void> {
    return this.transition(ctx, commissionId, "fraud.review", "commissions.hold", (base) => ({
      ...base,
      type: "commission.held",
      reason,
    }));
  }

  release(ctx: RequestContext, commissionId: CommissionId): Promise<void> {
    return this.transition(ctx, commissionId, "fraud.review", "commissions.release", (base) => ({
      ...base,
      type: "commission.released",
    }));
  }

  async adjust(ctx: RequestContext, commissionId: CommissionId, input: AdjustInput): Promise<void> {
    const delta = Money.ofMinor(BigInt(input.deltaMinorUnits), input.currency);
    if (input.reason.trim() === "") throw new ValidationError("Adjustment reason is required");
    await this.transition(ctx, commissionId, "commissions.adjust", "commissions.adjust", (base) => ({
      ...base,
      type: "commission.adjusted",
      delta: delta.toJSON(),
      reason: input.reason,
    }));
  }

  private async transition(
    ctx: RequestContext,
    commissionId: CommissionId,
    permission: Parameters<ServiceBase["require"]>[1],
    action: string,
    build: (base: {
      id: LedgerEventId;
      tenantId: RequestContext["tenantId"];
      affiliateId: AffiliateId;
      commissionId: CommissionId;
      occurredAt: Date;
      correlationId: string;
    }) => LedgerEvent,
  ): Promise<void> {
    this.require(ctx, permission);
    const record = await this.uow.ledger.getCommission(ctx.tenantId, commissionId);
    if (!record) throw new NotFoundError("Commission not found", { commissionId });
    const event = build({
      id: this.ids.next<LedgerEventId>(),
      tenantId: ctx.tenantId,
      affiliateId: record.affiliateId,
      commissionId,
      occurredAt: this.clock.now(),
      correlationId: ctx.requestId,
    });
    await this.uow.ledger.appendGuarded(event);
    await this.audit(ctx, action, "commission", commissionId, {});
  }
}
