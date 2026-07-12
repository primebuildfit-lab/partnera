import { type CurrencyCode, minorUnitExponent, toCurrencyCode } from "./currency";
import { InvariantViolation } from "./errors";

/**
 * Immutable money value object.
 *
 * Amounts are stored as **integer minor units** in a `bigint` — never floats —
 * to eliminate rounding drift on a platform whose core job is paying people
 * accurately. All arithmetic is exact; rounding happens only where a business
 * rule demands it (e.g. applying a percentage) and is explicit and documented.
 *
 * Serialized form is `{ currency, minorUnits }` with `minorUnits` as a string,
 * because JSON has no bigint.
 */
/** JSON-safe serialized form of {@link Money} (strings, because JSON has no bigint). */
export interface MoneyJSON {
  readonly currency: string;
  readonly minorUnits: string;
}

export class Money {
  private constructor(
    readonly currency: CurrencyCode,
    readonly minorUnits: bigint,
  ) {}

  static ofMinor(minorUnits: bigint | number, currency: string | CurrencyCode): Money {
    const code = typeof currency === "string" ? toCurrencyCode(currency) : currency;
    return new Money(code, BigInt(minorUnits));
  }

  static zero(currency: string | CurrencyCode): Money {
    return Money.ofMinor(0n, currency);
  }

  /** Parse a major-unit decimal string (e.g. "12.34") into exact minor units. */
  static parse(major: string, currency: string | CurrencyCode): Money {
    const code = typeof currency === "string" ? toCurrencyCode(currency) : currency;
    const exponent = minorUnitExponent(code);
    const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(major.trim());
    if (!match) throw new InvariantViolation(`Invalid money literal: ${major}`);
    const [, sign, whole, frac = ""] = match;
    if (frac.length > exponent) {
      throw new InvariantViolation(
        `Too many decimal places for currency ${code}: "${major}" (max ${exponent})`,
      );
    }
    const padded = frac.padEnd(exponent, "0");
    const minor = BigInt(`${whole}${padded}`) * (sign ? -1n : 1n);
    return new Money(code, minor);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new InvariantViolation("Cannot combine Money of different currencies", {
        left: this.currency,
        right: other.currency,
      });
    }
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.currency, this.minorUnits + other.minorUnits);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.currency, this.minorUnits - other.minorUnits);
  }

  negate(): Money {
    return new Money(this.currency, -this.minorUnits);
  }

  multiplyByInt(factor: bigint | number): Money {
    return new Money(this.currency, this.minorUnits * BigInt(factor));
  }

  /**
   * Apply a rate expressed in basis points (1 bps = 0.01%). 500 bps = 5%.
   * Rounds half away from zero. This is the primitive the Commission Engine
   * uses for percentage offers.
   */
  applyBasisPoints(bps: number): Money {
    if (!Number.isInteger(bps)) {
      throw new InvariantViolation(`Basis points must be an integer, got ${bps}`);
    }
    return new Money(this.currency, divRoundHalfAwayFromZero(this.minorUnits * BigInt(bps), 10000n));
  }

  /**
   * Split this amount across integer `weights` with no unit lost. Remainder
   * pennies are distributed by the largest-remainder method so the parts always
   * sum back to the original (critical for revenue-share and multi-party splits).
   */
  allocate(weights: readonly number[]): Money[] {
    if (weights.length === 0) throw new InvariantViolation("allocate requires at least one weight");
    if (weights.some((w) => w < 0 || !Number.isFinite(w))) {
      throw new InvariantViolation("allocate weights must be non-negative finite numbers");
    }
    const total = weights.reduce((a, b) => a + b, 0);
    if (total === 0) throw new InvariantViolation("allocate weights must not sum to zero");

    const sign = this.minorUnits < 0n ? -1n : 1n;
    const abs = this.minorUnits < 0n ? -this.minorUnits : this.minorUnits;
    const bigTotal = BigInt(Math.round(total * 1_000_000));
    const scaled = weights.map((w) => BigInt(Math.round(w * 1_000_000)));

    const base = scaled.map((w) => (abs * w) / bigTotal);
    let distributed = base.reduce((a, b) => a + b, 0n);
    const remainders = scaled.map((w, i) => ({ i, rem: (abs * w) % bigTotal }));
    remainders.sort((a, b) => (b.rem > a.rem ? 1 : b.rem < a.rem ? -1 : 0));

    const out = [...base];
    let idx = 0;
    while (distributed < abs) {
      const target = remainders[idx % remainders.length]!.i;
      out[target] = out[target]! + 1n;
      distributed += 1n;
      idx += 1;
    }
    return out.map((m) => new Money(this.currency, m * sign));
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.minorUnits < other.minorUnits) return -1;
    if (this.minorUnits > other.minorUnits) return 1;
    return 0;
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.minorUnits === other.minorUnits;
  }

  get isZero(): boolean {
    return this.minorUnits === 0n;
  }

  get isNegative(): boolean {
    return this.minorUnits < 0n;
  }

  get isPositive(): boolean {
    return this.minorUnits > 0n;
  }

  /** Human-readable major-unit string, e.g. "1234.50" (no currency symbol). */
  toDecimalString(): string {
    const exponent = minorUnitExponent(this.currency);
    const sign = this.minorUnits < 0n ? "-" : "";
    const abs = (this.minorUnits < 0n ? -this.minorUnits : this.minorUnits).toString();
    if (exponent === 0) return `${sign}${abs}`;
    const padded = abs.padStart(exponent + 1, "0");
    const whole = padded.slice(0, -exponent);
    const frac = padded.slice(-exponent);
    return `${sign}${whole}.${frac}`;
  }

  toJSON(): MoneyJSON {
    return { currency: this.currency, minorUnits: this.minorUnits.toString() };
  }

  static fromJSON(json: MoneyJSON): Money {
    return Money.ofMinor(BigInt(json.minorUnits), json.currency);
  }
}

/** Divide `numerator / denominator` (denominator > 0), rounding half away from zero. */
function divRoundHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new InvariantViolation("denominator must be positive");
  const sign = numerator < 0n ? -1n : 1n;
  const abs = numerator < 0n ? -numerator : numerator;
  const rounded = (abs * 2n + denominator) / (denominator * 2n);
  return rounded * sign;
}
