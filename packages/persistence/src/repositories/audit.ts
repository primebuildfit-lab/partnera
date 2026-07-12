import { type AuditEntryId, type TenantId } from "@partnera/core";
import { type AuditLogEntry, type AuditSink } from "@partnera/platform";
import { type Collection } from "../relational/store";

/**
 * Persistent, append-only {@link AuditSink}. Every sensitive action — money
 * moves, permission/role changes, impersonation, config changes, offer/payout
 * approvals — is recorded here and never updated or deleted (the collection is
 * append-only at the store level, so the invariant is structurally enforced).
 */
export class AuditRepository implements AuditSink {
  constructor(private readonly entries: Collection<AuditLogEntry>) {}

  async record(entry: AuditLogEntry): Promise<void> {
    this.entries.insertIdempotent(entry);
  }

  get(id: AuditEntryId): AuditLogEntry | undefined {
    return this.entries.get(id);
  }

  listForTenant(tenantId: TenantId): AuditLogEntry[] {
    return this.entries
      .find((e) => e.tenantId === tenantId)
      .sort((a, b) => b.at.getTime() - a.at.getTime());
  }
}
