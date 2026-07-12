import { type RelationalStore } from "./relational/store";

/**
 * Durable local snapshotting for the {@link RelationalStore}. Serializes the
 * whole store to a JSON string (and back) so the local/desktop runtime can
 * persist data across restarts using nothing but a file — no external database.
 *
 * JSON has no `Date`, so dates are tagged and restored. Stored rows contain no
 * `bigint` (money is kept as string minor units via `MoneyJSON`), so no bigint
 * handling is needed. The format is versioned for forward-compatibility.
 */

interface DateTag {
  readonly __date: string;
}

function isDateTag(value: unknown): value is DateTag {
  return typeof value === "object" && value !== null && typeof (value as DateTag).__date === "string";
}

const SNAPSHOT_VERSION = 1;

/** Serialize the entire store to a JSON string (dates preserved). */
export function serializeStore(store: RelationalStore): string {
  const payload = { version: SNAPSHOT_VERSION, collections: store.exportAll() };
  return JSON.stringify(payload, function (this: Record<string, unknown>, key, value) {
    const original = this[key];
    if (original instanceof Date) return { __date: original.toISOString() };
    return value;
  });
}

/** Restore a store from a JSON string produced by {@link serializeStore}. */
export function deserializeStore(store: RelationalStore, json: string): void {
  const payload = JSON.parse(json, (_key, value) => (isDateTag(value) ? new Date(value.__date) : value)) as {
    version: number;
    collections: Record<string, { row: unknown; version: number }[]>;
  };
  if (payload.version !== SNAPSHOT_VERSION) {
    throw new Error(`Unsupported snapshot version ${payload.version} (expected ${SNAPSHOT_VERSION})`);
  }
  store.importAll(payload.collections);
}
