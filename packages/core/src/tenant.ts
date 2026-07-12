import { type BusinessId, type UserId } from "./ids";

/**
 * Tenant scoping is the platform's most important invariant: every operational
 * record belongs to exactly one Business, and no read/write may cross tenants
 * except through explicit, audited paths (platform operators, agreed
 * partnerships). These types make "which tenant?" impossible to forget.
 */
export type TenantId = BusinessId;

/** A record that is owned by a tenant. */
export interface TenantScoped {
  readonly tenantId: TenantId;
}

/**
 * The authenticated context every engine operation runs within. Engines must
 * scope all data access to `tenantId` and never trust ambient state. Platform
 * operators act through a distinct, audited context (see @partnera/auth).
 */
export interface RequestContext {
  readonly tenantId: TenantId;
  readonly actorUserId: UserId;
  /** True only for Partnera platform operators acting cross-tenant (audited). */
  readonly isPlatformOperator: boolean;
  /** Correlation id for tracing a request across engines and logs. */
  readonly requestId: string;
}

/** Guard that a record belongs to the expected tenant before returning it. */
export function assertSameTenant(record: TenantScoped, tenantId: TenantId): void {
  if (record.tenantId !== tenantId) {
    throw new Error(
      `Tenant isolation violation: record ${record.tenantId} accessed under ${tenantId}`,
    );
  }
}
