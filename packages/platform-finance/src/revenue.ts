import { type MoneyJSON, Money } from "@partnera/core";
import { type RevenueEventId } from "./ids";

/**
 * Bank A — Partnera Revenue Account. Money Partnera owns. Append-only events;
 * balance is derived. Corrections are compensating events (refund/reversal),
 * never edits.
 */
export const REVENUE_SOURCES = [
  "membership",
  "platform_fee",
  "platform_commission",
  "service",
  "transfer_fee",
  "integration",
  "other",
] as const;
export type RevenueSource = (typeof REVENUE_SOURCES)[number];

interface RevenueBase {
  readonly id: RevenueEventId;
  readonly occurredAt: Date;
  readonly correlationId: string;
  /** Optional links for reporting (never used to mutate other ledgers). */
  readonly businessId?: string;
  readonly userId?: string;
  readonly planKey?: string;
  readonly country?: string;
}

export type RevenueEvent =
  | (RevenueBase & { readonly type: "revenue.recognized"; readonly source: RevenueSource; readonly amount: MoneyJSON })
  | (RevenueBase & { readonly type: "revenue.refunded"; readonly amount: MoneyJSON; readonly reason: string })
  | (RevenueBase & { readonly type: "revenue.reversed"; readonly amount: MoneyJSON; readonly reason: string })
  | (RevenueBase & { readonly type: "revenue.reserved"; readonly amount: MoneyJSON; readonly reason: string })
  | (RevenueBase & { readonly type: "revenue.released"; readonly amount: MoneyJSON; readonly reason: string })
  | (RevenueBase & { readonly type: "revenue.withdrawn"; readonly amount: MoneyJSON; readonly reference: string });

export interface RevenueBalance {
  readonly currency: string;
  readonly gross: MoneyJSON; // recognized
  readonly refunded: MoneyJSON;
  readonly reversed: MoneyJSON;
  readonly reserved: MoneyJSON; // held back (operating reserve)
  readonly withdrawn: MoneyJSON;
  readonly available: MoneyJSON; // gross - refunded - reversed - reserved - withdrawn
}

/** Fold a currency-homogeneous revenue stream into a derived balance. */
export function foldRevenue(events: readonly RevenueEvent[], currency = "USD"): RevenueBalance {
  const z = () => Money.zero(currency);
  let gross = z(), refunded = z(), reversed = z(), reserved = z(), withdrawn = z();
  for (const e of events) {
    const m = Money.fromJSON(e.amount);
    switch (e.type) {
      case "revenue.recognized": gross = gross.add(m); break;
      case "revenue.refunded": refunded = refunded.add(m); break;
      case "revenue.reversed": reversed = reversed.add(m); break;
      case "revenue.reserved": reserved = reserved.add(m); break;
      case "revenue.released": reserved = reserved.subtract(m); break;
      case "revenue.withdrawn": withdrawn = withdrawn.add(m); break;
    }
  }
  const available = gross.subtract(refunded).subtract(reversed).subtract(reserved).subtract(withdrawn);
  return {
    currency,
    gross: gross.toJSON(), refunded: refunded.toJSON(), reversed: reversed.toJSON(),
    reserved: reserved.toJSON(), withdrawn: withdrawn.toJSON(), available: available.toJSON(),
  };
}

/** Revenue events are append-only: this guard exists to make that explicit. */
export function isRevenueEvent(value: { type?: string }): value is RevenueEvent {
  return typeof value.type === "string" && value.type.startsWith("revenue.");
}
