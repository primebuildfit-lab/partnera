import { err, Money, ok, type Result, ValidationError } from "@partnera/core";
import {
  type CalculationBlock,
  type ConditionBlock,
  type LimitBlock,
  type MoneyLiteral,
  type ScheduleBlock,
  type ScopeBlock,
} from "./blocks";
import { type CommissionInstruction, type EvaluationContext, type OrderSnapshot } from "./context";
import { type OfferDefinition } from "./offer";

function toMoney(literal: MoneyLiteral): Money {
  return Money.ofMinor(BigInt(literal.minorUnits), literal.currency);
}

/**
 * Reference offer evaluator: given an active offer and one conversion, produce a
 * {@link CommissionInstruction} or `null` (offer does not apply). Deterministic
 * and side-effect-free — the same inputs always yield the same output, and every
 * result is explained through `reasonPath`.
 *
 * Stateful calculations (level, bonus) and period/budget limits require
 * aggregate state beyond a single conversion; they are recognized by the model
 * but delegated to specialized evaluators wired in a later module. Here they
 * return an explicit error rather than a silent wrong number.
 */
export class OfferEvaluator {
  evaluate(
    offer: OfferDefinition,
    ctx: EvaluationContext,
  ): Result<CommissionInstruction | null, ValidationError> {
    const reason: string[] = [`offer:${offer.id}@v${offer.version}`];

    if (offer.status !== "active") return ok(null);
    if (!scheduleActive(offer.schedule, ctx.now)) return ok(null);
    if (!withinOrderValueScope(offer.scope, ctx.order)) return ok(null);
    if (!conditionsPass(offer.conditions, ctx, reason)) return ok(null);

    const base = eligibleBase(offer.scope, ctx.order);
    reason.push(`base:${base.toDecimalString()}${base.currency}`);

    const calc = calculate(offer.calculation, base, ctx.order, reason);
    if (!calc.ok) return calc;
    if (calc.value === null || calc.value.isZero) return ok(null);

    const capped = applyPerConversionCap(offer.limits, calc.value, reason);
    reason.push(`reward:${offer.reward.kind}`);

    return ok({
      offerId: offer.id,
      offerVersion: offer.version,
      affiliateId: ctx.attribution.affiliateId,
      conversionId: ctx.conversionId,
      amount: capped,
      rewardKind: offer.reward.kind,
      reasonPath: reason,
    });
  }
}

function scheduleActive(schedule: ScheduleBlock, now: Date): boolean {
  switch (schedule.kind) {
    case "always":
      return true;
    case "window":
      return now >= new Date(schedule.startsAt) && now <= new Date(schedule.endsAt);
    case "recurring":
      // Recurrence eligibility is time-based; a single conversion is "in" an
      // active recurring offer unless bounded windows are added later.
      return true;
  }
}

function withinOrderValueScope(scope: readonly ScopeBlock[], order: OrderSnapshot): boolean {
  for (const block of scope) {
    if (block.kind !== "order_value") continue;
    if (block.min && order.total.compare(toMoney(block.min)) < 0) return false;
    if (block.max && order.total.compare(toMoney(block.max)) > 0) return false;
  }
  return true;
}

function isItemScope(block: ScopeBlock): boolean {
  return (
    block.kind === "product" ||
    block.kind === "collection" ||
    block.kind === "category" ||
    block.kind === "brand"
  );
}

function lineMatchesScope(
  line: OrderSnapshot["lines"][number],
  block: ScopeBlock,
): boolean {
  switch (block.kind) {
    case "product":
      return block.productIds.includes(line.productId);
    case "collection":
      return line.collectionIds.some((c) => block.collectionIds.includes(c));
    case "category":
      return line.categories.some((c) => block.categories.includes(c));
    case "brand":
      return line.brand !== null && block.brands.includes(line.brand);
    case "all":
    case "order_value":
      return false;
  }
}

function matchingLines(
  scope: readonly ScopeBlock[],
  order: OrderSnapshot,
): readonly OrderSnapshot["lines"][number][] {
  const itemBlocks = scope.filter(isItemScope);
  if (scope.some((b) => b.kind === "all") || itemBlocks.length === 0) {
    return order.lines;
  }
  return order.lines.filter((line) => itemBlocks.some((b) => lineMatchesScope(line, b)));
}

function eligibleBase(scope: readonly ScopeBlock[], order: OrderSnapshot): Money {
  const itemBlocks = scope.filter(isItemScope);
  if (scope.some((b) => b.kind === "all") || itemBlocks.length === 0) {
    return order.total;
  }
  return matchingLines(scope, order).reduce(
    (acc, line) => acc.add(line.lineSubtotal),
    Money.zero(order.total.currency),
  );
}

function conditionsPass(
  conditions: readonly ConditionBlock[],
  ctx: EvaluationContext,
  reason: string[],
): boolean {
  for (const condition of conditions) {
    if (!conditionPasses(condition, ctx)) {
      reason.push(`condition_failed:${condition.kind}`);
      return false;
    }
  }
  return true;
}

function conditionPasses(condition: ConditionBlock, ctx: EvaluationContext): boolean {
  switch (condition.kind) {
    case "attribution":
      return condition.via.includes(ctx.attribution.basis);
    case "affiliate_tier":
      return (
        ctx.attribution.affiliateTier !== null &&
        condition.tiers.includes(ctx.attribution.affiliateTier)
      );
    case "customer_type":
      return ctx.order.customerType === condition.customerType;
    case "min_order_value":
      return ctx.order.total.compare(toMoney(condition.amount)) >= 0;
    case "campaign":
      return ctx.attribution.campaignId === condition.campaignId;
    case "date_window": {
      if (condition.startsAt && ctx.now < new Date(condition.startsAt)) return false;
      if (condition.endsAt && ctx.now > new Date(condition.endsAt)) return false;
      return true;
    }
  }
}

function calculate(
  calc: CalculationBlock,
  base: Money,
  order: OrderSnapshot,
  reason: string[],
): Result<Money | null, ValidationError> {
  switch (calc.kind) {
    case "percentage":
      reason.push(`calc:percentage:${calc.basisPoints}bps`);
      return ok(base.applyBasisPoints(calc.basisPoints));
    case "fixed": {
      const amount = toMoney(calc.amount);
      if (amount.currency !== order.total.currency) {
        return err(new ValidationError("Fixed reward currency does not match order currency"));
      }
      reason.push(`calc:fixed:${amount.toDecimalString()}`);
      return ok(amount);
    }
    case "per_unit": {
      const amount = toMoney(calc.amount);
      if (amount.currency !== order.total.currency) {
        return err(new ValidationError("Per-unit reward currency does not match order currency"));
      }
      const qty = order.lines.reduce((n, l) => n + l.quantity, 0);
      reason.push(`calc:per_unit:${qty}`);
      return ok(amount.multiplyByInt(qty));
    }
    case "tiered": {
      const sorted = [...calc.tiers].sort((a, b) =>
        toMoney(a.threshold).compare(toMoney(b.threshold)),
      );
      let chosen: number | null = null;
      for (const tier of sorted) {
        if (order.total.compare(toMoney(tier.threshold)) >= 0) chosen = tier.basisPoints;
      }
      if (chosen === null) return ok(null);
      reason.push(`calc:tiered:${chosen}bps`);
      return ok(base.applyBasisPoints(chosen));
    }
    case "level":
    case "bonus":
      return err(
        new ValidationError(
          `Calculation kind "${calc.kind}" requires aggregate state and a specialized evaluator`,
          { calculationKind: calc.kind },
        ),
      );
  }
}

function applyPerConversionCap(limits: readonly LimitBlock[], amount: Money, reason: string[]): Money {
  let result = amount;
  for (const limit of limits) {
    if (limit.kind !== "max_per_conversion") continue;
    const cap = toMoney(limit.amount);
    if (cap.currency === result.currency && result.compare(cap) > 0) {
      reason.push(`capped:${cap.toDecimalString()}`);
      result = cap;
    }
  }
  return result;
}
