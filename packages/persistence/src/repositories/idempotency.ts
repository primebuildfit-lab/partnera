import { type Collection } from "../relational/store";

/**
 * A recorded idempotency key. Money-affecting operations (order ingestion,
 * conversion recording, payout requests) record a key on first execution; a
 * retry with the same key is recognized and the original result reused, giving
 * the at-most-once guarantee the money invariants require (D-010).
 */
export interface IdempotencyRow {
  /** Operation namespace, e.g. "ingest_order", so keys never collide across ops. */
  readonly scope: string;
  readonly key: string;
  /** Opaque reference to the result produced on first execution. */
  readonly resultRef: string;
  readonly createdAt: Date;
}

const idemPk = (scope: string, key: string): string => `${scope}::${key}`;

export class IdempotencyRepository {
  constructor(private readonly rows: Collection<IdempotencyRow>) {}

  /**
   * Record a first execution, or return the prior result reference if this
   * (scope, key) was already seen. `firstSeen` is true only on the first call.
   */
  remember(scope: string, key: string, resultRef: string, now: Date): { firstSeen: boolean; resultRef: string } {
    const existing = this.rows.get(idemPk(scope, key));
    if (existing) return { firstSeen: false, resultRef: existing.resultRef };
    this.rows.insert({ scope, key, resultRef, createdAt: now });
    return { firstSeen: true, resultRef };
  }

  lookup(scope: string, key: string): IdempotencyRow | undefined {
    return this.rows.get(idemPk(scope, key));
  }
}
