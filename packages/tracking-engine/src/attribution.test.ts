import { asId, type AffiliateId } from "@partnera/core";
import { describe, expect, it } from "vitest";
import {
  type AttributionClaim,
  DEFAULT_ATTRIBUTION_POLICY,
  DefaultAttributionResolver,
} from "./attribution";

const resolver = new DefaultAttributionResolver();
const aff = (n: string) => asId<AffiliateId>(n);

describe("DefaultAttributionResolver", () => {
  const conversionAt = new Date("2026-06-30T00:00:00Z");

  it("returns null when no claim falls within the window", () => {
    const claims: AttributionClaim[] = [
      { basis: "link", affiliateId: aff("a1"), campaignId: null, touchedAt: new Date("2026-01-01T00:00:00Z") },
    ];
    expect(resolver.resolve(claims, conversionAt, DEFAULT_ATTRIBUTION_POLICY)).toBeNull();
  });

  it("credits the last touch by default", () => {
    const claims: AttributionClaim[] = [
      { basis: "link", affiliateId: aff("a1"), campaignId: null, touchedAt: new Date("2026-06-10T00:00:00Z") },
      { basis: "link", affiliateId: aff("a2"), campaignId: null, touchedAt: new Date("2026-06-20T00:00:00Z") },
    ];
    const result = resolver.resolve(claims, conversionAt, DEFAULT_ATTRIBUTION_POLICY);
    expect(result?.affiliateId).toBe(aff("a2"));
    expect(result?.reason).toBe("last_touch:link");
  });

  it("breaks same-timestamp ties by precedence (coupon over link)", () => {
    const t = new Date("2026-06-25T00:00:00Z");
    const claims: AttributionClaim[] = [
      { basis: "link", affiliateId: aff("a1"), campaignId: null, touchedAt: t },
      { basis: "coupon", affiliateId: aff("a2"), campaignId: null, touchedAt: t },
    ];
    const result = resolver.resolve(claims, conversionAt, DEFAULT_ATTRIBUTION_POLICY);
    expect(result?.basis).toBe("coupon");
    expect(result?.affiliateId).toBe(aff("a2"));
  });

  it("supports first-touch when configured", () => {
    const claims: AttributionClaim[] = [
      { basis: "link", affiliateId: aff("a1"), campaignId: null, touchedAt: new Date("2026-06-10T00:00:00Z") },
      { basis: "link", affiliateId: aff("a2"), campaignId: null, touchedAt: new Date("2026-06-20T00:00:00Z") },
    ];
    const result = resolver.resolve(claims, conversionAt, {
      ...DEFAULT_ATTRIBUTION_POLICY,
      model: "first_touch",
    });
    expect(result?.affiliateId).toBe(aff("a1"));
  });
});
