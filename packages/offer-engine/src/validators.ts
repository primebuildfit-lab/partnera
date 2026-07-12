import { err, isSupportedCurrency, ok, type Result, ValidationError } from "@partnera/core";
import { type CalculationBlock, type LimitBlock, type MoneyLiteral } from "./blocks";
import { type OfferDefinition } from "./offer";

const MAX_BASIS_POINTS = 1_000_000; // 10,000% — a sanity ceiling, not a business rule.
const MAX_LEVEL_DEPTH = 10;

function checkMoney(literal: MoneyLiteral, label: string): string | null {
  if (!isSupportedCurrency(literal.currency.toUpperCase())) {
    return `${label}: unsupported currency ${literal.currency}`;
  }
  try {
    if (BigInt(literal.minorUnits) < 0n) return `${label}: amount must not be negative`;
  } catch {
    return `${label}: invalid minorUnits ${literal.minorUnits}`;
  }
  return null;
}

function checkCalculation(calc: CalculationBlock): string[] {
  const issues: string[] = [];
  switch (calc.kind) {
    case "percentage":
      if (!Number.isInteger(calc.basisPoints) || calc.basisPoints < 0 || calc.basisPoints > MAX_BASIS_POINTS) {
        issues.push("percentage.basisPoints must be an integer in [0, 1_000_000]");
      }
      break;
    case "fixed": {
      const m = checkMoney(calc.amount, "fixed.amount");
      if (m) issues.push(m);
      break;
    }
    case "per_unit": {
      const m = checkMoney(calc.amount, "per_unit.amount");
      if (m) issues.push(m);
      break;
    }
    case "tiered":
      if (calc.tiers.length === 0) issues.push("tiered.tiers must not be empty");
      calc.tiers.forEach((t, i) => {
        const m = checkMoney(t.threshold, `tiered.tiers[${i}].threshold`);
        if (m) issues.push(m);
        if (t.basisPoints < 0 || t.basisPoints > MAX_BASIS_POINTS) {
          issues.push(`tiered.tiers[${i}].basisPoints out of range`);
        }
      });
      break;
    case "level":
      if (calc.maxDepth < 1 || calc.maxDepth > MAX_LEVEL_DEPTH) {
        issues.push(`level.maxDepth must be in [1, ${MAX_LEVEL_DEPTH}] to bound referral chains`);
      }
      break;
    case "bonus":
      if (calc.targetCount < 1) issues.push("bonus.targetCount must be >= 1");
      break;
  }
  return issues;
}

function checkLimit(limit: LimitBlock, index: number): string[] {
  const issues: string[] = [];
  switch (limit.kind) {
    case "max_per_conversion":
    case "max_per_affiliate_period":
    case "budget": {
      const m = checkMoney(limit.amount, `limits[${index}].amount`);
      if (m) issues.push(m);
      break;
    }
    case "clawback_window":
      if (limit.days < 0) issues.push(`limits[${index}].days must be >= 0`);
      break;
  }
  return issues;
}

/** Collect every validation issue (for surfacing in an Offer Builder UI). */
export function validateOfferIssues(offer: OfferDefinition): string[] {
  const issues = [
    ...checkCalculation(offer.calculation),
    ...offer.limits.flatMap((l, i) => checkLimit(l, i)),
  ];
  if (offer.reward.kind === "points" && offer.reward.multiplier < 0) {
    issues.push("reward.points.multiplier must be >= 0");
  }
  if (offer.reward.kind === "hybrid" && (offer.reward.cashBasisPoints < 0 || offer.reward.cashBasisPoints > 10000)) {
    issues.push("reward.hybrid.cashBasisPoints must be in [0, 10000]");
  }
  return issues;
}

/** Validate an offer; the first issue becomes the error (deny activation). */
export function validateOffer(offer: OfferDefinition): Result<OfferDefinition, ValidationError> {
  const issues = validateOfferIssues(offer);
  if (issues.length > 0) {
    return err(new ValidationError("Offer is invalid", { issues }));
  }
  return ok(offer);
}
