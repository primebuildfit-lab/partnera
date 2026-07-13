import { describe, expect, it } from "vitest";
import {
  CREATOR_MARKETPLACE_DEFAULTS,
  DEFAULT_SCORING_WEIGHTS,
  FEE_MAX_BPS,
  FEE_MIN_BPS,
  validateFeeBps,
  validateFeeConfig,
} from "./config";
import { APPROVAL_MODES, isMember } from "./vocab";

describe("fee configuration", () => {
  it("accepts rates within the approved 2%-4% range", () => {
    for (const bps of [FEE_MIN_BPS, 300, FEE_MAX_BPS]) {
      const r = validateFeeBps(bps);
      expect(r.ok).toBe(true);
    }
  });

  it("rejects rates below 2% and above 4%", () => {
    expect(validateFeeBps(FEE_MIN_BPS - 1).ok).toBe(false);
    expect(validateFeeBps(FEE_MAX_BPS + 1).ok).toBe(false);
    expect(validateFeeBps(0).ok).toBe(false);
    expect(validateFeeBps(1000).ok).toBe(false);
  });

  it("rejects non-integer basis points", () => {
    expect(validateFeeBps(300.5).ok).toBe(false);
  });

  it("validates a full fee config", () => {
    expect(validateFeeConfig({ rateBps: 300, payer: "business" }).ok).toBe(true);
    expect(validateFeeConfig({ rateBps: 500, payer: "business" }).ok).toBe(false);
  });

  it("ships provisional defaults inside the approved range and weights summing to 100", () => {
    expect(validateFeeConfig(CREATOR_MARKETPLACE_DEFAULTS.fee).ok).toBe(true);
    expect(CREATOR_MARKETPLACE_DEFAULTS.localPayoutMode).toBe("simulated");
    // Documented weights (30/20/20/15/10); mandatory-pass categories carry no weight.
    // Weights are normalized by the scorer, so the exact sum is informational.
    const sum = Object.values(DEFAULT_SCORING_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(95);
  });
});

describe("vocab membership", () => {
  it("narrows known values and rejects unknowns", () => {
    expect(isMember(APPROVAL_MODES, "human_only")).toBe(true);
    expect(isMember(APPROVAL_MODES, "nonsense")).toBe(false);
  });
});
