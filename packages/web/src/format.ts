import { Money, type MoneyJSON } from "@partnera/core";

/** Presentation formatting helpers. Pure; no locale dependency beyond Intl. */

export function money(m: Money): string {
  return `${symbolFor(m.currency)}${m.toDecimalString()}`;
}

export function moneyJson(j: MoneyJSON): string {
  return money(Money.fromJSON(j));
}

export function minor(minorUnits: string | bigint, currency: string): string {
  return money(Money.ofMinor(BigInt(minorUnits), currency));
}

function symbolFor(currency: string): string {
  switch (currency) {
    case "USD":
    case "CAD":
    case "AUD":
      return "$";
    case "EUR":
      return "€";
    case "GBP":
      return "£";
    case "JPY":
      return "¥";
    default:
      return `${currency} `;
  }
}

export function date(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function dateTime(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export function num(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function percent(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

export function titleCase(s: string): string {
  return s
    .replace(/[_.]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
