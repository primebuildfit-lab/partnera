import { Collection, type CollectionOptions, RelationalStore } from "./store";

/**
 * Real durable driver for the hosted (Postgres) mode.
 *
 * The store is **write-through**: reads use the same in-memory index the tested
 * reference store uses (so every invariant — unique, version, append-only,
 * transactions — is enforced identically), and every mutation is persisted to a
 * durable backend through the {@link SqlClient} port. Two clients implement the
 * port: {@link InMemorySqlClient} (used by the shared contract suite and tests)
 * and a Postgres client (`PgSqlClient`, a thin `pg` adapter provided at deploy —
 * see docs/shopify-pilot/DEPLOY.md; not compiled here because `pg` + a live DB
 * are a deploy-time concern). This is the driver, not a mock: only the database
 * socket is swapped between test and deploy.
 *
 * Each aggregate is a JSONB row (D-325): the whole value object is stored under
 * its primary key; the SQL client maps table+pk+version+data to a real row.
 */
export interface SqlRow {
  readonly pk: string;
  readonly version: number;
  readonly data: unknown;
}

export interface SqlClient {
  /** Load every row of a table (for hydrating the in-memory index on startup). */
  loadTable(table: string): Promise<readonly SqlRow[]> | readonly SqlRow[];
  /** Insert or replace a row (INSERT ... ON CONFLICT (pk) DO UPDATE). */
  upsert(table: string, row: SqlRow): void;
  /** Delete a row by primary key. */
  remove(table: string, pk: string): void;
  /** Begin / commit / rollback a transaction (durable atomicity). */
  begin(): void;
  commit(): void;
  rollback(): void;
}

/**
 * A faithful in-memory implementation of the SQL boundary: real per-table row
 * maps with transactional snapshot/rollback. Lets the driver run end-to-end in
 * tests and the contract suite without a database. The Postgres client issues the
 * same operations as parameterized SQL.
 */
export class InMemorySqlClient implements SqlClient {
  private tables = new Map<string, Map<string, SqlRow>>();
  private snapshot: Map<string, Map<string, SqlRow>> | null = null;

  private table(name: string): Map<string, SqlRow> {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      this.tables.set(name, t);
    }
    return t;
  }

  loadTable(table: string): SqlRow[] {
    return [...this.table(table).values()];
  }
  upsert(table: string, row: SqlRow): void {
    this.table(table).set(row.pk, row);
  }
  remove(table: string, pk: string): void {
    this.table(table).delete(pk);
  }
  begin(): void {
    // Deep-copy the table map for rollback (nested maps of immutable rows).
    const copy = new Map<string, Map<string, SqlRow>>();
    for (const [name, rows] of this.tables) copy.set(name, new Map(rows));
    this.snapshot = copy;
  }
  commit(): void {
    this.snapshot = null;
  }
  rollback(): void {
    if (this.snapshot) {
      this.tables = this.snapshot;
      this.snapshot = null;
    }
  }
}

/** A write-through collection: enforces invariants in-memory, persists to SQL. */
class SqlCollection<Row> extends Collection<Row> {
  constructor(
    name: string,
    options: CollectionOptions<Row>,
    private readonly sql: SqlClient,
  ) {
    super(name, options);
  }

  private persist(row: Row): void {
    const pk = this.keyOf(row);
    const v = this.getVersioned(pk)!.version;
    this.sql.upsert(this.name, { pk, version: v, data: row });
  }

  override insert(row: Row): void {
    super.insert(row);
    this.persist(row);
  }
  override insertIdempotent(row: Row): boolean {
    const inserted = super.insertIdempotent(row);
    if (inserted) this.persist(row);
    return inserted;
  }
  override replace(row: Row, expectedVersion?: number): number {
    const v = super.replace(row, expectedVersion);
    this.sql.upsert(this.name, { pk: this.keyOf(row), version: v, data: row });
    return v;
  }
  override upsert(row: Row): void {
    super.upsert(row);
    this.persist(row);
  }
  override delete(pk: string): void {
    super.delete(pk);
    this.sql.remove(this.name, pk);
  }
}

/**
 * The durable store used in hosted mode. Subclasses the tested reference store so
 * the `UnitOfWork` and every repository use it unchanged, and wraps transactions
 * with the SQL client so a rollback undoes both the in-memory index and the
 * durable rows atomically.
 */
export class SqlStore extends RelationalStore {
  constructor(private readonly sql: SqlClient) {
    super();
  }

  override define<Row>(name: string, options: CollectionOptions<Row>): Collection<Row> {
    const collection = new SqlCollection<Row>(name, options, this.sql);
    this.collections.push(collection as Collection<unknown>);
    return collection;
  }

  /** Hydrate every defined collection from the durable backend (startup). */
  async hydrate(): Promise<void> {
    for (const collection of this.collections) {
      const rows = await this.sql.loadTable(collection.name);
      collection.loadRows(rows.map((r) => ({ row: r.data as never, version: r.version })));
    }
  }

  override async transact<T>(fn: () => Promise<T> | T): Promise<T> {
    if (this.inTransaction) return await fn();
    this.sql.begin();
    try {
      const result = await super.transact(fn); // snapshots the in-memory index too
      this.sql.commit();
      return result;
    } catch (error) {
      this.sql.rollback();
      throw error;
    }
  }
}
