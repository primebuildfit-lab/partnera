import { type Result, err, ok, DomainError } from "@partnera/core";
import { RelationalStore } from "./relational/store";
import { type SqlClient, SqlStore } from "./relational/sql-store";
import { UnitOfWork } from "./unit-of-work";

/**
 * Persistence mode selection (Activation phase). Partnera keeps **two** runtimes:
 *
 *  - `memory` — the in-memory relational store (+ JSON snapshot in the web
 *    runtime). No external services; the default for local dev and tests.
 *  - `postgres` — a Prisma/Postgres-backed store behind the **same** repository
 *    ports (no engine/application change). Selected explicitly by config.
 *
 * The selection is **explicit** and there is **no silent fallback** from
 * `postgres` to `memory`: an invalid hosted configuration is a hard error, so a
 * misconfigured production process refuses to start instead of quietly running
 * on memory.
 */
export type PersistenceMode = "memory" | "postgres";

export interface PersistenceConfig {
  readonly mode: PersistenceMode;
  /** Required when mode === "postgres". Never logged. */
  readonly databaseUrl?: string;
}

export class PersistenceConfigError extends DomainError {
  readonly code = "persistence_config_error";
  readonly httpStatusHint = 500;
}

/** Resolve the persistence mode from environment variables (explicit, defaulted to memory). */
export function resolvePersistenceMode(env: Readonly<Record<string, string | undefined>>): PersistenceMode {
  const raw = (env.PARTNERA_PERSISTENCE ?? env.PERSISTENCE_MODE ?? "memory").toLowerCase();
  if (raw === "postgres" || raw === "prisma" || raw === "database") return "postgres";
  return "memory";
}

/** Build a config from environment (does not validate; call {@link validatePersistenceConfig}). */
export function persistenceConfigFromEnv(env: Readonly<Record<string, string | undefined>>): PersistenceConfig {
  const mode = resolvePersistenceMode(env);
  return { mode, databaseUrl: env.DATABASE_URL };
}

/** Validate a persistence config. Postgres mode requires a DATABASE_URL. */
export function validatePersistenceConfig(config: PersistenceConfig): Result<PersistenceConfig, PersistenceConfigError> {
  if (config.mode === "postgres") {
    if (!config.databaseUrl || config.databaseUrl.trim() === "") {
      return err(new PersistenceConfigError("postgres persistence requires DATABASE_URL", { mode: config.mode }));
    }
    if (!/^postgres(ql)?:\/\//.test(config.databaseUrl)) {
      return err(new PersistenceConfigError("DATABASE_URL must be a postgres:// connection string", {}));
    }
  }
  return ok(config);
}

/**
 * A pluggable store driver so the Prisma/Postgres implementation can drop in
 * behind the same surface the `UnitOfWork` already consumes (`RelationalStore`).
 * The Postgres driver (a `RelationalStore`-compatible store over Prisma) is a
 * deploy-time artifact: it requires a generated Prisma client + a live database
 * and is therefore not constructed in this environment.
 */
export interface StoreDriver {
  readonly mode: PersistenceMode;
  createStore(): RelationalStore;
}

/** The in-memory driver — always available, no external services. */
export const memoryDriver: StoreDriver = {
  mode: "memory",
  createStore: () => new RelationalStore(),
};

/**
 * The Postgres (durable) driver: a write-through {@link SqlStore} over a
 * {@link SqlClient}. Deploy passes a `pg`-backed client; tests/contract pass an
 * in-memory client. Either way the driver code path is the same.
 */
export function postgresDriver(client: SqlClient): StoreDriver {
  return { mode: "postgres", createStore: () => new SqlStore(client) };
}

/**
 * Build a `UnitOfWork` for the given config. `memory` returns the in-memory
 * store. `postgres` requires a `StoreDriver` (the Prisma-backed driver, provided
 * at deploy time) — if none is supplied it throws a clear error rather than
 * silently falling back to memory.
 */
export function createUnitOfWork(config: PersistenceConfig, postgresDriver?: StoreDriver): UnitOfWork {
  const valid = validatePersistenceConfig(config);
  if (!valid.ok) throw valid.error;
  if (config.mode === "memory") {
    return new UnitOfWork(memoryDriver.createStore());
  }
  // postgres
  if (!postgresDriver || postgresDriver.mode !== "postgres") {
    throw new PersistenceConfigError(
      "postgres persistence selected but no Prisma/Postgres driver was provided (generate the Prisma client + set DATABASE_URL at deploy). No silent fallback to memory.",
      { mode: config.mode },
    );
  }
  return new UnitOfWork(postgresDriver.createStore());
}
