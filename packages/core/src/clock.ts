/**
 * Time is injected, never read directly from `Date.now()` inside engines. This
 * keeps commission maturation windows, campaign schedules, and fraud velocity
 * checks deterministically testable.
 */
export interface Clock {
  now(): Date;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Deterministic clock for tests; time only advances when told to. */
export class FixedClock implements Clock {
  private current: Date;

  constructor(start: Date | string | number = "2026-01-01T00:00:00.000Z") {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current);
  }

  advanceMs(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }

  set(to: Date | string | number): void {
    this.current = new Date(to);
  }
}
