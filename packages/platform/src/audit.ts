import { type AuditEntryId, type TenantId, type UserId } from "@partnera/core";

/**
 * Immutable audit trail for sensitive actions: money moves, permission/role
 * changes, impersonation, extension kill-switch, config changes, offer and
 * partnership approvals. Append-only by contract. See docs/18-security.md.
 */
export interface AuditLogEntry {
  readonly id: AuditEntryId;
  readonly tenantId: TenantId | null;
  readonly actorUserId: UserId;
  /** Dot-namespaced action, e.g. "payouts.execute", "roles.update". */
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly at: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
  /** True when performed by a platform operator acting cross-tenant. */
  readonly byPlatformOperator: boolean;
}

/** Append-only audit sink; implementations must never update or delete entries. */
export interface AuditSink {
  record(entry: AuditLogEntry): Promise<void>;
}

export interface NewAuditEntry {
  readonly id: AuditEntryId;
  readonly tenantId: TenantId | null;
  readonly actorUserId: UserId;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly metadata?: Record<string, unknown>;
  readonly byPlatformOperator?: boolean;
}

export function makeAuditEntry(input: NewAuditEntry, at: Date): AuditLogEntry {
  return {
    id: input.id,
    tenantId: input.tenantId,
    actorUserId: input.actorUserId,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    at,
    metadata: Object.freeze({ ...(input.metadata ?? {}) }),
    byPlatformOperator: input.byPlatformOperator ?? false,
  };
}
