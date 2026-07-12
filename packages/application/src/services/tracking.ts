import {
  type AffiliateId,
  type CampaignId,
  type ClickId,
  type CommissionId,
  type ConversionId,
  type CouponId,
  type DomainEvent,
  type LedgerEventId,
  Money,
  NotFoundError,
  type OrderId,
  ValidationError,
} from "@partnera/core";
import { type CommissionInstruction, type EvaluationContext } from "@partnera/offer-engine";
import { type LedgerEvent } from "@partnera/commission-engine";
import {
  type AttributionPolicy,
  type Conversion,
  DEFAULT_ATTRIBUTION_POLICY,
  type NormalizedOrder,
  type TouchSignals,
} from "@partnera/tracking-engine";
import {
  DEFAULT_FRAUD_CONFIG,
  type FraudConfig,
  type RiskSignal,
  scoreSignals,
} from "@partnera/fraud-engine";
import { type FraudCaseId } from "@partnera/core";
import { ServiceBase } from "../context";
import { type RequestContext } from "@partnera/core";

export interface CreateLinkInput {
  readonly affiliateId: AffiliateId;
  readonly campaignId?: CampaignId | null;
  readonly code: string;
}

export interface CreateCouponInput {
  readonly affiliateId: AffiliateId;
  readonly campaignId?: CampaignId | null;
  readonly code: string;
}

export interface RecordClickInput {
  readonly affiliateId: AffiliateId;
  readonly campaignId?: CampaignId | null;
  readonly linkCode: string;
  readonly sessionToken?: string | null;
  readonly signals: TouchSignals;
  readonly occurredAt?: Date;
}

export interface IngestOrderInput {
  readonly platformOrderId: string;
  readonly totalMinorUnits: string;
  readonly currency: string;
  readonly customerType: "new" | "returning";
  readonly couponCodes?: readonly string[];
  readonly sessionToken?: string | null;
  readonly placedAt?: Date;
}

export interface ProcessConversionInput {
  readonly orderId: OrderId;
  readonly policy?: AttributionPolicy;
  /** Optional fraud signals; if present, the resulting commission is gated. */
  readonly signals?: readonly RiskSignal[];
  readonly fraudConfig?: FraudConfig;
}

export interface ConversionResult {
  readonly converted: boolean;
  readonly reason: string;
  readonly conversionId: ConversionId | null;
  readonly commissionId: CommissionId | null;
  readonly held: boolean;
}

export interface RecordRefundInput {
  readonly orderId: OrderId;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly reason: string;
  readonly occurredAt?: Date;
}

/**
 * Tracking + the money spine. `processConversion` is the reference conversion
 * path from docs/02: attribute → record conversion → evaluate the active offer →
 * append `commission.created` to the append-only ledger, with optional fraud
 * gating. Every write is tenant-scoped from the context, idempotent, and audited.
 *
 * Permission mapping (assumption, documented in docs/23-persistence.md): program
 * tracking operations require `links.manage`; refund-driven clawbacks require
 * `commissions.adjust`. A production deploy would add dedicated ingestion
 * service-accounts; the mapping here reuses the existing catalog unchanged.
 */
export class TrackingService extends ServiceBase {
  createLink(ctx: RequestContext, input: CreateLinkInput): void {
    this.require(ctx, "links.manage");
    if (input.code.trim() === "") throw new ValidationError("Link code is required");
    this.uow.tracking.createLink({
      id: this.ids.next<ClickId>(),
      tenantId: ctx.tenantId,
      affiliateId: input.affiliateId,
      campaignId: input.campaignId ?? null,
      code: input.code,
      createdAt: this.clock.now(),
    });
  }

  createCoupon(ctx: RequestContext, input: CreateCouponInput): void {
    this.require(ctx, "coupons.manage");
    if (input.code.trim() === "") throw new ValidationError("Coupon code is required");
    this.uow.tracking.createCoupon({
      id: this.ids.next<CouponId>(),
      tenantId: ctx.tenantId,
      affiliateId: input.affiliateId,
      campaignId: input.campaignId ?? null,
      code: input.code,
      createdAt: this.clock.now(),
    });
  }

  recordClick(ctx: RequestContext, input: RecordClickInput): void {
    this.require(ctx, "links.manage");
    this.uow.tracking.recordClick({
      id: this.ids.next<ClickId>(),
      tenantId: ctx.tenantId,
      affiliateId: input.affiliateId,
      campaignId: input.campaignId ?? null,
      linkCode: input.linkCode,
      sessionToken: input.sessionToken ?? null,
      occurredAt: input.occurredAt ?? this.clock.now(),
      signals: input.signals,
    });
  }

  /** Ingest a normalized order idempotently (safe to replay a webhook). */
  ingestOrder(ctx: RequestContext, input: IngestOrderInput): { orderId: OrderId; created: boolean } {
    this.require(ctx, "links.manage");
    const orderId = this.ids.next<OrderId>();
    const order: NormalizedOrder = {
      id: orderId,
      tenantId: ctx.tenantId,
      platformOrderId: input.platformOrderId,
      totalMinorUnits: input.totalMinorUnits,
      currency: input.currency,
      customerType: input.customerType,
      couponCodes: input.couponCodes ?? [],
      sessionToken: input.sessionToken ?? null,
      placedAt: input.placedAt ?? this.clock.now(),
    };
    const result = this.uow.tracking.ingestOrder(order);
    return { orderId: result.order.id, created: result.created };
  }

  /**
   * The reference money-spine pipeline. Idempotent per order: a second call for
   * an already-converted order returns the existing outcome without creating a
   * duplicate commission.
   */
  async processConversion(
    ctx: RequestContext,
    input: ProcessConversionInput,
  ): Promise<ConversionResult> {
    this.require(ctx, "links.manage");
    const now = this.clock.now();

    return this.uow.transact(async () => {
      const order = this.uow.tracking.getOrder(ctx.tenantId, input.orderId);
      if (!order) throw new NotFoundError("Order not found", { orderId: input.orderId });

      // Replay-safety: if this order already converted, do not create again.
      const existing = this.uow.tracking.getConversionByOrder(ctx.tenantId, input.orderId);
      if (existing) {
        const commissions = await this.uow.ledger.commissionsForConversion(ctx.tenantId, existing.id);
        return {
          converted: true,
          reason: "already_converted",
          conversionId: existing.id,
          commissionId: commissions[0] ?? null,
          held: false,
        };
      }

      // 1. Attribute.
      const policy = input.policy ?? DEFAULT_ATTRIBUTION_POLICY;
      const claims = this.uow.tracking.collectClaims(ctx.tenantId, order);
      const attribution = this.attribution.resolve(claims, order.placedAt, policy);
      if (!attribution) {
        return {
          converted: false,
          reason: "unattributed",
          conversionId: null,
          commissionId: null,
          held: false,
        };
      }

      // 2. Record the conversion.
      const conversion: Conversion = {
        id: this.ids.next<ConversionId>(),
        tenantId: ctx.tenantId,
        orderId: order.id,
        affiliateId: attribution.affiliateId,
        campaignId: attribution.campaignId,
        basis: attribution.basis,
        attributedAt: now,
        reversed: false,
      };
      this.uow.tracking.recordConversion(conversion);
      await this.publish("conversion.recorded", ctx, conversion.id, { orderId: order.id });

      // 3. Evaluate the tenant's active offers; pick the winner (highest value,
      //    tie-break by stacking priority — D-052 winner-takes-highest default).
      const winner = this.selectWinningInstruction(ctx, order, conversion, now);
      if (!winner) {
        return {
          converted: true,
          reason: "no_matching_offer",
          conversionId: conversion.id,
          commissionId: null,
          held: false,
        };
      }

      // 4. Append commission.created to the append-only ledger.
      const commissionId = this.ids.next<CommissionId>();
      await this.uow.ledger.appendGuarded(
        this.createdEvent(ctx, commissionId, conversion, winner, now),
      );
      await this.audit(ctx, "commissions.create", "commission", commissionId, {
        conversionId: conversion.id,
        amount: winner.amount.toJSON(),
      });

      // 5. Optional fraud gating: hold the commission and open a case if risky.
      let held = false;
      if (input.signals && input.signals.length > 0) {
        held = await this.applyFraudGate(
          ctx,
          commissionId,
          conversion,
          input.signals,
          input.fraudConfig ?? DEFAULT_FRAUD_CONFIG,
          now,
        );
      }

      await this.publish("commission.created", ctx, commissionId, {
        conversionId: conversion.id,
        held,
      });

      return {
        converted: true,
        reason: held ? "commission_held" : "commission_created",
        conversionId: conversion.id,
        commissionId,
        held,
      };
    });
  }

  /**
   * Process a refund: record it, mark the conversion reversed, and reverse (or
   * reject) every commission the conversion produced — money is never edited,
   * only compensated with new ledger events (append-only).
   */
  async recordRefund(ctx: RequestContext, input: RecordRefundInput): Promise<{ reversed: number }> {
    this.require(ctx, "commissions.adjust");
    const now = input.occurredAt ?? this.clock.now();

    return this.uow.transact(async () => {
      const order = this.uow.tracking.getOrder(ctx.tenantId, input.orderId);
      if (!order) throw new NotFoundError("Order not found", { orderId: input.orderId });

      this.uow.tracking.recordRefund({
        id: this.ids.next<OrderId>(),
        orderId: input.orderId,
        tenantId: ctx.tenantId,
        amountMinorUnits: input.amountMinorUnits,
        currency: input.currency,
        reason: input.reason,
        occurredAt: now,
      });

      const conversion = this.uow.tracking.getConversionByOrder(ctx.tenantId, input.orderId);
      if (!conversion) return { reversed: 0 };
      this.uow.tracking.markConversionReversed(ctx.tenantId, conversion.id);

      const commissionIds = await this.uow.ledger.commissionsForConversion(
        ctx.tenantId,
        conversion.id,
      );
      let reversed = 0;
      for (const commissionId of commissionIds) {
        const record = await this.uow.ledger.getCommission(ctx.tenantId, commissionId);
        if (!record) continue;
        const event = this.clawbackEvent(ctx, commissionId, conversion.affiliateId, record.state, input.reason, now);
        if (!event) continue;
        await this.uow.ledger.appendGuarded(event);
        reversed += 1;
      }
      await this.audit(ctx, "commissions.reverse", "order", input.orderId, { reversed });
      return { reversed };
    });
  }

  // --- internals ---

  private selectWinningInstruction(
    ctx: RequestContext,
    order: NormalizedOrder,
    conversion: Conversion,
    now: Date,
  ): CommissionInstruction | null {
    const total = Money.ofMinor(BigInt(order.totalMinorUnits), order.currency);
    const evalCtx: EvaluationContext = {
      conversionId: conversion.id,
      order: {
        id: order.id,
        tenantId: order.tenantId,
        total,
        lines: [],
        customerType: order.customerType,
      },
      attribution: {
        basis: conversion.basis,
        affiliateId: conversion.affiliateId,
        affiliateTier: null,
        campaignId: conversion.campaignId,
      },
      now,
    };

    let winner: { instruction: CommissionInstruction; priority: number } | null = null;
    for (const offerRow of this.uow.offers.listOffers(ctx.tenantId)) {
      const definition = this.uow.offers.getActiveDefinition(ctx.tenantId, offerRow.id);
      if (!definition) continue;
      const result = this.evaluator.evaluate(definition, evalCtx);
      if (!result.ok || result.value === null) continue;
      const instruction = result.value;
      if (
        winner === null ||
        instruction.amount.compare(winner.instruction.amount) > 0 ||
        (instruction.amount.compare(winner.instruction.amount) === 0 &&
          offerRow.stackingPriority > winner.priority)
      ) {
        winner = { instruction, priority: offerRow.stackingPriority };
      }
    }
    return winner?.instruction ?? null;
  }

  private createdEvent(
    ctx: RequestContext,
    commissionId: CommissionId,
    conversion: Conversion,
    instruction: CommissionInstruction,
    now: Date,
  ): LedgerEvent {
    return {
      id: this.ids.next(),
      type: "commission.created",
      tenantId: ctx.tenantId,
      affiliateId: conversion.affiliateId,
      commissionId,
      occurredAt: now,
      correlationId: ctx.requestId,
      conversionId: conversion.id,
      offerId: instruction.offerId,
      offerVersion: instruction.offerVersion,
      amount: instruction.amount.toJSON(),
      rewardKind: instruction.rewardKind,
      reasonPath: instruction.reasonPath,
    };
  }

  private clawbackEvent(
    ctx: RequestContext,
    commissionId: CommissionId,
    affiliateId: AffiliateId,
    state: string,
    reason: string,
    now: Date,
  ): LedgerEvent | null {
    const base = {
      id: this.ids.next<LedgerEventId>(),
      tenantId: ctx.tenantId,
      affiliateId,
      commissionId,
      occurredAt: now,
      correlationId: ctx.requestId,
    };
    if (state === "approved" || state === "paid") {
      return { ...base, type: "commission.reversed", reason };
    }
    if (state === "pending" || state === "held") {
      return { ...base, type: "commission.rejected", reason };
    }
    return null; // already terminal (reversed/rejected) — nothing to compensate.
  }

  private async applyFraudGate(
    ctx: RequestContext,
    commissionId: CommissionId,
    conversion: Conversion,
    signals: readonly RiskSignal[],
    config: FraudConfig,
    now: Date,
  ): Promise<boolean> {
    const score = scoreSignals("conversion", conversion.id, signals, config, now);
    for (const signal of signals) {
      this.uow.fraud.recordSignal({
        id: this.ids.next(),
        tenantId: ctx.tenantId,
        subjectKind: "conversion",
        subjectId: conversion.id,
        signal,
      });
    }
    this.uow.fraud.recordScore({ id: this.ids.next(), tenantId: ctx.tenantId, score });

    if (score.action === "allow") return false;

    await this.uow.ledger.appendGuarded({
      id: this.ids.next(),
      type: "commission.held",
      tenantId: ctx.tenantId,
      affiliateId: conversion.affiliateId,
      commissionId,
      occurredAt: now,
      correlationId: ctx.requestId,
      reason: `fraud:${score.band}:${score.action}`,
    });
    this.uow.fraud.openCase({
      id: this.ids.next<FraudCaseId>(),
      tenantId: ctx.tenantId,
      subjectKind: "conversion",
      subjectId: conversion.id,
      status: "open",
      evidence: [
        {
          kind: "risk_score",
          summary: `score ${score.score} (${score.band}) → ${score.action}`,
          signals: [...signals],
          capturedAt: now,
        },
      ],
      history: [],
      openedAt: now,
      resolvedAt: null,
    });
    await this.audit(ctx, "fraud.hold", "commission", commissionId, {
      score: score.score,
      band: score.band,
    });
    return true;
  }

  private async publish(
    name: string,
    ctx: RequestContext,
    subjectId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const event: DomainEvent = {
      id: this.ids.next(),
      name,
      occurredAt: this.clock.now(),
      tenantId: ctx.tenantId,
      correlationId: ctx.requestId,
      payload: { subjectId, ...payload },
    };
    await this.events.publish(event);
  }
}
