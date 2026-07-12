import { type TenantId } from "@partnera/core";

/**
 * Feature flags gate capabilities per plan, tenant, or gradual rollout. They
 * also back plan entitlements (see docs/17-monetization.md): upgrading a plan
 * flips entitlements with no code change. Evaluation is deterministic.
 */
export type FlagRule =
  | { readonly kind: "plan"; readonly plans: readonly string[]; readonly enabled: boolean }
  | { readonly kind: "tenant"; readonly tenantIds: readonly string[]; readonly enabled: boolean }
  | { readonly kind: "rollout"; readonly percentage: number; readonly enabled: boolean };

export interface FeatureFlag {
  readonly key: string;
  readonly description: string;
  readonly defaultEnabled: boolean;
  /** Rules evaluated in order; the first match wins. */
  readonly rules: readonly FlagRule[];
}

export interface FlagContext {
  readonly tenantId: TenantId;
  readonly planKey: string;
}

/** Stable 0..99 bucket for a tenant, so rollout membership never flickers. */
function bucket(flagKey: string, tenantId: string): number {
  let hash = 2166136261;
  const input = `${flagKey}:${tenantId}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 100;
}

export function evaluateFlag(flag: FeatureFlag, ctx: FlagContext): boolean {
  for (const rule of flag.rules) {
    switch (rule.kind) {
      case "plan":
        if (rule.plans.includes(ctx.planKey)) return rule.enabled;
        break;
      case "tenant":
        if (rule.tenantIds.includes(ctx.tenantId)) return rule.enabled;
        break;
      case "rollout":
        if (bucket(flag.key, ctx.tenantId) < rule.percentage) return rule.enabled;
        break;
    }
  }
  return flag.defaultEnabled;
}
