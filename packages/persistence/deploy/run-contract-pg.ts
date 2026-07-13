/**
 * Runs the SHARED store contract (`runStoreContract`) against a REAL Postgres —
 * the third mandatory variant (Phase 6, Block 1). Deploy artifact: requires `pg`
 * + a reachable `DATABASE_URL` (a development/ephemeral DB, never production).
 *
 * Usage (once `pg` is installed and a dev Postgres exists):
 *   DATABASE_URL=postgres://user:pass@host:5432/partnera_test \
 *     node --loader tsx packages/persistence/deploy/run-contract-pg.ts
 *
 * It hydrates through the PgSqlClient, flushes after each contract op, and
 * asserts the SAME invariants proven for the in-memory and SqlStore variants.
 * Prints PASS/FAIL; exits non-zero on failure so CI can gate on it.
 */
import { runStoreContract } from "../src/contract/store-contract";
import { SqlStore } from "../src/relational/sql-store";
import { PgSqlClient } from "./pg-sql-client";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required (use a DEV/ephemeral database, not production)");

  const client = new PgSqlClient(url);
  await client.ensureSchema();

  // The contract creates fresh stores; each shares this client but uses distinct
  // table names, so a clean run needs a clean DB (or unique table prefixes).
  await runStoreContract(() => new SqlStore(client));
  // Flush any buffered writes so durability is exercised end-to-end.
  await client.flush();

  const ok = await client.ping();
  await client.close();
  if (!ok) throw new Error("ping failed after contract run");
  // eslint-disable-next-line no-console
  console.log("PASS — store contract green against real Postgres");
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("FAIL —", e instanceof Error ? e.message : e);
  process.exit(1);
});
