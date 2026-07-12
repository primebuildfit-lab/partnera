import { ConflictError, InvariantViolation } from "@partnera/core";
import { describe, expect, it } from "vitest";
import { RelationalStore } from "./store";

interface Row {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
}

const mk = () => {
  const store = new RelationalStore();
  const mutable = store.define<Row>("mutable", {
    pk: (r) => r.id,
    unique: [{ name: "tenant_name", key: (r) => `${r.tenantId}:${r.name}` }],
  });
  const appendOnly = store.define<Row>("append_only", { pk: (r) => r.id, appendOnly: true });
  return { store, mutable, appendOnly };
};

describe("RelationalStore — invariants", () => {
  it("rejects duplicate primary keys", () => {
    const { mutable } = mk();
    mutable.insert({ id: "1", tenantId: "t1", name: "a" });
    expect(() => mutable.insert({ id: "1", tenantId: "t1", name: "b" })).toThrow(ConflictError);
  });

  it("enforces unique constraints (idempotency backing)", () => {
    const { mutable } = mk();
    mutable.insert({ id: "1", tenantId: "t1", name: "a" });
    expect(() => mutable.insert({ id: "2", tenantId: "t1", name: "a" })).toThrow(/Unique constraint/);
    // Different tenant, same name is fine — the unique key is tenant-scoped.
    expect(() => mutable.insert({ id: "3", tenantId: "t2", name: "a" })).not.toThrow();
  });

  it("insertIdempotent is a no-op on repeat", () => {
    const { appendOnly } = mk();
    expect(appendOnly.insertIdempotent({ id: "e1", tenantId: "t1", name: "x" })).toBe(true);
    expect(appendOnly.insertIdempotent({ id: "e1", tenantId: "t1", name: "x" })).toBe(false);
    expect(appendOnly.count()).toBe(1);
  });

  it("forbids update and delete on append-only collections", () => {
    const { appendOnly } = mk();
    appendOnly.insert({ id: "e1", tenantId: "t1", name: "x" });
    expect(() => appendOnly.replace({ id: "e1", tenantId: "t1", name: "y" })).toThrow(
      InvariantViolation,
    );
    expect(() => appendOnly.delete("e1")).toThrow(InvariantViolation);
  });

  it("guards optimistic concurrency on replace", () => {
    const { mutable } = mk();
    mutable.insert({ id: "1", tenantId: "t1", name: "a" });
    const v1 = mutable.getVersioned("1")!.version;
    mutable.replace({ id: "1", tenantId: "t1", name: "b" }, v1); // ok
    // Replaying the stale version must fail (lost-update protection).
    expect(() => mutable.replace({ id: "1", tenantId: "t1", name: "c" }, v1)).toThrow(ConflictError);
  });

  it("rolls back every collection when a transaction throws", async () => {
    const { store, mutable, appendOnly } = mk();
    mutable.insert({ id: "1", tenantId: "t1", name: "a" });
    await expect(
      store.transact(async () => {
        appendOnly.insert({ id: "e1", tenantId: "t1", name: "x" });
        mutable.replace({ id: "1", tenantId: "t1", name: "b" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    // Both writes were rolled back atomically.
    expect(appendOnly.count()).toBe(0);
    expect(mutable.get("1")!.name).toBe("a");
  });

  it("commits a transaction that succeeds", async () => {
    const { store, appendOnly } = mk();
    await store.transact(async () => {
      appendOnly.insert({ id: "e1", tenantId: "t1", name: "x" });
    });
    expect(appendOnly.count()).toBe(1);
  });
});
