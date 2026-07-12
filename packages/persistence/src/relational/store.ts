import { ConflictError, InvariantViolation } from "@partnera/core";

/**
 * A tiny in-memory relational store: the reference implementation of Partnera's
 * persistence seam. It is deliberately small but enforces the guarantees a real
 * database must provide and that the platform's invariants depend on:
 *
 *  - **Append-only tables** reject any update or delete (the commission ledger,
 *    payout events, audit log, click/refund streams).
 *  - **Unique constraints** back idempotency (one order per platform id, one
 *    commission-created per commission, one idempotency key per operation).
 *  - **Optimistic concurrency** via a per-row version guards lost updates on
 *    mutable aggregates (offers, memberships, fraud cases, notifications).
 *  - **Atomic transactions** snapshot every collection and roll back on error,
 *    so a multi-table operation never lands half-applied.
 *
 * Tenant isolation is enforced one layer up, in the repositories, which always
 * scope by the `TenantId` taken from the authenticated `RequestContext` (never
 * from a client-supplied value). A Postgres+Prisma driver implements the same
 * `Collection` surface without any repository or engine change (see
 * prisma/schema.prisma and sql/0001_init.sql).
 */

interface Versioned<Row> {
  readonly row: Row;
  readonly version: number;
}

export interface UniqueIndexDef<Row> {
  readonly name: string;
  /** Returns the unique key for a row, or null to skip indexing it. */
  readonly key: (row: Row) => string | null;
}

export interface CollectionOptions<Row> {
  readonly pk: (row: Row) => string;
  readonly appendOnly?: boolean;
  readonly unique?: readonly UniqueIndexDef<Row>[];
}

interface CollectionSnapshot {
  restore(): void;
}

/**
 * A typed table. Rows are treated as immutable values — an update replaces the
 * stored object rather than mutating it — which is what makes snapshot-based
 * rollback cheap and correct.
 */
export class Collection<Row> {
  private data = new Map<string, Versioned<Row>>();
  private readonly uniqueMaps = new Map<string, Map<string, string>>();

  constructor(
    readonly name: string,
    private readonly options: CollectionOptions<Row>,
  ) {
    for (const idx of options.unique ?? []) this.uniqueMaps.set(idx.name, new Map());
  }

  private pkOf(row: Row): string {
    return this.options.pk(row);
  }

  private uniqueViolation(row: Row, ignorePk: string | null): string | null {
    for (const idx of this.options.unique ?? []) {
      const key = idx.key(row);
      if (key === null) continue;
      const existingPk = this.uniqueMaps.get(idx.name)!.get(key);
      if (existingPk !== undefined && existingPk !== ignorePk) return idx.name;
    }
    return null;
  }

  private indexRow(pk: string, row: Row): void {
    for (const idx of this.options.unique ?? []) {
      const key = idx.key(row);
      if (key !== null) this.uniqueMaps.get(idx.name)!.set(key, pk);
    }
  }

  private deindexRow(row: Row): void {
    for (const idx of this.options.unique ?? []) {
      const key = idx.key(row);
      if (key !== null) this.uniqueMaps.get(idx.name)!.delete(key);
    }
  }

  /** Insert a new row. Throws on duplicate primary key or unique-index clash. */
  insert(row: Row): void {
    const pk = this.pkOf(row);
    if (this.data.has(pk)) {
      throw new ConflictError(`Duplicate primary key in ${this.name}`, { pk });
    }
    const violated = this.uniqueViolation(row, null);
    if (violated) {
      throw new ConflictError(`Unique constraint ${this.name}.${violated} violated`, { pk });
    }
    this.data.set(pk, { row, version: 1 });
    this.indexRow(pk, row);
  }

  /**
   * Idempotent insert: if a row with this primary key already exists, do nothing
   * and return false. Used for safe-to-retry appends (ledger, payout events).
   */
  insertIdempotent(row: Row): boolean {
    const pk = this.pkOf(row);
    if (this.data.has(pk)) return false;
    const violated = this.uniqueViolation(row, null);
    if (violated) {
      throw new ConflictError(`Unique constraint ${this.name}.${violated} violated`, { pk });
    }
    this.data.set(pk, { row, version: 1 });
    this.indexRow(pk, row);
    return true;
  }

  get(pk: string): Row | undefined {
    return this.data.get(pk)?.row;
  }

  getVersioned(pk: string): { row: Row; version: number } | undefined {
    return this.data.get(pk);
  }

  /**
   * Replace an existing row. On an append-only collection this always throws.
   * If `expectedVersion` is provided and does not match, throws a
   * {@link ConflictError} (optimistic-concurrency lost-update protection).
   */
  replace(row: Row, expectedVersion?: number): number {
    if (this.options.appendOnly) {
      throw new InvariantViolation(`Collection ${this.name} is append-only; cannot update`, {
        pk: this.pkOf(row),
      });
    }
    const pk = this.pkOf(row);
    const current = this.data.get(pk);
    if (!current) throw new InvariantViolation(`Cannot replace missing row in ${this.name}`, { pk });
    if (expectedVersion !== undefined && current.version !== expectedVersion) {
      throw new ConflictError(`Concurrent modification of ${this.name}`, {
        pk,
        expectedVersion,
        actualVersion: current.version,
      });
    }
    const violated = this.uniqueViolation(row, pk);
    if (violated) {
      throw new ConflictError(`Unique constraint ${this.name}.${violated} violated`, { pk });
    }
    this.deindexRow(current.row);
    const nextVersion = current.version + 1;
    this.data.set(pk, { row, version: nextVersion });
    this.indexRow(pk, row);
    return nextVersion;
  }

  /** Insert if absent, replace if present. Convenience for config-style upserts. */
  upsert(row: Row): void {
    const pk = this.pkOf(row);
    if (this.data.has(pk)) this.replace(row);
    else this.insert(row);
  }

  delete(pk: string): void {
    if (this.options.appendOnly) {
      throw new InvariantViolation(`Collection ${this.name} is append-only; cannot delete`, { pk });
    }
    const current = this.data.get(pk);
    if (current) this.deindexRow(current.row);
    this.data.delete(pk);
  }

  findByUnique(indexName: string, key: string): Row | undefined {
    const pk = this.uniqueMaps.get(indexName)?.get(key);
    return pk === undefined ? undefined : this.get(pk);
  }

  values(): Row[] {
    return [...this.data.values()].map((v) => v.row);
  }

  find(predicate: (row: Row) => boolean): Row[] {
    return this.values().filter(predicate);
  }

  count(): number {
    return this.data.size;
  }

  /** Export every row with its version, for durable snapshotting. */
  exportRows(): { row: Row; version: number }[] {
    return [...this.data.values()].map((v) => ({ row: v.row, version: v.version }));
  }

  /**
   * Load rows from a snapshot, replacing current contents and rebuilding indexes.
   * Bypasses the append-only guard (restoring a snapshot is not a mutation).
   */
  loadRows(entries: readonly { row: Row; version: number }[]): void {
    this.data = new Map();
    for (const map of this.uniqueMaps.values()) map.clear();
    for (const entry of entries) {
      const pk = this.pkOf(entry.row);
      this.data.set(pk, { row: entry.row, version: entry.version });
      this.indexRow(pk, entry.row);
    }
  }

  /** @internal Snapshot for transaction rollback. */
  snapshot(): CollectionSnapshot {
    const dataCopy = new Map(this.data);
    const uniqueCopies = new Map<string, Map<string, string>>();
    for (const [name, map] of this.uniqueMaps) uniqueCopies.set(name, new Map(map));
    return {
      restore: () => {
        this.data = dataCopy;
        for (const [name, map] of uniqueCopies) this.uniqueMaps.set(name, map);
      },
    };
  }
}

/**
 * The store owns every {@link Collection} and provides transactions across them.
 * One `RelationalStore` instance represents one logical database; repositories
 * are constructed over it (see {@link import("../unit-of-work").UnitOfWork}).
 */
export class RelationalStore {
  private readonly collections: Collection<unknown>[] = [];
  private inTransaction = false;

  define<Row>(name: string, options: CollectionOptions<Row>): Collection<Row> {
    const collection = new Collection<Row>(name, options);
    this.collections.push(collection as Collection<unknown>);
    return collection;
  }

  /**
   * Export the whole store as a plain object keyed by collection name. Combined
   * with a Date-aware (de)serializer (see snapshot.ts), this is the durable local
   * persistence for the desktop/dev runtime — no external database required.
   */
  exportAll(): Record<string, { row: unknown; version: number }[]> {
    const out: Record<string, { row: unknown; version: number }[]> = {};
    for (const collection of this.collections) out[collection.name] = collection.exportRows();
    return out;
  }

  /** Restore a previously exported snapshot into the (already-defined) collections. */
  importAll(data: Record<string, { row: unknown; version: number }[]>): void {
    for (const collection of this.collections) {
      const entries = data[collection.name];
      if (entries) collection.loadRows(entries as { row: unknown; version: number }[]);
    }
  }

  /**
   * Run `fn` atomically: every collection is snapshotted first and rolled back if
   * `fn` throws (sync or async), so a multi-table operation never half-applies.
   * Nested transactions reuse the outer one (no savepoints needed for our uses).
   */
  async transact<T>(fn: () => Promise<T> | T): Promise<T> {
    if (this.inTransaction) return await fn();
    const snapshots = this.collections.map((c) => c.snapshot());
    this.inTransaction = true;
    try {
      const result = await fn();
      this.inTransaction = false;
      return result;
    } catch (error) {
      for (const snap of snapshots) snap.restore();
      this.inTransaction = false;
      throw error;
    }
  }
}
