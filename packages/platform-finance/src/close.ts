import { type MoneyJSON, Money } from "@partnera/core";
import { type RevenueBalance } from "./revenue";

/**
 * Monthly close for the Revenue Account (Bank A only — the Vault is never part of
 * a close because it is not revenue). Pure computation over a period's revenue
 * balance plus estimated costs/taxes; the operator records a decision (withdraw /
 * reserve / reinvest / keep as buffer). No money moves here.
 */
export type CloseDecision = "withdraw" | "reserve" | "reinvest" | "buffer";

export interface MonthlyCloseInput {
  readonly period: string; // e.g. "2026-07"
  readonly revenue: RevenueBalance;
  readonly estimatedCosts: MoneyJSON;
  readonly estimatedTaxes: MoneyJSON;
  readonly operatingReserve: MoneyJSON;
  readonly obligations: MoneyJSON; // amounts owed out (not Vault; e.g. provider fees)
}

export interface MonthlyCloseResult {
  readonly period: string;
  readonly currency: string;
  readonly grossRevenue: MoneyJSON;
  readonly refunds: MoneyJSON;
  readonly costs: MoneyJSON;
  readonly taxes: MoneyJSON;
  readonly reserve: MoneyJSON;
  readonly obligations: MoneyJSON;
  readonly available: MoneyJSON; // gross - refunds - costs - taxes - reserve - obligations
}

export function computeMonthlyClose(input: MonthlyCloseInput): MonthlyCloseResult {
  const cur = input.revenue.currency;
  const gross = Money.fromJSON(input.revenue.gross);
  const refunds = Money.fromJSON(input.revenue.refunded).add(Money.fromJSON(input.revenue.reversed));
  const costs = Money.fromJSON(input.estimatedCosts);
  const taxes = Money.fromJSON(input.estimatedTaxes);
  const reserve = Money.fromJSON(input.operatingReserve);
  const obligations = Money.fromJSON(input.obligations);
  const available = gross.subtract(refunds).subtract(costs).subtract(taxes).subtract(reserve).subtract(obligations);
  return {
    period: input.period, currency: cur,
    grossRevenue: gross.toJSON(), refunds: refunds.toJSON(), costs: costs.toJSON(),
    taxes: taxes.toJSON(), reserve: reserve.toJSON(), obligations: obligations.toJSON(),
    available: available.toJSON(),
  };
}
