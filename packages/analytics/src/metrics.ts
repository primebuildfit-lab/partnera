import { type TenantId } from "@partnera/core";

/**
 * Analytics foundation: a normalized metric-event stream plus definitions for
 * KPIs, funnels, reports, and dashboards. Aggregation logic here is intentionally
 * small and pure; a heavier BI/warehouse path is a future concern that consumes
 * the same event stream. See docs/02-architecture.md (Analytics Engine).
 */
export interface MetricEvent {
  readonly tenantId: TenantId;
  /** e.g. "click", "conversion", "commission.approved", "payout.completed". */
  readonly name: string;
  /** Optional numeric value (amount, count) associated with the event. */
  readonly value: number;
  readonly subjectId: string;
  readonly at: Date;
  readonly attributes: Readonly<Record<string, string>>;
}

export type KpiAggregation = "count" | "sum" | "unique_subjects";

export interface KpiDefinition {
  readonly key: string;
  readonly label: string;
  readonly eventName: string;
  readonly aggregation: KpiAggregation;
}

export interface ReportColumn {
  readonly key: string;
  readonly label: string;
  readonly kpiKey: string;
}

export interface ReportDefinition {
  readonly key: string;
  readonly title: string;
  readonly columns: readonly ReportColumn[];
  readonly groupBy: string | null;
}

export interface DashboardDefinition {
  readonly key: string;
  readonly title: string;
  readonly kpiKeys: readonly string[];
  readonly reportKeys: readonly string[];
}

export type ExportFormat = "csv" | "json";

export interface ExportRequest {
  readonly reportKey: string;
  readonly format: ExportFormat;
  readonly from: Date;
  readonly to: Date;
}

/** Compute a single KPI value from a window of events. */
export function computeKpi(kpi: KpiDefinition, events: readonly MetricEvent[]): number {
  const matching = events.filter((e) => e.name === kpi.eventName);
  switch (kpi.aggregation) {
    case "count":
      return matching.length;
    case "sum":
      return matching.reduce((acc, e) => acc + e.value, 0);
    case "unique_subjects":
      return new Set(matching.map((e) => e.subjectId)).size;
  }
}
