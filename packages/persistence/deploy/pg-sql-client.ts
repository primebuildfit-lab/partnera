/**
 * REAL Postgres client for the hosted store (Phase 6, Block 1).
 *
 * This is the productive `SqlClient` implementation — NOT a template. It is a
 * deploy artifact kept OUTSIDE `src/` so the offline monorepo build stays green
 * on a machine that cannot install `pg` (install scripts blocked) or reach a
 * database. At deploy (`pg` installed, `DATABASE_URL` set) it is imported and
 * passed to `postgresDriver(new PgSqlClient(...))`.
 *
 * Design: write-behind. The sync `upsert`/`remove` (called by the store's
 * write-through Collections) buffer into a journal; `flush()` persists the
 * buffered mutations to Postgres inside a single transaction (the host calls it
 * at each request boundary, exactly like the JSON snapshot save). `loadTable`
 * hydrates on startup. Uniqueness/version/append-only are enforced in-memory by
 * the Collection before flush (single-process pilot durability — same granularity
 * as the JSON mode; documented in DECISIONS D-326).
 *
 * Storage model: one JSONB key-value table that maps the `SqlClient` port 1:1 —
 *   partnera_store(collection TEXT, pk TEXT, version INT, data JSONB, PRIMARY KEY(collection, pk))
 * The richer per-aggregate schema (prisma/schema.prisma + sql/0002) remains
 * available for a later indexing/analytics pass; the pilot driver uses the KV
 * table because it matches the port cleanly and preserves money/date fidelity
 * (data is JSONB; minor units stay strings).
 *
 * Engines/services NEVER import this file — it lives behind the SqlClient port.
 */
import { Pool, type PoolClient } from "pg";
import type { SqlClient, SqlRow } from "../src/relational/sql-store";

type Op = { readonly kind: "upsert"; readonly row: SqlRow } | { readonly kind: "remove"; readonly pk: string };

export class PgSqlClient implements SqlClient {
  private readonly pool: Pool;
  // Buffered ops per table, applied on flush. Ordered per (table, pk): last wins.
  private journal = new Map<string, Map<string, Op>>();
  private snapshot: Map<string, Map<string, Op>> | null = null;

  constructor(connectionString: string, opts?: { max?: number; connectionTimeoutMillis?: number }) {
    this.pool = new Pool({
      connectionString,
      max: opts?.max ?? 10,
      connectionTimeoutMillis: opts?.connectionTimeoutMillis ?? 5000,
      idleTimeoutMillis: 30000,
    });
  }

  /** Create the KV table if absent (run once at deploy / first boot). */
  async ensureSchema(): Promise<void> {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS partnera_store (
         collection TEXT NOT NULL,
         pk         TEXT NOT NULL,
         version    INT  NOT NULL DEFAULT 1,
         data       JSONB NOT NULL,
         PRIMARY KEY (collection, pk)
       )`,
    );
  }

  async loadTable(table: string): Promise<readonly SqlRow[]> {
    const res = await this.pool.query<{ pk: string; version: number; data: unknown }>(
      `SELECT pk, version, data FROM partnera_store WHERE collection = $1`,
      [table],
    );
    return res.rows.map((r) => ({ pk: r.pk, version: r.version, data: reviveDates(r.data) }));
  }

  private tbl(table: string): Map<string, Op> {
    let t = this.journal.get(table);
    if (!t) {
      t = new Map();
      this.journal.set(table, t);
    }
    return t;
  }
  upsert(table: string, row: SqlRow): void {
    this.tbl(table).set(row.pk, { kind: "upsert", row });
  }
  remove(table: string, pk: string): void {
    this.tbl(table).set(pk, { kind: "remove", pk });
  }

  // In-transaction buffering mirrors the store's snapshot/rollback.
  begin(): void {
    const copy = new Map<string, Map<string, Op>>();
    for (const [t, ops] of this.journal) copy.set(t, new Map(ops));
    this.snapshot = copy;
  }
  commit(): void {
    this.snapshot = null;
  }
  rollback(): void {
    if (this.snapshot) {
      this.journal = this.snapshot;
      this.snapshot = null;
    }
  }

  /** Persist all buffered ops atomically, then clear the journal. */
  async flush(): Promise<void> {
    const pending = this.journal;
    if (pending.size === 0) return;
    this.journal = new Map();
    const client: PoolClient = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const [table, ops] of pending) {
        for (const op of ops.values()) {
          if (op.kind === "upsert") {
            await client.query(
              `INSERT INTO partnera_store (collection, pk, version, data)
               VALUES ($1, $2, $3, $4::jsonb)
               ON CONFLICT (collection, pk) DO UPDATE SET version = EXCLUDED.version, data = EXCLUDED.data`,
              [table, op.row.pk, op.row.version, JSON.stringify(op.row.data)],
            );
          } else {
            await client.query(`DELETE FROM partnera_store WHERE collection = $1 AND pk = $2`, [table, op.pk]);
          }
        }
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      // Re-buffer the failed ops so nothing is silently lost.
      for (const [t, ops] of pending) {
        const dest = this.tbl(t);
        for (const [k, v] of ops) if (!dest.has(k)) dest.set(k, v);
      }
      throw e;
    } finally {
      client.release();
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }
  async close(): Promise<void> {
    await this.pool.end();
  }
}

/** JSON has no Date; revive ISO strings that look like timestamps back to Date. */
function reviveDates(value: unknown): unknown {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value)) {
    return new Date(value);
  }
  if (Array.isArray(value)) return value.map(reviveDates);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = reviveDates(v);
    return out;
  }
  return value;
}
