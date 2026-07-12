import {
  type AffiliateId,
  type CommissionId,
  ConflictError,
  type Money,
  NotFoundError,
  type PayoutId,
  type RequestContext,
  ValidationError,
} from "@partnera/core";
import {
  type PayoutEvent,
  type PayoutEventId,
  type PayoutRail,
  type PayoutRequest,
  UnconfiguredPayoutRail,
} from "@partnera/payment-engine";
import { PLATFORM_CONFIG, resolveConfig } from "@partnera/platform";
import { type AppDeps, ServiceBase } from "../context";

export interface RequestPayoutInput {
  readonly affiliateId: AffiliateId;
  readonly commissionIds: readonly CommissionId[];
  readonly destinationRef: string;
}

/**
 * Non-custodial payout orchestration. Requests are built from *approved*
 * commissions only; approval is separated from execution (D-053); execution
 * calls an injected {@link PayoutRail} (unconfigured by default — no provider
 * ships here) and, on success, appends `commission.paid` to the ledger, closing
 * the money spine. Every step is an append-only payout event and is audited.
 */
export class PaymentService extends ServiceBase {
  private readonly rail: PayoutRail;

  constructor(deps: AppDeps, rail?: PayoutRail) {
    super(deps);
    this.rail = rail ?? new UnconfiguredPayoutRail();
  }

  async requestPayout(ctx: RequestContext, input: RequestPayoutInput): Promise<PayoutRequest> {
    this.require(ctx, "payouts.request");
    if (input.commissionIds.length === 0) {
      throw new ValidationError("A payout must include at least one commission");
    }

    return this.uow.transact(async () => {
      // Verify every commission is approved, belongs to this affiliate and tenant,
      // and share a currency; compute the amount from the ledger, not the client.
      let amount: Money | null = null;
      for (const commissionId of input.commissionIds) {
        const record = await this.uow.ledger.getCommission(ctx.tenantId, commissionId);
        if (!record) throw new NotFoundError("Commission not found", { commissionId });
        if (record.affiliateId !== input.affiliateId) {
          throw new ConflictError("Commission belongs to a different affiliate", { commissionId });
        }
        if (record.state !== "approved") {
          throw new ConflictError("Only approved commissions can be paid", {
            commissionId,
            state: record.state,
          });
        }
        amount = amount === null ? record.amount : amount.add(record.amount);
      }
      const total = amount!;

      const minPayout = resolveConfig(
        PLATFORM_CONFIG.minPayoutMinorUnits,
        await this.uow.config.get(PLATFORM_CONFIG.minPayoutMinorUnits.key, ctx.tenantId),
      );
      if (total.minorUnits < BigInt(minPayout)) {
        throw new ValidationError("Amount is below the minimum payout threshold", {
          minMinorUnits: minPayout,
        });
      }

      const payoutId = this.ids.next<PayoutId>();
      await this.uow.payouts.appendGuarded({
        id: this.ids.next<PayoutEventId>(),
        type: "payout.requested",
        tenantId: ctx.tenantId,
        payoutId,
        affiliateId: input.affiliateId,
        occurredAt: this.clock.now(),
        correlationId: ctx.requestId,
        actorUserId: ctx.actorUserId,
        amount: total.toJSON(),
        commissionIds: input.commissionIds,
        destinationRef: input.destinationRef,
      });
      await this.audit(ctx, "payouts.request", "payout", payoutId, { amount: total.toJSON() });
      const payout = await this.uow.payouts.getPayout(ctx.tenantId, payoutId);
      return payout!;
    });
  }

  async approve(ctx: RequestContext, payoutId: PayoutId): Promise<void> {
    this.require(ctx, "payouts.approve");
    const events = await this.uow.payouts.readByPayout(ctx.tenantId, payoutId);
    if (events.length === 0) throw new NotFoundError("Payout not found", { payoutId });
    // Separation of duties: the approver must differ from the requester (D-053).
    const requester = events.find((e) => e.type === "payout.requested")?.actorUserId;
    if (requester === ctx.actorUserId && !ctx.isPlatformOperator) {
      throw new ConflictError("Separation of duties: approver must differ from requester", {
        payoutId,
      });
    }
    await this.uow.payouts.appendGuarded(this.event(ctx, payoutId, events, "payout.approved"));
    await this.audit(ctx, "payouts.approve", "payout", payoutId, {});
  }

  async execute(ctx: RequestContext, payoutId: PayoutId): Promise<PayoutRequest> {
    this.require(ctx, "payouts.execute");
    return this.runExecution(ctx, payoutId, false);
  }

  async retry(ctx: RequestContext, payoutId: PayoutId): Promise<PayoutRequest> {
    this.require(ctx, "payouts.execute");
    return this.runExecution(ctx, payoutId, true);
  }

  getPayout(ctx: RequestContext, payoutId: PayoutId): Promise<PayoutRequest | null> {
    this.require(ctx, "payouts.read");
    return this.uow.payouts.getPayout(ctx.tenantId, payoutId);
  }

  listPayouts(ctx: RequestContext): Promise<PayoutRequest[]> {
    this.require(ctx, "payouts.read");
    return this.uow.payouts.listByTenant(ctx.tenantId);
  }

  private async runExecution(
    ctx: RequestContext,
    payoutId: PayoutId,
    isRetry: boolean,
  ): Promise<PayoutRequest> {
    const payout = await this.uow.payouts.getPayout(ctx.tenantId, payoutId);
    if (!payout) throw new NotFoundError("Payout not found", { payoutId });

    if (isRetry && payout.state === "failed") {
      const priorEvents = await this.uow.payouts.readByPayout(ctx.tenantId, payoutId);
      await this.uow.payouts.appendGuarded({
        ...this.baseEvent(ctx, payoutId, priorEvents),
        type: "payout.retry_scheduled",
        notBefore: this.clock.now(),
      });
    }

    const events = await this.uow.payouts.readByPayout(ctx.tenantId, payoutId);
    await this.uow.payouts.appendGuarded({
      ...this.baseEvent(ctx, payoutId, events),
      type: "payout.execution_started",
      railName: this.rail.name,
    });

    const attemptEvents = await this.uow.payouts.readByPayout(ctx.tenantId, payoutId);
    const current = await this.uow.payouts.getPayout(ctx.tenantId, payoutId);
    const result = await this.rail.execute({
      payoutId,
      tenantId: ctx.tenantId,
      affiliateId: payout.affiliateId,
      amount: payout.amount.toJSON(),
      destinationRef: payout.destinationRef,
      idempotencyKey: `${payoutId}:${current!.attempts}`,
    });

    if (result.ok) {
      await this.uow.payouts.appendGuarded({
        ...this.baseEvent(ctx, payoutId, attemptEvents),
        type: "payout.succeeded",
        providerRef: result.providerRef ?? "unknown",
      });
      // Close the money spine: mark each included commission paid.
      for (const commissionId of payout.commissionIds) {
        const record = await this.uow.ledger.getCommission(ctx.tenantId, commissionId);
        if (record && record.state === "approved") {
          await this.uow.ledger.appendGuarded({
            id: this.ids.next(),
            type: "commission.paid",
            tenantId: ctx.tenantId,
            affiliateId: payout.affiliateId,
            commissionId,
            occurredAt: this.clock.now(),
            correlationId: ctx.requestId,
            payoutId,
          });
        }
      }
      await this.audit(ctx, "payouts.execute", "payout", payoutId, { result: "succeeded" });
    } else {
      const failEvents = await this.uow.payouts.readByPayout(ctx.tenantId, payoutId);
      await this.uow.payouts.appendGuarded({
        ...this.baseEvent(ctx, payoutId, failEvents),
        type: "payout.failed",
        reason: result.error ?? "unknown",
      });
      await this.audit(ctx, "payouts.execute", "payout", payoutId, {
        result: "failed",
        retryable: result.retryable,
      });
    }

    const final = await this.uow.payouts.getPayout(ctx.tenantId, payoutId);
    return final!;
  }

  private baseEvent(
    ctx: RequestContext,
    payoutId: PayoutId,
    events: readonly PayoutEvent[],
  ): {
    id: PayoutEventId;
    tenantId: RequestContext["tenantId"];
    payoutId: PayoutId;
    affiliateId: AffiliateId;
    occurredAt: Date;
    correlationId: string;
    actorUserId: RequestContext["actorUserId"];
  } {
    const requested = events.find((e) => e.type === "payout.requested");
    if (!requested) throw new NotFoundError("Payout not found", { payoutId });
    return {
      id: this.ids.next<PayoutEventId>(),
      tenantId: ctx.tenantId,
      payoutId,
      affiliateId: requested.affiliateId,
      occurredAt: this.clock.now(),
      correlationId: ctx.requestId,
      actorUserId: ctx.actorUserId,
    };
  }

  private event(
    ctx: RequestContext,
    payoutId: PayoutId,
    events: readonly PayoutEvent[],
    type: "payout.approved",
  ): PayoutEvent {
    return { ...this.baseEvent(ctx, payoutId, events), type };
  }
}
