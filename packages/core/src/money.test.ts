import { describe, expect, it } from "vitest";
import { Money } from "./money";

describe("Money", () => {
  it("parses major-unit decimals into exact minor units", () => {
    expect(Money.parse("12.34", "USD").minorUnits).toBe(1234n);
    expect(Money.parse("0.05", "USD").minorUnits).toBe(5n);
    expect(Money.parse("-7.00", "USD").minorUnits).toBe(-700n);
    expect(Money.parse("1000", "JPY").minorUnits).toBe(1000n);
  });

  it("rejects too many decimal places for the currency", () => {
    expect(() => Money.parse("1.234", "USD")).toThrow();
    expect(() => Money.parse("1.5", "JPY")).toThrow();
  });

  it("adds and subtracts within a currency", () => {
    const a = Money.parse("10.00", "USD");
    const b = Money.parse("2.50", "USD");
    expect(a.add(b).toDecimalString()).toBe("12.50");
    expect(a.subtract(b).toDecimalString()).toBe("7.50");
  });

  it("refuses to combine different currencies", () => {
    expect(() => Money.parse("1.00", "USD").add(Money.parse("1.00", "EUR"))).toThrow();
  });

  it("applies basis points with half-away-from-zero rounding", () => {
    // 5% of $100.00 = $5.00
    expect(Money.parse("100.00", "USD").applyBasisPoints(500).toDecimalString()).toBe("5.00");
    // 7.5% of $10.05 = 0.75375 -> rounds to 0.75... check a rounding boundary:
    // 10% of $0.15 = 0.015 -> 2 cents (half away from zero rounds .5 up)
    expect(Money.parse("0.15", "USD").applyBasisPoints(1000).minorUnits).toBe(2n);
  });

  it("allocates without losing minor units (largest remainder)", () => {
    const parts = Money.parse("10.00", "USD").allocate([1, 1, 1]);
    const sum = parts.reduce((acc, m) => acc.add(m), Money.zero("USD"));
    expect(sum.toDecimalString()).toBe("10.00");
    expect(parts.map((p) => p.minorUnits)).toEqual([334n, 333n, 333n]);
  });

  it("round-trips through JSON", () => {
    const m = Money.parse("1234.56", "USD");
    const restored = Money.fromJSON(m.toJSON());
    expect(restored.equals(m)).toBe(true);
  });

  it("compares amounts", () => {
    const a = Money.parse("1.00", "USD");
    const b = Money.parse("2.00", "USD");
    expect(a.compare(b)).toBe(-1);
    expect(b.compare(a)).toBe(1);
    expect(a.compare(a)).toBe(0);
  });
});
