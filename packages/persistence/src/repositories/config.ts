import { type TenantId } from "@partnera/core";
import { type ConfigStore } from "@partnera/platform";
import { type Collection } from "../relational/store";

/** A stored configuration value at platform (tenantId null) or business scope. */
export interface ConfigRow {
  readonly key: string;
  readonly tenantId: TenantId | null;
  readonly value: unknown;
  readonly updatedAt: Date;
}

export const configPk = (key: string, tenantId: TenantId | null): string =>
  `${key}::${tenantId ?? "__platform__"}`;

/**
 * Persistent {@link ConfigStore}. Reads a value at the requested scope; the
 * engine's `resolveConfig` falls back to the definition default when unset, so
 * "configuration over code" holds without special-casing missing rows.
 */
export class ConfigRepository implements ConfigStore {
  constructor(private readonly rows: Collection<ConfigRow>) {}

  async get(key: string, tenantId: TenantId | null): Promise<unknown> {
    const row = this.rows.get(configPk(key, tenantId));
    return row?.value;
  }

  async set(key: string, tenantId: TenantId | null, value: unknown): Promise<void> {
    this.rows.upsert({ key, tenantId, value, updatedAt: new Date() });
  }
}
