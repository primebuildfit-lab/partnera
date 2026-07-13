import { describe, expect, it } from "vitest";
import { asId, type BusinessId } from "@partnera/core";
import { RelationalStore } from "../relational/store";
import { InMemorySqlClient, SqlStore } from "../relational/sql-store";
import { UnitOfWork } from "../unit-of-work";
import {
  createUnitOfWork,
  memoryDriver,
  persistenceConfigFromEnv,
  postgresDriver,
  resolvePersistenceMode,
  validatePersistenceConfig,
} from "../config";
import { runStoreContract } from "./store-contract";

// The SAME contract runs against BOTH backends (Bloque 1). The Postgres store is
// exercised through an in-memory SqlClient here; deploy swaps in a `pg` client.
describe("store contract — both drivers", () => {
  it("in-memory store satisfies the shared contract", async () => {
    await runStoreContract(() => new RelationalStore());
  });
  it("Postgres (SqlStore) satisfies the SAME contract", async () => {
    await runStoreContract(() => new SqlStore(new InMemorySqlClient()));
  });
});

describe("Postgres driver — write-through + hydrate + tenant isolation", () => {
  it("persists to the SqlClient and hydrates a fresh store from it", async () => {
    const client = new InMemorySqlClient();
    const s1 = new SqlStore(client);
    const rows = s1.define<{ id: string; tenantId: string; n: number }>("t", { pk: (r) => r.id });
    rows.insert({ id: "a", tenantId: "t1", n: 1 });
    rows.replace({ id: "a", tenantId: "t1", n: 2 });
    // A brand-new store over the SAME client hydrates the durable rows.
    const s2 = new SqlStore(client);
    const rows2 = s2.define<{ id: string; tenantId: string; n: number }>("t", { pk: (r) => r.id });
    await s2.hydrate();
    expect(rows2.get("a")!.n).toBe(2);
  });

  it("UnitOfWork works over the Postgres driver with tenant isolation", () => {
    const uow = createUnitOfWork({ mode: "postgres", databaseUrl: "postgres://x" }, postgresDriver(new InMemorySqlClient()));
    const t1 = asId<BusinessId>("t1");
    const t2 = asId<BusinessId>("t2");
    uow.identity.createBusiness({ id: t1, organizationId: null, name: "A", status: "active", planKey: "p", createdAt: new Date() });
    uow.identity.createBusiness({ id: t2, organizationId: null, name: "B", status: "active", planKey: "p", createdAt: new Date() });
    expect(uow.identity.getBusiness(t1)!.name).toBe("A");
    expect(uow.identity.getBusiness(t2)!.name).toBe("B");
    // System roles seeded through the durable store too.
    expect(uow.identity.listRoles().length).toBeGreaterThan(0);
  });
});

describe("persistence config — explicit mode, no silent fallback", () => {
  it("defaults to memory and builds a working UnitOfWork", () => {
    expect(resolvePersistenceMode({})).toBe("memory");
    const uow = createUnitOfWork({ mode: "memory" });
    expect(uow.identity.listRoles().length).toBeGreaterThan(0); // system roles seeded
  });

  it("resolves postgres from env aliases", () => {
    expect(resolvePersistenceMode({ PARTNERA_PERSISTENCE: "postgres" })).toBe("postgres");
    expect(resolvePersistenceMode({ PERSISTENCE_MODE: "database" })).toBe("postgres");
  });

  it("postgres mode requires a valid DATABASE_URL (hard fail)", () => {
    expect(validatePersistenceConfig({ mode: "postgres" }).ok).toBe(false);
    expect(validatePersistenceConfig({ mode: "postgres", databaseUrl: "mysql://x" }).ok).toBe(false);
    expect(validatePersistenceConfig({ mode: "postgres", databaseUrl: "postgres://u:p@h/db" }).ok).toBe(true);
  });

  it("throws (never silently falls back to memory) when postgres has no driver", () => {
    expect(() => createUnitOfWork({ mode: "postgres", databaseUrl: "postgres://u:p@h/db" })).toThrow(/driver/i);
  });

  it("builds config from env", () => {
    const cfg = persistenceConfigFromEnv({ PARTNERA_PERSISTENCE: "memory" });
    expect(cfg.mode).toBe("memory");
    expect(memoryDriver.mode).toBe("memory");
  });
});
