import { type AffiliateId, Money } from "@partnera/core";
import { foldCommission, type CommissionRecord } from "./commission";
import { type LedgerEvent } from "./ledger";

/**
 * An affiliate's derived balance, per currency. All four buckets come from
 * folding the ledger; the platform never writes a balance number directly.
 *
 *  - pending   : created / held (not yet approved)
 *  - available : approved, not yet paid
 *  - paid      : disbursed
 *  - reversed  : clawed back (magnitude of reversals)
 */
export interface Balance {
  readonly affiliateId: AffiliateId;
  readonly currency: string;
  readonly pending: Money;
  readonly available: Money;
  readonly paid: Money;
  readonly reversed: Money;
}

interface MutableBuckets {
  pending: Money;
  available: Money;
  paid: Money;
  reversed: Money;
}

function emptyBuckets(currency: string): MutableBuckets {
  return {
    pending: Money.zero(currency),
    available: Money.zero(currency),
    paid: Money.zero(currency),
    reversed: Money.zero(currency),
  };
}

function bucketFor(record: CommissionRecord, buckets: MutableBuckets): void {
  switch (record.state) {
    case "pending":
    case "held":
      buckets.pending = buckets.pending.add(record.amount);
      break;
    case "approved":
      buckets.available = buckets.available.add(record.amount);
      break;
    case "paid":
      buckets.paid = buckets.paid.add(record.amount);
      break;
    case "reversed":
      buckets.reversed = buckets.reversed.add(record.amount);
      break;
    case "rejected":
      break;
  }
}

/**
 * Project balances for every (affiliate, currency) present in the events.
 * A production system would snapshot these projections for performance, but the
 * derivation remains the single source of truth (see docs/21-risks.md E1).
 */
export function projectBalances(events: readonly LedgerEvent[]): Balance[] {
  const byCommission = new Map<string, LedgerEvent[]>();
  for (const event of events) {
    const list = byCommission.get(event.commissionId) ?? [];
    list.push(event);
    byCommission.set(event.commissionId, list);
  }

  const byKey = new Map<string, { affiliateId: AffiliateId; currency: string; buckets: MutableBuckets }>();
  for (const group of byCommission.values()) {
    const record = foldCommission(group);
    const currency = record.amount.currency;
    const key = `${record.affiliateId}:${currency}`;
    const entry =
      byKey.get(key) ??
      { affiliateId: record.affiliateId, currency, buckets: emptyBuckets(currency) };
    bucketFor(record, entry.buckets);
    byKey.set(key, entry);
  }

  return [...byKey.values()].map((e) => ({
    affiliateId: e.affiliateId,
    currency: e.currency,
    pending: e.buckets.pending,
    available: e.buckets.available,
    paid: e.buckets.paid,
    reversed: e.buckets.reversed,
  }));
}
