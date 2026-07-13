import { describe, expect, it } from "vitest";
import { RelationalStore } from "../relational/store";
import {
  createUnitOfWork,
  memoryDriver,
  persistenceConfigFromEnv,
  resolvePersistenceMode,
  validatePersistenceConfig,
} from "../config";
import { runStoreContract } from "./store-contract";

describe("store contract — in-memory driver", () => {
  it("satisfies the shared persistence contract", async () => {
    // The SAME suite will run against the Prisma/Postgres store once its driver
    // is activated (deploy-time). Today it proves the in-memory reference.
    await runStoreContract(() => new RelationalStore());
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
