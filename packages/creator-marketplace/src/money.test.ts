import { asId, type BusinessId, type TenantId, Money } from "@partnera/core";
import { describe, expect, it } from "vitest";
import { type FeeSnapshot } from "./config";
import {
  assertCreatorAppendable,
  computeFee,
  type CreatorLedgerEvent,
  foldCreatorBalances,
} from "./money";
import {
  type CreatorId,
  type CreatorLedgerEventId,
  type CreatorPaymentId,
} from "./ids";

const snapshot = (rateBps: number, payer: "business" | "creator"): FeeSnapshot => ({
  rateBps,
  payer,
  configVersion: 1,
  snapshotAt: new Date("2026-07-12T00:00:00Z"),
});

describe("computeFee", () => {
  it("business-paid: creator keeps full gross, business pays gross + fee", () => {
    const r = computeFee(Money.parse("100.00", "USD"), snapshot(300, "business"));
    expect(r.fee.toDecimalString()).toBe("3.00");
    expect(r.creatorNet.toDecimalString()).toBe("100.00");
    expect(r.businessCost.toDecimalString()).toBe("103.00");
  });
  it("creator-paid: fee deducted from creator net, business pays gross", () => {
    const r = computeFee(Money.parse("100.00", "USD"), snapshot(400, "creator"));
    expect(r.fee.toDecimalString()).toBe("4.00");
    expect(r.creatorNet.toDecimalString()).toBe("96.00");
    expect(r.businessCost.toDecimalString()).toBe("100.00");
  });
});

const base = (id: string, paymentId: string) => ({
  id: asId<CreatorLedgerEventId>(id),
  tenantId: asId<TenantId>("biz_1"),
  businessId: asId<BusinessId>("biz_1"),
  creatorId: asId<CreatorId>("creator_1"),
  paymentId: asId<CreatorPaymentId>(paymentId),
  occurredAt: new Date("2026-07-12T00:00:00Z"),
  correlationId: "corr_1",
});

const authorized = (id: string, paymentId: string, net: string): CreatorLedgerEvent => ({
  ...base(id, paymentId),
  type: "payment.authorized",
  reason: "deliverable",
  gross: Money.parse(net, "USD").toJSON(),
  creatorNet: Money.parse(net, "USD").toJSON(),
  businessCost: Money.parse(net, "USD").toJSON(),
  feeSnapshot: snapshot(300, "business"),
  authorizerUserId: "user_finance",
});

describe("creator-payment append guard", () => {
  it("requires payment.authorized first", () => {
    const evt: CreatorLedgerEvent = { ...base("e1", "p1"), type: "payment.paid", providerRef: "sim" };
    expect(assertCreatorAppendable([], evt).ok).toBe(false);
  });
  it("rejects paid before processing", () => {
    const prior = [authorized("e1", "p1", "50.00")];
    const paid: CreatorLedgerEvent = { ...base("e2", "p1"), type: "payment.paid", providerRef: "sim" };
    expect(assertCreatorAppendable(prior, paid).ok).toBe(false);
  });
  it("accepts the legal authorized → fee → processing → paid chain", () => {
    const e1 = authorized("e1", "p1", "50.00");
    const e2: CreatorLedgerEvent = { ...base("e2", "p1"), type: "platform_fee.recognized", fee: Money.parse("1.50", "USD").toJSON() };
    const e3: CreatorLedgerEvent = { ...base("e3", "p1"), type: "payment.processing" };
    const e4: CreatorLedgerEvent = { ...base("e4", "p1"), type: "payment.paid", providerRef: "sim" };
    expect(assertCreatorAppendable([], e1).ok).toBe(true);
    expect(assertCreatorAppendable([e1], e2).ok).toBe(true);
    expect(assertCreatorAppendable([e1, e2], e3).ok).toBe(true);
    expect(assertCreatorAppendable([e1, e2, e3], e4).ok).toBe(true);
  });
});

describe("foldCreatorBalances", () => {
  it("moves net from pending to paid on payment.paid", () => {
    const events: CreatorLedgerEvent[] = [
      authorized("e1", "p1", "50.00"),
      { ...base("e3", "p1"), type: "payment.processing" },
      { ...base("e4", "p1"), type: "payment.paid", providerRef: "sim" },
    ];
    const [bal] = foldCreatorBalances(events);
    expect(Money.fromJSON(bal!.pending).toDecimalString()).toBe("0.00");
    expect(Money.fromJSON(bal!.paid).toDecimalString()).toBe("50.00");
  });
  it("reversal after paid nets paid back out and records reversed", () => {
    const events: CreatorLedgerEvent[] = [
      authorized("e1", "p1", "50.00"),
      { ...base("e2", "p1"), type: "payment.processing" },
      { ...base("e3", "p1"), type: "payment.paid", providerRef: "sim" },
      { ...base("e4", "p1"), type: "payment.reversed", reason: "refund" },
    ];
    const [bal] = foldCreatorBalances(events);
    expect(Money.fromJSON(bal!.paid).toDecimalString()).toBe("0.00");
    expect(Money.fromJSON(bal!.reversed).toDecimalString()).toBe("50.00");
  });
});
