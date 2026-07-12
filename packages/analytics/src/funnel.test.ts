import { asId, type TenantId } from "@partnera/core";
import { describe, expect, it } from "vitest";
import { computeFunnel, type FunnelDefinition } from "./funnel";
import { computeKpi, type KpiDefinition, type MetricEvent } from "./metrics";

const tenantId = asId<TenantId>("biz_1");
const at = new Date("2026-06-01T00:00:00Z");
const ev = (name: string, subjectId: string, value = 1): MetricEvent => ({
  tenantId,
  name,
  value,
  subjectId,
  at,
  attributes: {},
});

describe("computeKpi", () => {
  it("counts, sums, and counts unique subjects", () => {
    const events = [ev("click", "a"), ev("click", "a"), ev("conversion", "a", 50)];
    const count: KpiDefinition = { key: "clicks", label: "Clicks", eventName: "click", aggregation: "count" };
    const sum: KpiDefinition = { key: "rev", label: "Revenue", eventName: "conversion", aggregation: "sum" };
    const uniq: KpiDefinition = {
      key: "u",
      label: "Unique clickers",
      eventName: "click",
      aggregation: "unique_subjects",
    };
    expect(computeKpi(count, events)).toBe(2);
    expect(computeKpi(sum, events)).toBe(50);
    expect(computeKpi(uniq, events)).toBe(1);
  });
});

describe("computeFunnel", () => {
  it("counts subjects reaching each ordered step with conversion rates", () => {
    const def: FunnelDefinition = {
      key: "acq",
      title: "Acquisition",
      steps: ["click", "conversion", "commission.approved"],
    };
    const events = [
      ev("click", "a"),
      ev("conversion", "a"),
      ev("commission.approved", "a"),
      ev("click", "b"),
      ev("conversion", "b"),
      ev("click", "c"),
    ];
    const result = computeFunnel(def, events);
    expect(result.map((r) => r.count)).toEqual([3, 2, 1]);
    expect(result[1]?.rateFromPrevious).toBeCloseTo(2 / 3);
  });
});
