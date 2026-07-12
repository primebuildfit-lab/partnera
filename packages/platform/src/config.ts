import { type TenantId } from "@partnera/core";

/**
 * Configuration framework. Every configurable behavior is declared as a typed
 * `ConfigDefinition` with a default; values may be overridden at platform or
 * business scope. Reading an unset key returns the default — configuration is
 * data, consistent with the platform's "configuration over code" philosophy.
 */
export type ConfigScope = "platform" | "business";

export interface ConfigDefinition<T> {
  readonly key: string;
  readonly scope: ConfigScope;
  readonly description: string;
  readonly defaultValue: T;
}

export interface ConfigStore {
  get(key: string, tenantId: TenantId | null): Promise<unknown>;
  set(key: string, tenantId: TenantId | null, value: unknown): Promise<void>;
}

/** Resolve a definition against a stored value, falling back to the default. */
export function resolveConfig<T>(definition: ConfigDefinition<T>, stored: unknown): T {
  if (stored === undefined || stored === null) return definition.defaultValue;
  return stored as T;
}

/** A couple of platform-level defaults, demonstrating the framework. */
export const PLATFORM_CONFIG = {
  minPayoutMinorUnits: {
    key: "payouts.min_minor_units",
    scope: "business",
    description: "Minimum withdrawable balance in minor units before payout is allowed.",
    defaultValue: 2000,
  },
  defaultClawbackDays: {
    key: "commissions.default_clawback_days",
    scope: "business",
    description: "Default clawback window applied when an offer specifies none.",
    defaultValue: 30,
  },
} as const satisfies Record<string, ConfigDefinition<number>>;
