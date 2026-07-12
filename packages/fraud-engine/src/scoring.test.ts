import { describe, expect, it } from "vitest";
import { scoreSignals } from "./scoring";
import { DEFAULT_FRAUD_CONFIG, type RiskSignal } from "./signals";

const now = new Date("2026-06-01T00:00:00Z");
const signal = (type: RiskSignal["type"], strength = 1): RiskSignal => ({
  type,
  strength,
  detail: "test",
  observedAt: now,
});

describe("scoreSignals", () => {
  it("scores no signals as low/allow", () => {
    const score = scoreSignals("affiliate", "a1", [], DEFAULT_FRAUD_CONFIG, now);
    expect(score.band).toBe("low");
    expect(score.action).toBe("allow");
    expect(score.score).toBe(0);
  });

  it("aggregates weighted signals into a high band → block", () => {
    const score = scoreSignals(
      "conversion",
      "c1",
      [signal("referral_loop"), signal("coupon_abuse")],
      DEFAULT_FRAUD_CONFIG,
      now,
    );
    expect(score.score).toBe(80);
    expect(score.band).toBe("high");
    expect(score.action).toBe("block");
    expect(score.contributing).toContain("referral_loop");
  });

  it("caps the score at 100", () => {
    const score = scoreSignals(
      "account",
      "acc1",
      [signal("chargeback"), signal("self_purchase"), signal("referral_loop")],
      DEFAULT_FRAUD_CONFIG,
      now,
    );
    expect(score.score).toBe(100);
  });

  it("applies the hard floor: a self_purchase forces review even at low score", () => {
    const score = scoreSignals(
      "affiliate",
      "a2",
      [signal("self_purchase", 0.1)], // 6 points → low band
      DEFAULT_FRAUD_CONFIG,
      now,
    );
    expect(score.band).toBe("low");
    expect(score.action).toBe("review");
  });
});
