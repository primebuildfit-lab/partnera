import {
  asId,
  type AffiliateId,
  type ConversionId,
  Money,
  type OfferId,
  type OrderId,
  type ProgramId,
  type TenantId,
} from "@partnera/core";
import { describe, expect, it } from "vitest";
import { type EvaluationContext } from "./context";
import { OfferEvaluator } from "./evaluator";
import { type OfferDefinition } from "./offer";

const evaluator = new OfferEvaluator();
const tenantId = asId<TenantId>("biz_1");

function baseOffer(partial: Partial<OfferDefinition>): OfferDefinition {
  return {
    id: asId<OfferId>("offer_1"),
    tenantId,
    programId: asId<ProgramId>("prog_1"),
    version: 1,
    name: "Test offer",
    status: "active",
    scope: [{ kind: "all" }],
    conditions: [{ kind: "attribution", via: ["link", "coupon"] }],
    calculation: { kind: "percentage", basisPoints: 1000 },
    reward: { kind: "cash" },
    schedule: { kind: "always" },
    limits: [],
    stackingPriority: 0,
    ...partial,
  };
}

function context(partial?: Partial<EvaluationContext>): EvaluationContext {
  return {
    conversionId: asId<ConversionId>("conv_1"),
    now: new Date("2026-06-01T00:00:00Z"),
    attribution: {
      basis: "link",
      affiliateId: asId<AffiliateId>("aff_1"),
      affiliateTier: "gold",
      campaignId: null,
    },
    order: {
      id: asId<OrderId>("order_1"),
      tenantId,
      total: Money.parse("100.00", "USD"),
      customerType: "new",
      lines: [
        {
          productId: "sku_a",
          collectionIds: ["summer"],
          categories: ["apparel"],
          brand: "acme",
          quantity: 2,
          unitAmount: Money.parse("25.00", "USD"),
          lineSubtotal: Money.parse("50.00", "USD"),
        },
        {
          productId: "sku_b",
          collectionIds: [],
          categories: ["gadgets"],
          brand: "other",
          quantity: 1,
          unitAmount: Money.parse("50.00", "USD"),
          lineSubtotal: Money.parse("50.00", "USD"),
        },
      ],
    },
    ...partial,
  };
}

describe("OfferEvaluator", () => {
  it("computes a percentage of the whole order for scope=all", () => {
    const result = evaluator.evaluate(baseOffer({}), context());
    expect(result.ok).toBe(true);
    if (!result.ok || result.value === null) throw new Error("expected instruction");
    expect(result.value.amount.toDecimalString()).toBe("10.00");
    expect(result.value.rewardKind).toBe("cash");
    expect(result.value.reasonPath).toContain("calc:percentage:1000bps");
  });

  it("scopes the base to matching product lines only", () => {
    const offer = baseOffer({ scope: [{ kind: "product", productIds: ["sku_a"] }] });
    const result = evaluator.evaluate(offer, context());
    expect(result.ok).toBe(true);
    if (!result.ok || result.value === null) throw new Error("expected instruction");
    // 10% of the $50.00 sku_a line = $5.00
    expect(result.value.amount.toDecimalString()).toBe("5.00");
  });

  it("returns null when a condition fails (wrong attribution basis)", () => {
    const offer = baseOffer({ conditions: [{ kind: "attribution", via: ["coupon"] }] });
    const result = evaluator.evaluate(offer, context());
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.value).toBeNull();
  });

  it("applies a per-conversion cap", () => {
    const offer = baseOffer({
      limits: [{ kind: "max_per_conversion", amount: { currency: "USD", minorUnits: "700" } }],
    });
    const result = evaluator.evaluate(offer, context());
    if (!result.ok || result.value === null) throw new Error("expected instruction");
    expect(result.value.amount.toDecimalString()).toBe("7.00");
    expect(result.value.reasonPath.some((r) => r.startsWith("capped:"))).toBe(true);
  });

  it("does not apply when the offer is outside its schedule window", () => {
    const offer = baseOffer({
      schedule: { kind: "window", startsAt: "2026-07-01T00:00:00Z", endsAt: "2026-07-31T00:00:00Z" },
    });
    const result = evaluator.evaluate(offer, context());
    if (!result.ok) throw new Error("expected ok");
    expect(result.value).toBeNull();
  });

  it("rejects stateful calculations that need a specialized evaluator", () => {
    const offer = baseOffer({ calculation: { kind: "level", perLevelBasisPoints: [500, 200], maxDepth: 2 } });
    const result = evaluator.evaluate(offer, context());
    expect(result.ok).toBe(false);
  });
});
