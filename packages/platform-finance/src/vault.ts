import { type MoneyJSON, Money } from "@partnera/core";
import { type VaultEventId } from "./ids";

/**
 * Bank B — Partnera Vault. Third-party funds Partnera manages temporarily. This
 * money is NOT revenue and can NEVER be used for Partnera's expenses. Append-only
 * events; balance derived; corrections are compensating events. Structurally
 * separate from {@link import("./revenue").RevenueEvent} — different ids,
 * different stream, different fold — so the two books can never be commingled.
 */
export const VAULT_KINDS = [
  "business_deposit",
  "committed",
  "reserved",
  "disputed",
  "payout",
  "refund",
  "released",
  "guarantee",
] as const;
export type VaultKind = (typeof VAULT_KINDS)[number];

interface VaultBase {
  readonly id: VaultEventId;
  /** The business whose funds these are (owner of the managed money). */
  readonly businessId: string;
  readonly occurredAt: Date;
  readonly correlationId: string;
}

export type VaultEvent =
  | (VaultBase & { readonly type: "vault.deposited"; readonly amount: MoneyJSON })
  | (VaultBase & { readonly type: "vault.committed"; readonly amount: MoneyJSON; readonly toward: string })
  | (VaultBase & { readonly type: "vault.reserved"; readonly amount: MoneyJSON; readonly reason: string })
  | (VaultBase & { readonly type: "vault.disputed"; readonly amount: MoneyJSON; readonly caseId: string })
  | (VaultBase & { readonly type: "vault.paid_out"; readonly amount: MoneyJSON; readonly reference: string })
  | (VaultBase & { readonly type: "vault.refunded"; readonly amount: MoneyJSON; readonly reason: string })
  | (VaultBase & { readonly type: "vault.released"; readonly amount: MoneyJSON; readonly reason: string })
  | (VaultBase & { readonly type: "vault.guarantee"; readonly amount: MoneyJSON });

export interface VaultBalance {
  readonly currency: string;
  readonly deposited: MoneyJSON;
  readonly committed: MoneyJSON;
  readonly reserved: MoneyJSON;
  readonly disputed: MoneyJSON;
  readonly paidOut: MoneyJSON;
  readonly refunded: MoneyJSON;
  readonly guarantee: MoneyJSON;
  /** Managed funds currently held = deposited - paidOut - refunded. */
  readonly held: MoneyJSON;
  /** Unallocated = held - committed - reserved - disputed - guarantee. */
  readonly available: MoneyJSON;
}

/** Fold a currency-homogeneous vault stream into a derived balance. */
export function foldVault(events: readonly VaultEvent[], currency = "USD"): VaultBalance {
  const z = () => Money.zero(currency);
  let deposited = z(), committed = z(), reserved = z(), disputed = z(), paidOut = z(), refunded = z(), guarantee = z();
  for (const e of events) {
    const m = Money.fromJSON(e.amount);
    switch (e.type) {
      case "vault.deposited": deposited = deposited.add(m); break;
      case "vault.committed": committed = committed.add(m); break;
      case "vault.reserved": reserved = reserved.add(m); break;
      case "vault.disputed": disputed = disputed.add(m); break;
      case "vault.paid_out": paidOut = paidOut.add(m); committed = committed.subtract(m); break;
      case "vault.refunded": refunded = refunded.add(m); break;
      case "vault.released": committed = committed.subtract(m); break;
      case "vault.guarantee": guarantee = guarantee.add(m); break;
    }
  }
  const held = deposited.subtract(paidOut).subtract(refunded);
  const available = held.subtract(committed).subtract(reserved).subtract(disputed).subtract(guarantee);
  return {
    currency,
    deposited: deposited.toJSON(), committed: committed.toJSON(), reserved: reserved.toJSON(),
    disputed: disputed.toJSON(), paidOut: paidOut.toJSON(), refunded: refunded.toJSON(),
    guarantee: guarantee.toJSON(), held: held.toJSON(), available: available.toJSON(),
  };
}

export function isVaultEvent(value: { type?: string }): value is VaultEvent {
  return typeof value.type === "string" && value.type.startsWith("vault.");
}
