import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { SystemClock, UuidIdGenerator } from "@partnera/core";
import { deserializeStore, serializeStore } from "@partnera/persistence";
import { buildDemoRuntime, type DemoWorld } from "./demo";

/**
 * The local, durable runtime for daily use. Data lives in a single JSON file
 * (no external database): on first run the demo world is seeded through the real
 * services and written out; on every later run it is loaded from the file, so
 * everything you do survives restarts. A real Postgres/Prisma store is the
 * production activation (MM5) — this file persistence is the desktop/dev tier.
 *
 * Uses a real clock and UUID ids so records created across many runs never
 * collide (unlike the deterministic in-memory demo used by tests).
 */
export interface LocalWorld {
  readonly world: DemoWorld;
  /** Persist the current state to disk (atomic write). */
  save(): void;
  /** True if this run seeded fresh data (first run). */
  readonly firstRun: boolean;
  readonly dataFile: string;
}

export async function createLocalWorld(dataFile: string): Promise<LocalWorld> {
  const runtime = buildDemoRuntime({ clock: new SystemClock(), ids: new UuidIdGenerator() });
  const store = runtime.world.uow.store;
  const backupDir = join(dirname(dataFile), "backups");

  // Advertise the durable-storage descriptor for the admin data-status view.
  runtime.world.persistence.mode = "local-file";
  runtime.world.persistence.dataFile = dataFile;
  runtime.world.persistence.backupDir = backupDir;

  const save = (): void => {
    mkdirSync(dirname(dataFile), { recursive: true });
    const tmp = `${dataFile}.tmp`;
    writeFileSync(tmp, serializeStore(store), "utf8");
    renameSync(tmp, dataFile); // atomic replace — never leaves a half-written file
    runtime.world.persistence.lastSaveAt = new Date();
  };

  let firstRun = false;
  if (existsSync(dataFile)) {
    deserializeStore(store, readFileSync(dataFile, "utf8"));
  } else {
    await runtime.seed();
    save();
    firstRun = true;
  }

  return { world: runtime.world, save, firstRun, dataFile };
}
