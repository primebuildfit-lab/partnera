import { asId, type AffiliateId, type CommissionId, type PayoutId, type TenantId, type UserId } from "@partnera/core";
import { describe, expect, it } from "vitest";
import { foldPayout, type PayoutEvent, type PayoutEventId } from "./payout";
import { assertPayoutAppendable } from "./service";
import { applyPayoutTransition } from "./states";

const tenantId = asId<TenantId>("biz_1");
const affiliateId = asId<AffiliateId>("aff_1");
const payoutId = asId<PayoutId>("payout_1");
const actorUserId = asId<UserId>("user_1");

let seq = 0;
const at = (ms: number): Date => new Date(Date.parse("2026-02-01T00:00:00.000Z") + ms);
const evId = (): PayoutEventId => asId<PayoutEventId>(`pe_${++seq}`);

const requested = (): PayoutEvent => ({
  id: evId(),
  type: "payout.requested",
  tenantId,
  payoutId,
  affiliateId,
  occurredAt: at(0),
  correlationId: "c1",
  actorUserId,
  amount: { currency: "USD", minorUnits: "5000" },
  commissionIds: [asId<CommissionId>("com_1")],
  destinationRef: "dest_opaque",
});

const ev = (type: PayoutEvent["type"], ms: number, extra: Record<string, unknown> = {}): PayoutEvent =>
  ({
    id: evId(),
    type,
    tenantId,
    payoutId,
    affiliateId,
    occurredAt: at(ms),
    correlationId: "c1",
    actorUserId,
    ...extra,
  }) as PayoutEvent;

describe("payout state machine", () => {
  it("rejects illegal transitions", () => {
    expect(() => applyPayoutTransition("paid", "payout.approved")).toThrow();
    expect(() => applyPayoutTransition("requested", "payout.succeeded")).toThrow();
  });

  it("folds a happy path to paid", () => {
    const events: PayoutEvent[] = [
      requested(),
      ev("payout.approved", 1),
      ev("payout.execution_started", 2, { railName: "test" }),
      ev("payout.succeeded", 3, { providerRef: "prov_123" }),
    ];
    const p = foldPayout(events);
    expect(p.state).toBe("paid");
    expect(p.attempts).toBe(1);
    expect(p.providerRef).toBe("prov_123");
    expect(p.amount.toDecimalString()).toBe("50.00");
  });

  it("tracks retries after failure", () => {
    const events: PayoutEvent[] = [
      requested(),
      ev("payout.approved", 1),
      ev("payout.execution_started", 2, { railName: "test" }),
      ev("payout.failed", 3, { reason: "network" }),
      ev("payout.retry_scheduled", 4, { notBefore: at(100) }),
      ev("payout.execution_started", 5, { railName: "test" }),
      ev("payout.succeeded", 6, { providerRef: "prov_9" }),
    ];
    const p = foldPayout(events);
    expect(p.state).toBe("paid");
    expect(p.attempts).toBe(2);
    expect(p.lastFailureReason).toBe("network");
  });
});

describe("assertPayoutAppendable", () => {
  it("rejects a second requested", () => {
    const prior = [requested()];
    expect(() => assertPayoutAppendable(prior, requested())).toThrow(/existing payout/);
  });

  it("rejects an event before requested", () => {
    expect(() => assertPayoutAppendable([], ev("payout.approved", 1))).toThrow();
  });

  it("rejects paying an unapproved payout", () => {
    const prior = [requested()];
    expect(() =>
      assertPayoutAppendable(prior, ev("payout.execution_started", 1, { railName: "t" })),
    ).toThrow(/Illegal payout transition/);
  });

  it("accepts a legal approval", () => {
    const prior = [requested()];
    expect(() => assertPayoutAppendable(prior, ev("payout.approved", 1))).not.toThrow();
  });
});
