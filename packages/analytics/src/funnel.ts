import { type MetricEvent } from "./metrics";

/**
 * Funnel analysis: given ordered steps (event names) and an event stream, count
 * how many subjects reached each step in order and the step-to-step conversion
 * rate. A subject only counts for step N if it also reached steps 1..N-1.
 */
export interface FunnelDefinition {
  readonly key: string;
  readonly title: string;
  readonly steps: readonly string[];
}

export interface FunnelStepResult {
  readonly step: string;
  readonly count: number;
  /** Conversion from the previous step (1 for the first step). */
  readonly rateFromPrevious: number;
}

export function computeFunnel(
  definition: FunnelDefinition,
  events: readonly MetricEvent[],
): FunnelStepResult[] {
  // subjects that performed each step (regardless of order)
  const bySubject = new Map<string, Set<string>>();
  for (const event of events) {
    const set = bySubject.get(event.subjectId) ?? new Set<string>();
    set.add(event.name);
    bySubject.set(event.subjectId, set);
  }

  const results: FunnelStepResult[] = [];
  let previousCount = 0;
  definition.steps.forEach((step, index) => {
    const required = definition.steps.slice(0, index + 1);
    let count = 0;
    for (const performed of bySubject.values()) {
      if (required.every((s) => performed.has(s))) count += 1;
    }
    const rateFromPrevious = index === 0 ? 1 : previousCount === 0 ? 0 : count / previousCount;
    results.push({ step, count, rateFromPrevious });
    previousCount = count;
  });

  return results;
}
