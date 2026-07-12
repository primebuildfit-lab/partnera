import { type AffiliateId, type PayoutId, type TenantId } from "@partnera/core";
import {
  assertPayoutAppendable,
  foldPayout,
  type PayoutEvent,
  type PayoutRequest,
  type PayoutStore,
} from "@partnera/payment-engine";
import { type Collection, type RelationalStore } from "../relational/store";

const byOccurrence = (a: PayoutEvent, b: PayoutEvent): number =>
  a.occurredAt.getTime() - b.occurredAt.getTime();

/**
 * Append-only payout store. The payout twin of {@link
 * import("./ledger").LedgerRepository}: events are immutable, appends idempotent
 * by id, and the guarded path enforces the payout state machine before writing.
 */
export class PayoutRepository implements PayoutStore {
  constructor(
    private readonly store: RelationalStore,
    private readonly events: Collection<PayoutEvent>,
  ) {}

  async append(event: PayoutEvent): Promise<void> {
    this.events.insertIdempotent(event);
  }

  async appendGuarded(event: PayoutEvent): Promise<void> {
    await this.store.transact(async () => {
      const prior = await this.readByPayout(event.tenantId, event.payoutId);
      assertPayoutAppendable(prior, event);
      this.events.insertIdempotent(event);
    });
  }

  async readByPayout(tenantId: TenantId, payoutId: PayoutId): Promise<readonly PayoutEvent[]> {
    return this.events
      .find((e) => e.tenantId === tenantId && e.payoutId === payoutId)
      .sort(byOccurrence);
  }

  async readByAffiliate(
    tenantId: TenantId,
    affiliateId: AffiliateId,
  ): Promise<readonly PayoutEvent[]> {
    return this.events
      .find((e) => e.tenantId === tenantId && e.affiliateId === affiliateId)
      .sort(byOccurrence);
  }

  async getPayout(tenantId: TenantId, payoutId: PayoutId): Promise<PayoutRequest | null> {
    const events = await this.readByPayout(tenantId, payoutId);
    return events.length === 0 ? null : foldPayout(events);
  }

  async listByTenant(tenantId: TenantId): Promise<PayoutRequest[]> {
    const byPayout = new Map<string, PayoutEvent[]>();
    for (const e of this.events.find((x) => x.tenantId === tenantId)) {
      const list = byPayout.get(e.payoutId) ?? [];
      list.push(e);
      byPayout.set(e.payoutId, list);
    }
    return [...byPayout.values()].map((events) => foldPayout(events));
  }
}
