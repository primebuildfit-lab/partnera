import { asId, Money } from "@partnera/core";
import { describe, expect, it } from "vitest";
import { type RevenueEvent, type RevenueEventId, foldRevenue } from "./revenue";
import { type VaultEvent, type VaultEventId, foldVault } from "./vault";
import { computeMonthlyClose } from "./close";

const usd = (major: string) => Money.parse(major, "USD").toJSON();
const rid = (n: string) => asId<RevenueEventId>(n);
const vid = (n: string) => asId<VaultEventId>(n);
const base = { occurredAt: new Date("2026-07-01T00:00:00Z"), correlationId: "c" };

describe("Bank A — Revenue Account", () => {
  it("derives available = gross - refunds - reversed - reserved - withdrawn (exact, no float)", () => {
    const events: RevenueEvent[] = [
      { ...base, id: rid("r1"), type: "revenue.recognized", source: "membership", amount: usd("100.00") },
      { ...base, id: rid("r2"), type: "revenue.recognized", source: "platform_fee", amount: usd("1.05") },
      { ...base, id: rid("r3"), type: "revenue.refunded", amount: usd("10.00"), reason: "x" },
      { ...base, id: rid("r4"), type: "revenue.reserved", amount: usd("20.00"), reason: "buffer" },
      { ...base, id: rid("r5"), type: "revenue.withdrawn", amount: usd("30.00"), reference: "wd1" },
    ];
    const b = foldRevenue(events);
    expect(Money.fromJSON(b.gross).toDecimalString()).toBe("101.05");
    expect(Money.fromJSON(b.available).toDecimalString()).toBe("41.05"); // 101.05 -10 -20 -30
  });

  it("release reduces reserved", () => {
    const events: RevenueEvent[] = [
      { ...base, id: rid("r1"), type: "revenue.recognized", source: "membership", amount: usd("100.00") },
      { ...base, id: rid("r2"), type: "revenue.reserved", amount: usd("40.00"), reason: "b" },
      { ...base, id: rid("r3"), type: "revenue.released", amount: usd("15.00"), reason: "b" },
    ];
    const b = foldRevenue(events);
    expect(Money.fromJSON(b.reserved).toDecimalString()).toBe("25.00");
    expect(Money.fromJSON(b.available).toDecimalString()).toBe("75.00");
  });
});

describe("Bank B — Vault (managed third-party funds)", () => {
  it("derives held and available; payout reduces committed and held", () => {
    const events: VaultEvent[] = [
      { ...base, id: vid("v1"), businessId: "biz_1", type: "vault.deposited", amount: usd("1000.00") },
      { ...base, id: vid("v2"), businessId: "biz_1", type: "vault.committed", amount: usd("300.00"), toward: "job1" },
      { ...base, id: vid("v3"), businessId: "biz_1", type: "vault.reserved", amount: usd("100.00"), reason: "r" },
      { ...base, id: vid("v4"), businessId: "biz_1", type: "vault.paid_out", amount: usd("120.00"), reference: "p1" },
    ];
    const b = foldVault(events);
    expect(Money.fromJSON(b.held).toDecimalString()).toBe("880.00"); // 1000 - 120 paid
    expect(Money.fromJSON(b.committed).toDecimalString()).toBe("180.00"); // 300 - 120
    expect(Money.fromJSON(b.available).toDecimalString()).toBe("600.00"); // 880 - 180 - 100
  });
});

describe("separation — the two books never commingle", () => {
  it("a vault deposit does not change revenue, and vice versa", () => {
    const rev = foldRevenue([{ ...base, id: rid("r1"), type: "revenue.recognized", source: "membership", amount: usd("50.00") }]);
    const vault = foldVault([{ ...base, id: vid("v1"), businessId: "biz_1", type: "vault.deposited", amount: usd("9000.00") }]);
    // Revenue is unaffected by the vault deposit; vault is not revenue.
    expect(Money.fromJSON(rev.available).toDecimalString()).toBe("50.00");
    expect(Money.fromJSON(vault.held).toDecimalString()).toBe("9000.00");
    // There is no field on either balance that sums the other book.
    expect(Object.keys(rev)).not.toContain("held");
    expect(Object.keys(vault)).not.toContain("available_revenue");
  });
});

describe("monthly close (Revenue only; Vault excluded)", () => {
  it("available = gross - refunds - costs - taxes - reserve - obligations", () => {
    const revenue = foldRevenue([
      { ...base, id: rid("r1"), type: "revenue.recognized", source: "membership", amount: usd("10000.00") },
      { ...base, id: rid("r2"), type: "revenue.refunded", amount: usd("500.00"), reason: "x" },
    ]);
    const close = computeMonthlyClose({
      period: "2026-07", revenue,
      estimatedCosts: usd("1500.00"), estimatedTaxes: usd("1000.00"),
      operatingReserve: usd("2000.00"), obligations: usd("800.00"),
    });
    // 10000 - 500 - 1500 - 1000 - 2000 - 800 = 4200
    expect(Money.fromJSON(close.available).toDecimalString()).toBe("4200.00");
  });
});
