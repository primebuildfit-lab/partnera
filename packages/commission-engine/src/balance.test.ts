import {
  asId,
  type AffiliateId,
  type CommissionId,
  type ConversionId,
  type LedgerEventId,
  Money,
  type OfferId,
  type PayoutId,
  type TenantId,
} from "@partnera/core";
import { describe, expect, it } from "vitest";
import { projectBalances } from "./balance";
import { foldCommission } from "./commission";
import { type LedgerEvent } from "./ledger";
import { assertAppendable } from "./service";

const tenantId = asId<TenantId>("biz_1");
const affiliateId = asId<AffiliateId>("aff_1");
let seq = 0;
const nextEventId = () => asId<LedgerEventId>(`evt_${++seq}`);

function created(commissionId: CommissionId, amount: string, at: string): LedgerEvent {
  return {
    id: nextEventId(),
    tenantId,
    affiliateId,
    commissionId,
    occurredAt: new Date(at),
    correlationId: "corr_1",
    type: "commission.created",
    conversionId: asId<ConversionId>("conv_1"),
    offerId: asId<OfferId>("offer_1"),
    offerVersion: 1,
    amount: Money.parse(amount, "USD").toJSON(),
    rewardKind: "cash",
    reasonPath: ["offer:offer_1@v1"],
  };
}

function simple(
  type: "commission.approved" | "commission.held" | "commission.released",
  commissionId: CommissionId,
  at: string,
): LedgerEvent {
  return {
    id: nextEventId(),
    tenantId,
    affiliateId,
    commissionId,
    occurredAt: new Date(at),
    correlationId: "corr_1",
    type,
  };
}

describe("commission ledger projection", () => {
  it("moves an amount pending → available → paid as events append", () => {
    const c = asId<CommissionId>("comm_1");
    const events: LedgerEvent[] = [
      created(c, "10.00", "2026-06-01T00:00:00Z"),
      simple("commission.approved", c, "2026-06-10T00:00:00Z"),
      {
        id: nextEventId(),
        tenantId,
        affiliateId,
        commissionId: c,
        occurredAt: new Date("2026-06-20T00:00:00Z"),
        correlationId: "corr_1",
        type: "commission.paid",
        payoutId: asId<PayoutId>("payout_1"),
      },
    ];
    const [balance] = projectBalances(events);
    expect(balance?.paid.toDecimalString()).toBe("10.00");
    expect(balance?.available.toDecimalString()).toBe("0.00");
    expect(balance?.pending.toDecimalString()).toBe("0.00");
  });

  it("applies adjustments as new events without editing history", () => {
    const c = asId<CommissionId>("comm_2");
    const events: LedgerEvent[] = [
      created(c, "10.00", "2026-06-01T00:00:00Z"),
      {
        id: nextEventId(),
        tenantId,
        affiliateId,
        commissionId: c,
        occurredAt: new Date("2026-06-02T00:00:00Z"),
        correlationId: "corr_1",
        type: "commission.adjusted",
        delta: Money.parse("-2.50", "USD").toJSON(),
        reason: "partial refund correction",
      },
    ];
    const record = foldCommission(events);
    expect(record.amount.toDecimalString()).toBe("7.50");
    expect(record.state).toBe("pending");
  });

  it("keeps reversed amounts in their own bucket", () => {
    const c = asId<CommissionId>("comm_3");
    const events: LedgerEvent[] = [
      created(c, "20.00", "2026-06-01T00:00:00Z"),
      simple("commission.approved", c, "2026-06-05T00:00:00Z"),
      {
        id: nextEventId(),
        tenantId,
        affiliateId,
        commissionId: c,
        occurredAt: new Date("2026-06-06T00:00:00Z"),
        correlationId: "corr_1",
        type: "commission.reversed",
        reason: "order refunded",
      },
    ];
    const [balance] = projectBalances(events);
    expect(balance?.reversed.toDecimalString()).toBe("20.00");
    expect(balance?.available.toDecimalString()).toBe("0.00");
  });

  it("rejects an illegal transition at the append boundary", () => {
    const c = asId<CommissionId>("comm_4");
    const prior = [created(c, "5.00", "2026-06-01T00:00:00Z"), simple("commission.approved", c, "2026-06-02T00:00:00Z")];
    const paid: LedgerEvent = {
      id: nextEventId(),
      tenantId,
      affiliateId,
      commissionId: c,
      occurredAt: new Date("2026-06-03T00:00:00Z"),
      correlationId: "corr_1",
      type: "commission.paid",
      payoutId: asId<PayoutId>("payout_2"),
    };
    // approved → paid is legal:
    expect(() => assertAppendable(prior, paid)).not.toThrow();
    // but a second created is not:
    expect(() => assertAppendable(prior, created(c, "5.00", "2026-06-04T00:00:00Z"))).toThrow();
  });
});
