import { type DemoWorld } from "./demo";

/**
 * Minimal observability for the productive host (Blocks 6/14). Health + readiness
 * report process/persistence/version WITHOUT exposing secrets or personal data.
 * `redactSecrets` scrubs anything sensitive from log lines. Correlation ids let a
 * request be traced across logs.
 */
export const BUILD_VERSION = process.env.PARTNERA_BUILD ?? "0.0.0-dev";

export interface HealthReport {
  readonly status: "ok";
  readonly version: string;
  readonly persistence: "in-memory" | "local-file";
  readonly uptimeSec: number;
}

export interface ReadyReport {
  readonly ready: boolean;
  readonly checks: Readonly<Record<string, "ok" | "fail">>;
}

const startedAt = Date.now();

export function healthReport(world: DemoWorld): HealthReport {
  return {
    status: "ok",
    version: BUILD_VERSION,
    persistence: world.persistence.mode,
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
  };
}

/** Readiness: the store must be constructed and answerable. No secrets exposed. */
export function readyReport(world: DemoWorld): ReadyReport {
  const checks: Record<string, "ok" | "fail"> = {};
  try {
    world.uow.identity.listRoles(); // store answers
    checks.store = "ok";
  } catch {
    checks.store = "fail";
  }
  checks.persistence = world.persistence.mode ? "ok" : "fail";
  const ready = Object.values(checks).every((c) => c === "ok");
  return { ready, checks };
}

const SECRET_KEYS = /(secret|token|password|authorization|api[_-]?key|database_url|cookie|hmac|signature)/i;

/**
 * Redact sensitive values from an object before logging. Keys matching secret
 * patterns are masked; access tokens / secrets / DB URLs never reach logs.
 */
export function redactSecrets(input: unknown): unknown {
  if (typeof input === "string") {
    // Mask obvious bearer/token strings embedded in a message.
    return input.replace(/(shpat_|shpss_|shpca_)[A-Za-z0-9._-]+/g, "$1***").replace(/postgres(ql)?:\/\/[^\s]+/g, "postgres://***");
  }
  if (Array.isArray(input)) return input.map(redactSecrets);
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = SECRET_KEYS.test(k) ? "***" : redactSecrets(v);
    }
    return out;
  }
  return input;
}

/** A structured log line (JSON) with correlation + tenant/shop when safe. */
export function logLine(level: "debug" | "info" | "warn" | "error", event: string, fields: Record<string, unknown> = {}): string {
  return JSON.stringify({ level, event, at: new Date().toISOString(), ...(redactSecrets(fields) as object) });
}
