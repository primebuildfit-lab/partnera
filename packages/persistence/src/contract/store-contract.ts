import { Money } from "@partnera/core";
import { type RelationalStore } from "../relational/store";

/** Minimal, dependency-free assertions so this contract can be built and reused. */
function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`Store contract failed: ${msg}`);
}
function assertThrows(fn: () => unknown, msg: string): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  assert(threw, `expected throw: ${msg}`);
}
async function assertRejects(p: Promise<unknown>, msg: string): Promise<void> {
  let threw = false;
  try {
    await p;
  } catch {
    threw = true;
  }
  assert(threw, `expected rejection: ${msg}`);
}

/**
 * Shared persistence **contract**: one suite that any store must satisfy —
 * exercised against the in-memory `RelationalStore` today and against the
 * Prisma/Postgres store once its driver is activated (same ports, same
 * behaviour). This is the single source of truth for the store guarantees the
 * platform invariants depend on, so the two backends can never silently diverge.
 *
 * A caller passes a factory that produces a *fresh, empty* store. The suite runs
 * assertions directly (call it from inside a Vitest `it(...)`).
 */
export interface StoreContractRow {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly amount: { currency: string; minorUnits: string };
  readonly at: Date;
}

export async function runStoreContract(makeStore: () => RelationalStore): Promise<void> {
  const rowDef = (store: RelationalStore, unique = false) =>
    store.define<StoreContractRow>("t_rows", {
      pk: (r) => r.id,
      unique: unique ? [{ name: "tenant_name", key: (r) => `${r.tenantId}:${r.name}` }] : undefined,
    });
  const mk = (id: string, tenantId: string, name: string, minor = "1", at = new Date()): StoreContractRow => ({
    id, tenantId, name, amount: { currency: "USD", minorUnits: minor }, at,
  });

  // create / read
  {
    const store = makeStore();
    const rows = rowDef(store, true);
    const row = mk("r1", "t1", "a", "1000", new Date("2026-07-13T00:00:00Z"));
    rows.insert(row);
    assert(JSON.stringify(rows.get("r1")) === JSON.stringify(row), "read equals write");
  }
  // unique index enforced
  {
    const store = makeStore();
    const rows = rowDef(store, true);
    rows.insert(mk("r1", "t1", "dup"));
    assertThrows(() => rows.insert(mk("r2", "t1", "dup")), "unique clash");
  }
  // tenant isolation
  {
    const store = makeStore();
    const rows = rowDef(store);
    rows.insert(mk("a", "t1", "x"));
    rows.insert(mk("b", "t2", "x"));
    assert(rows.find((r) => r.tenantId === "t1").map((r) => r.id).join() === "a", "t1 sees only a");
    assert(rows.find((r) => r.tenantId === "t2").map((r) => r.id).join() === "b", "t2 sees only b");
  }
  // optimistic concurrency
  {
    const store = makeStore();
    const rows = rowDef(store);
    const row = mk("r1", "t1", "a");
    rows.insert(row);
    const v = rows.getVersioned("r1")!.version;
    rows.replace({ ...row, name: "b" }, v);
    assertThrows(() => rows.replace({ ...row, name: "c" }, v), "stale version rejected");
    assert(rows.get("r1")!.name === "b", "no overwrite on conflict");
  }
  // append-only rejects update/delete
  {
    const store = makeStore();
    const evts = store.define<StoreContractRow>("t_events", { pk: (r) => r.id, appendOnly: true });
    evts.insert(mk("e1", "t1", "created"));
    assertThrows(() => evts.replace(mk("e1", "t1", "edited")), "append-only update blocked");
    assertThrows(() => evts.delete("e1"), "append-only delete blocked");
  }
  // idempotent insert
  {
    const store = makeStore();
    const evts = store.define<StoreContractRow>("t_events", { pk: (r) => r.id, appendOnly: true });
    const e = mk("e1", "t1", "x");
    assert(evts.insertIdempotent(e) === true, "first insert");
    assert(evts.insertIdempotent(e) === false, "retry is no-op");
    assert(evts.count() === 1, "one row");
  }
  // transaction rollback
  {
    const store = makeStore();
    const rows = rowDef(store);
    rows.insert(mk("keep", "t1", "a"));
    await assertRejects(
      store.transact(async () => {
        rows.insert(mk("temp", "t1", "b"));
        throw new Error("boom");
      }),
      "transaction throws",
    );
    assert(rows.get("temp") === undefined, "rolled back");
    assert(rows.get("keep") !== undefined, "kept untouched");
  }
  // money round-trip (exact, no float)
  {
    const store = makeStore();
    const rows = rowDef(store);
    const money = Money.parse("123456789.99", "USD");
    rows.insert({ ...mk("m", "t1", "money"), amount: money.toJSON() });
    const back = Money.fromJSON(rows.get("m")!.amount);
    assert(back.equals(money) && back.toDecimalString() === "123456789.99", "money exact round-trip");
  }
  // date fidelity through snapshot
  {
    const store = makeStore();
    const rows = rowDef(store);
    const at = new Date("2026-07-13T12:34:56.789Z");
    rows.insert(mk("d", "t1", "date", "1", at));
    const dump = store.exportAll();
    const store2 = makeStore();
    const rows2 = rowDef(store2);
    store2.importAll(dump);
    const loaded = rows2.get("d")!;
    assert(loaded.at instanceof Date && loaded.at.getTime() === at.getTime(), "date fidelity");
  }
}
