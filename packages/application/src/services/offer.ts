import {
  type CampaignId,
  type ConversionId,
  Money,
  NotFoundError,
  type OfferId,
  type OrderId,
  type ProgramId,
  type RequestContext,
  ValidationError,
} from "@partnera/core";
import {
  type CalculationBlock,
  type CommissionInstruction,
  type ConditionBlock,
  type EvaluationContext,
  type LimitBlock,
  type OfferDefinition,
  type RewardBlock,
  type ScheduleBlock,
  type ScopeBlock,
  validateOffer,
} from "@partnera/offer-engine";
import { type OfferRow, type OfferVersionRow } from "@partnera/persistence";
import { ServiceBase } from "../context";

/** The configurable body of an offer (everything except identity/version). */
export interface OfferBody {
  readonly scope: readonly ScopeBlock[];
  readonly conditions: readonly ConditionBlock[];
  readonly calculation: CalculationBlock;
  readonly reward: RewardBlock;
  readonly schedule: ScheduleBlock;
  readonly limits: readonly LimitBlock[];
  readonly stackingPriority?: number;
}

export interface CreateOfferInput extends OfferBody {
  readonly programId: ProgramId;
  readonly name: string;
}

export interface SimulateInput {
  readonly totalMinorUnits: string;
  readonly currency: string;
  readonly customerType: "new" | "returning";
  readonly basis: "link" | "coupon" | "session";
  readonly affiliateTier?: string | null;
  readonly campaignId?: CampaignId | null;
}

/**
 * Offer authoring. Offers are versioned and validated at save time; editing an
 * active offer appends a new draft version (never overwrites), and activation
 * only moves the published-version pointer. Simulation is a dry-run of the
 * evaluator against a synthetic order — no persistence, no commission.
 */
export class OfferService extends ServiceBase {
  createOffer(ctx: RequestContext, input: CreateOfferInput): OfferRow {
    this.require(ctx, "offers.create");
    const offerId = this.ids.next<OfferId>();
    const definition = this.buildDefinition(ctx, offerId, input.programId, input.name, input, 1);
    this.assertValid(definition);
    const row = this.uow.offers.createOffer({
      id: offerId,
      tenantId: ctx.tenantId,
      programId: input.programId,
      name: input.name,
      definition,
      stackingPriority: input.stackingPriority ?? 0,
      now: this.clock.now(),
    });
    return row;
  }

  addVersion(ctx: RequestContext, offerId: OfferId, input: OfferBody & { name?: string }): OfferVersionRow {
    this.require(ctx, "offers.update");
    const existing = this.uow.offers.getOffer(ctx.tenantId, offerId);
    if (!existing) throw new NotFoundError("Offer not found", { offerId });
    const definition = this.buildDefinition(
      ctx,
      offerId,
      existing.programId,
      input.name ?? existing.name,
      input,
      existing.latestVersion + 1,
    );
    this.assertValid(definition);
    const version = this.uow.offers.addVersion(ctx.tenantId, offerId, definition, this.clock.now());
    return version;
  }

  async activate(ctx: RequestContext, offerId: OfferId, version: number): Promise<OfferRow> {
    this.require(ctx, "offers.activate");
    const row = this.uow.offers.activate(ctx.tenantId, offerId, version, this.clock.now());
    await this.audit(ctx, "offers.activate", "offer", offerId, { version });
    return row;
  }

  getOffer(ctx: RequestContext, offerId: OfferId): OfferRow {
    this.require(ctx, "offers.read");
    const row = this.uow.offers.getOffer(ctx.tenantId, offerId);
    if (!row) throw new NotFoundError("Offer not found", { offerId });
    return row;
  }

  listOffers(ctx: RequestContext): OfferRow[] {
    this.require(ctx, "offers.read");
    return this.uow.offers.listOffers(ctx.tenantId);
  }

  /** Dry-run the active offer against a synthetic order. Never persists. */
  simulate(ctx: RequestContext, offerId: OfferId, input: SimulateInput): CommissionInstruction | null {
    this.require(ctx, "offers.simulate");
    const definition = this.uow.offers.getActiveDefinition(ctx.tenantId, offerId);
    if (!definition) throw new NotFoundError("No active offer version to simulate", { offerId });
    const total = Money.ofMinor(BigInt(input.totalMinorUnits), input.currency);
    const evalCtx: EvaluationContext = {
      conversionId: "sim_conversion" as unknown as ConversionId,
      order: {
        id: "sim_order" as unknown as OrderId,
        tenantId: ctx.tenantId,
        total,
        lines: [],
        customerType: input.customerType,
      },
      attribution: {
        basis: input.basis,
        affiliateId: "sim_affiliate" as never,
        affiliateTier: input.affiliateTier ?? null,
        campaignId: input.campaignId ?? null,
      },
      now: this.clock.now(),
    };
    const result = this.evaluator.evaluate(definition, evalCtx);
    if (!result.ok) throw result.error;
    return result.value;
  }

  private buildDefinition(
    ctx: RequestContext,
    offerId: OfferId,
    programId: ProgramId,
    name: string,
    body: OfferBody,
    version: number,
  ): OfferDefinition {
    return {
      id: offerId,
      tenantId: ctx.tenantId,
      programId,
      version,
      name,
      status: "draft",
      scope: body.scope,
      conditions: body.conditions,
      calculation: body.calculation,
      reward: body.reward,
      schedule: body.schedule,
      limits: body.limits,
      stackingPriority: body.stackingPriority ?? 0,
    };
  }

  private assertValid(definition: OfferDefinition): void {
    const result = validateOffer(definition);
    if (!result.ok) throw result.error instanceof ValidationError ? result.error : new ValidationError("Invalid offer");
  }
}
