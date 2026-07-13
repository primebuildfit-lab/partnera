import { type Result, err, ok, ValidationError } from "@partnera/core";

/**
 * Environment separation and validation (Part 22). The app must refuse to start
 * with an unsafe or mixed configuration — e.g. production mode with a local file
 * store, or simulated payouts turned off without a provider. This keeps the
 * "local / staging / production" boundaries real instead of aspirational.
 */
export type EnvironmentMode = "local" | "staging" | "production";

export interface RuntimeConfig {
  readonly mode: EnvironmentMode;
  /** "file" (local only) or "database" (staging/production). */
  readonly persistence: "file" | "database";
  /** Whether real money movement is enabled (must be false until a provider is live). */
  readonly realPayments: boolean;
  /** Whether a real external AI review provider is connected. */
  readonly realAi: boolean;
  /** Whether real Shopify billing charges are enabled. */
  readonly realBilling: boolean;
  /** Present only when Shopify is configured (never the secret value itself). */
  readonly shopifyConfigured: boolean;
}

/**
 * Validate a runtime configuration. Returns the config on success, or a
 * ValidationError describing the unsafe combination. Deterministic and pure.
 */
export function validateEnvironment(config: RuntimeConfig): Result<RuntimeConfig, ValidationError> {
  const problems: string[] = [];

  if (config.mode === "production") {
    if (config.persistence !== "database") problems.push("production requires a hosted database, not file persistence");
  }
  if (config.mode === "local") {
    if (config.realPayments) problems.push("local mode must not enable real payments");
    if (config.realAi) problems.push("local mode must not enable real AI");
    if (config.realBilling) problems.push("local mode must not enable real billing");
  }
  if (config.mode === "staging") {
    if (config.realPayments) problems.push("staging/pilot must keep payouts simulated");
    if (config.realBilling) problems.push("staging/pilot must use billing test mode, not real charges");
    if (config.persistence !== "database") problems.push("staging/pilot requires a hosted database");
  }
  // Real money/AI/billing may only be on in production.
  if (config.mode !== "production" && (config.realPayments || config.realAi || config.realBilling)) {
    problems.push("real payments/AI/billing are only permitted in production");
  }

  if (problems.length > 0) {
    return err(new ValidationError(`Unsafe environment configuration: ${problems.join("; ")}`, { mode: config.mode }));
  }
  return ok(config);
}

/** A safe default local configuration (used by the dev/desktop runtime). */
export const LOCAL_CONFIG: RuntimeConfig = {
  mode: "local",
  persistence: "file",
  realPayments: false,
  realAi: false,
  realBilling: false,
  shopifyConfigured: false,
};
