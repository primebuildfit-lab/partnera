import { asId, type TenantId } from "@partnera/core";
import { describe, expect, it } from "vitest";
import { evaluateFlag, type FeatureFlag } from "./feature-flags";

const tenantId = asId<TenantId>("biz_1");

describe("evaluateFlag", () => {
  it("returns the default when no rule matches", () => {
    const flag: FeatureFlag = { key: "partnerships", description: "", defaultEnabled: false, rules: [] };
    expect(evaluateFlag(flag, { tenantId, planKey: "starter" })).toBe(false);
  });

  it("enables by plan", () => {
    const flag: FeatureFlag = {
      key: "marketplace",
      description: "",
      defaultEnabled: false,
      rules: [{ kind: "plan", plans: ["growth", "enterprise"], enabled: true }],
    };
    expect(evaluateFlag(flag, { tenantId, planKey: "growth" })).toBe(true);
    expect(evaluateFlag(flag, { tenantId, planKey: "starter" })).toBe(false);
  });

  it("first matching rule wins (tenant override before plan)", () => {
    const flag: FeatureFlag = {
      key: "beta",
      description: "",
      defaultEnabled: false,
      rules: [
        { kind: "tenant", tenantIds: [tenantId], enabled: true },
        { kind: "plan", plans: ["starter"], enabled: false },
      ],
    };
    expect(evaluateFlag(flag, { tenantId, planKey: "starter" })).toBe(true);
  });

  it("rollout membership is stable for a given tenant", () => {
    const flag: FeatureFlag = {
      key: "new-ui",
      description: "",
      defaultEnabled: false,
      rules: [{ kind: "rollout", percentage: 100, enabled: true }],
    };
    expect(evaluateFlag(flag, { tenantId, planKey: "starter" })).toBe(true);
    const none: FeatureFlag = { ...flag, rules: [{ kind: "rollout", percentage: 0, enabled: true }] };
    expect(evaluateFlag(none, { tenantId, planKey: "starter" })).toBe(false);
  });
});
