import { asId, type BusinessId, type TenantId, Money } from "@partnera/core";
import { describe, expect, it } from "vitest";
import { mockTwoScoreReview } from "./ai";
import {
  type EvaluationScheme,
  type EvaluationSchemeId,
  type CreatorProgramId,
  type ProgramBudget,
  type ProgramCapacity,
  capacityGate,
  categoryForScore,
  computeExposure,
  defaultSchemeCategories,
  makeCategory,
  paymentForCategory,
  validateScheme,
} from "./programs";

const scheme = (categories = pbCategories()): EvaluationScheme => ({
  id: asId<EvaluationSchemeId>("scheme_1"),
  tenantId: asId<TenantId>("biz_1"),
  businessId: asId<BusinessId>("biz_1"),
  programId: asId<CreatorProgramId>("prog_1"),
  name: "PrimeBuild",
  categories,
  updatedAt: new Date("2026-07-12T00:00:00Z"),
});

// PrimeBuild's OWN provisional config — not a global constant.
function pbCategories() {
  return [
    makeCategory({ key: "rejected", name: "Rejected", order: 1, minScore: 0, maxScore: 39, paymentMinor: "0", payable: false, libraryEligible: true, affiliateEligible: false }),
    makeCategory({ key: "acceptable", name: "Acceptable", order: 2, minScore: 40, maxScore: 64, paymentMinor: "1000", libraryEligible: true }),
    makeCategory({ key: "good", name: "Good", order: 3, minScore: 65, maxScore: 84, paymentMinor: "2000", affiliateEligible: true }),
    makeCategory({ key: "excellent", name: "Excellent", order: 4, minScore: 85, maxScore: 100, paymentMinor: "3500", affiliateEligible: true }),
  ];
}

describe("evaluation scheme — business-owned categories & payments", () => {
  it("maps a confirmed category to the business's configured payment (not AI)", () => {
    const s = scheme();
    expect(Money.fromJSON(paymentForCategory(s, "excellent").amount!).toDecimalString()).toBe("35.00");
    expect(Money.fromJSON(paymentForCategory(s, "good").amount!).toDecimalString()).toBe("20.00");
    expect(paymentForCategory(s, "rejected").payable).toBe(false);
  });

  it("supports arbitrary category labels — not PrimeBuild's globally", () => {
    const bronzeSilver = scheme([
      makeCategory({ key: "bronze", name: "Bronze", order: 1, minScore: 0, maxScore: 50, paymentMinor: "500" }),
      makeCategory({ key: "premium", name: "Premium", order: 2, minScore: 51, maxScore: 100, paymentMinor: "9000" }),
    ]);
    expect(validateScheme(bronzeSilver).ok).toBe(true);
    expect(Money.fromJSON(paymentForCategory(bronzeSilver, "premium").amount!).toDecimalString()).toBe("90.00");
  });

  it("supports a single-category scheme (four categories are never required)", () => {
    const single = scheme(defaultSchemeCategories());
    expect(single.categories).toHaveLength(1);
    expect(validateScheme(single).ok).toBe(true);
  });

  it("rejects an empty scheme, duplicate keys, bad bands, negative payment", () => {
    expect(validateScheme(scheme([])).ok).toBe(false);
    expect(validateScheme(scheme([makeCategory({ key: "a", name: "A", order: 1 }), makeCategory({ key: "a", name: "B", order: 2 })])).ok).toBe(false);
    expect(validateScheme(scheme([makeCategory({ key: "a", name: "A", order: 1, minScore: 80, maxScore: 20 })])).ok).toBe(false);
  });

  it("recommends a category from a score band", () => {
    const s = scheme();
    expect(categoryForScore(s, 90)?.key).toBe("excellent");
    expect(categoryForScore(s, 70)?.key).toBe("good");
    expect(categoryForScore(s, 10)?.key).toBe("rejected");
  });
});

describe("capacity & budget gates — over-limit content waits, never auto-rejected", () => {
  const capacity: ProgramCapacity = { programId: asId<CreatorProgramId>("prog_1"), tenantId: asId<TenantId>("biz_1"), maxAccepted: 2, pauseWhenReached: true };

  it("enters waiting_for_capacity when accepted limit is reached", () => {
    const gate = capacityGate(capacity, { accepted: 2, paid: 0, active: 0, perOpportunity: 0, perCreator: 0 }, 100000n, 3500n);
    expect(gate.state).toBe("waiting_for_capacity");
  });

  it("enters waiting_for_budget when the next payment exceeds remaining budget", () => {
    const gate = capacityGate(null, { accepted: 0, paid: 0, active: 0, perOpportunity: 0, perCreator: 0 }, 1000n, 3500n);
    expect(gate.state).toBe("waiting_for_budget");
  });

  it("passes to under_review when within limits and budget", () => {
    const gate = capacityGate(capacity, { accepted: 0, paid: 0, active: 0, perOpportunity: 0, perCreator: 0 }, 100000n, 3500n);
    expect(gate.state).toBe("under_review");
  });

  it("computes exposure and remaining budget", () => {
    const budget: ProgramBudget = { programId: asId<CreatorProgramId>("prog_1"), tenantId: asId<TenantId>("biz_1"), currency: "USD", totalMinor: "50000", reservedMinor: "5000" };
    const e = computeExposure(budget, 10000n, 20000n, 300);
    expect(Money.fromJSON(e.remaining).toDecimalString()).toBe("150.00"); // 500 - 50 - 100 - 200
    expect(Money.fromJSON(e.projectedFee).toDecimalString()).toBe("9.00"); // 3% of (100+200)
    expect(Money.fromJSON(e.projectedTotalCost).toDecimalString()).toBe("309.00");
  });
});

describe("AI two-score recommendation — advisory, never sets payment", () => {
  it("returns technical + commercial scores and never authorizes payment", () => {
    const r = mockTwoScoreReview({
      submissionVersionId: "v1",
      objective: { widthPx: 1080, heightPx: 1920, durationSec: 30, hasAudio: true, hasCta: true, language: "en" },
      requirement: { minWidthPx: 1080, minHeightPx: 1920, requiresAudio: true, requiresCta: true, language: "en" },
      commercial: { hasHook: true, brandMentioned: true, noteLength: 40 },
    });
    expect(r.technicalScore).toBe(100);
    expect(r.commercialScore).toBeGreaterThan(60);
    expect(r.authorizesPayment).toBe(false);
    expect(r.isMock).toBe(true);
    expect(r.strengths.length).toBeGreaterThan(0);
  });
});
