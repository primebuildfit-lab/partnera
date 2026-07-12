import { type Brand, brandValue } from "./branded";

/** ISO 4217 currency code (validated at boundaries). */
export type CurrencyCode = Brand<string, "CurrencyCode">;

/**
 * Minor-unit exponents for currencies Partnera supports at the kernel level.
 * The list is intentionally small and extended as markets are added; it exists
 * so {@link Money} can round and format correctly. It is *data*, not logic.
 */
const MINOR_UNIT_EXPONENTS: Readonly<Record<string, number>> = {
  USD: 2,
  EUR: 2,
  GBP: 2,
  CAD: 2,
  AUD: 2,
  JPY: 0,
  KRW: 0,
  CLP: 0,
  BHD: 3,
  KWD: 3,
};

export function isSupportedCurrency(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(MINOR_UNIT_EXPONENTS, code);
}

export function toCurrencyCode(code: string): CurrencyCode {
  const upper = code.toUpperCase();
  if (!isSupportedCurrency(upper)) {
    throw new RangeError(`Unsupported currency code: ${code}`);
  }
  return brandValue<CurrencyCode>(upper);
}

/** Number of minor units per major unit (e.g. cents per dollar). */
export function minorUnitExponent(code: CurrencyCode): number {
  return MINOR_UNIT_EXPONENTS[code] ?? 2;
}
