import {
  type AffiliateId,
  type CommissionId,
  type ConversionId,
  type TenantId,
} from "@partnera/core";
import {
  assertAppendable,
  type Balance,
  foldCommission,
  type CommissionRecord,
  type LedgerEvent,
  type LedgerStore,
  projectBalances,
} from "@partnera/commission-engine";
import { type Collection, type RelationalStore } from "../relational/store";

const byOccurrence = (a: LedgerEvent, b: LedgerEvent): number =>
  a.occurredAt.getTime() - b.occurredAt.getTime();

/**
 * Append-only commission ledger backed by the relational store. This is the
 * platform's money spine. It implements the engine's {@link LedgerStore}
 * contract unchanged, and adds:
 *
 *  - {@link appendGuarded}: read prior events → {@link assertAppendable} →
 *    append, all inside one transaction, so an illegal transition (second
 *    create, approving a paid commission) is rejected *before* any write.
 *  - idempotent appends by event id (safe to retry a delivery).
 *  - derived balances and commission records (never stored as mutable numbers).
 *
 * Tenant isolation: every read is scoped to the `TenantId` from the
 * authenticated context and asserted per row — a client can never widen scope.
 */
export class LedgerRepository implements LedgerStore {
  private readonly events: Collection<LedgerEvent>;

  constructor(
    private readonly store: RelationalStore,
    events: Collection<LedgerEvent>,
  ) {
    this.events = events;
  }

  async append(event: LedgerEvent): Promise<void> {
    // Idempotent by event id: a retried append with the same id is a no-op.
    this.events.insertIdempotent(event);
  }

  /**
   * The safe write path used by the application layer: enforces the append-only
   * state machine against the commission's prior history within a transaction.
   */
  async appendGuarded(event: LedgerEvent): Promise<void> {
    await this.store.transact(async () => {
      const prior = await this.readByCommission(event.tenantId, event.commissionId);
      assertAppendable(prior, event);
      this.events.insertIdempotent(event);
    });
  }

  async readByCommission(
    tenantId: TenantId,
    commissionId: CommissionId,
  ): Promise<readonly LedgerEvent[]> {
    return this.events
      .find((e) => e.tenantId === tenantId && e.commissionId === commissionId)
      .sort(byOccurrence);
  }

  async readByAffiliate(
    tenantId: TenantId,
    affiliateId: AffiliateId,
  ): Promise<readonly LedgerEvent[]> {
    return this.events
      .find((e) => e.tenantId === tenantId && e.affiliateId === affiliateId)
      .sort(byOccurrence);
  }

  /** All events for a tenant (admin/reporting; still strictly tenant-scoped). */
  async readByTenant(tenantId: TenantId): Promise<readonly LedgerEvent[]> {
    return this.events.find((e) => e.tenantId === tenantId).sort(byOccurrence);
  }

  /**
   * The commission ids created from a given conversion. A conversion may produce
   * more than one commission when offer stacking is enabled; refund/clawback
   * uses this to reverse every commission the conversion generated.
   */
  async commissionsForConversion(
    tenantId: TenantId,
    conversionId: ConversionId,
  ): Promise<CommissionId[]> {
    const ids = new Set<CommissionId>();
    for (const e of this.events.find(
      (x) =>
        x.tenantId === tenantId &&
        x.type === "commission.created" &&
        x.conversionId === conversionId,
    )) {
      ids.add(e.commissionId);
    }
    return [...ids];
  }

  /** Derive one commission's current record from its immutable event stream. */
  async getCommission(
    tenantId: TenantId,
    commissionId: CommissionId,
  ): Promise<CommissionRecord | null> {
    const events = await this.readByCommission(tenantId, commissionId);
    if (events.length === 0) return null;
    return foldCommission(events);
  }

  /** Derived per-currency balances for one affiliate. Never stored as truth. */
  async balancesForAffiliate(tenantId: TenantId, affiliateId: AffiliateId): Promise<Balance[]> {
    const events = await this.readByAffiliate(tenantId, affiliateId);
    return projectBalances(events);
  }

  /** All commissions for a tenant, each folded from its event stream. */
  async listCommissions(tenantId: TenantId): Promise<CommissionRecord[]> {
    return this.foldGrouped(await this.readByTenant(tenantId));
  }

  /** All commissions for one affiliate within a tenant. */
  async listCommissionsForAffiliate(
    tenantId: TenantId,
    affiliateId: AffiliateId,
  ): Promise<CommissionRecord[]> {
    return this.foldGrouped(await this.readByAffiliate(tenantId, affiliateId));
  }

  /** Derived per-currency balances aggregated across the whole tenant. */
  async tenantBalances(tenantId: TenantId): Promise<Balance[]> {
    return projectBalances(await this.readByTenant(tenantId));
  }

  private foldGrouped(events: readonly LedgerEvent[]): CommissionRecord[] {
    const byCommission = new Map<string, LedgerEvent[]>();
    for (const e of events) {
      const list = byCommission.get(e.commissionId) ?? [];
      list.push(e);
      byCommission.set(e.commissionId, list);
    }
    return [...byCommission.values()]
      .map((group) => foldCommission(group))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}
