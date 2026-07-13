import {
  type BusinessId,
  type MoneyJSON,
  type Result,
  type TenantId,
  err,
  IllegalStateError,
  Money,
  ok,
} from "@partnera/core";
import { type FeeSnapshot } from "./config";
import {
  type CreatorId,
  type CreatorLedgerEventId,
  type CreatorPaymentId,
} from "./ids";
import { type PaymentReason } from "./vocab";

/**
 * The creator-payment money spine.
 *
 * Creator money is an **append-only event stream with derived balances and
 * compensating reversals** — the same discipline as the commission ledger
 * (D-006/D-315), implemented as a **distinct stream** exactly as
 * `@partnera/payment-engine` already keeps payout events separate from
 * commission events. It is keyed on creator + business + payment, not
 * affiliate + commission. Balances are always folded from the stream; nothing is
 * edited. A refund/chargeback appends `payment.reversed` + `platform_fee.reversed`,
 * never a destructive edit.
 */
interface CreatorLedgerBase {
  readonly id: CreatorLedgerEventId;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly creatorId: CreatorId;
  readonly paymentId: CreatorPaymentId;
  readonly occurredAt: Date;
  readonly correlationId: string;
}

export type CreatorLedgerEvent =
  | (CreatorLedgerBase & {
      readonly type: "payment.authorized";
      readonly reason: PaymentReason;
      /** Gross amount owed to the creator for the deliverable. */
      readonly gross: MoneyJSON;
      /** Creator's net after any creator-borne fee. */
      readonly creatorNet: MoneyJSON;
      /** Total cost to the business (gross + business-borne fee). */
      readonly businessCost: MoneyJSON;
      readonly feeSnapshot: FeeSnapshot;
      readonly authorizerUserId: string;
    })
  | (CreatorLedgerBase & { readonly type: "platform_fee.recognized"; readonly fee: MoneyJSON })
  | (CreatorLedgerBase & { readonly type: "payment.processing" })
  | (CreatorLedgerBase & { readonly type: "payment.paid"; readonly providerRef: string })
  | (CreatorLedgerBase & { readonly type: "payment.failed"; readonly reason: string })
  | (CreatorLedgerBase & { readonly type: "payment.reversed"; readonly reason: string })
  | (CreatorLedgerBase & { readonly type: "platform_fee.reversed"; readonly reason: string });

export type CreatorLedgerEventType = CreatorLedgerEvent["type"];

/** Result of applying a fee snapshot to a gross amount. All exact (no floats). */
export interface FeeComputation {
  readonly gross: Money;
  readonly fee: Money;
  readonly creatorNet: Money;
  readonly businessCost: Money;
}

/**
 * Apply a fee snapshot to a gross amount. Business-paid (default): the creator
 * receives the full gross and the business pays gross + fee. Creator-paid: the
 * fee is deducted from the creator's net; business pays gross. Fee is exact via
 * {@link Money.applyBasisPoints}.
 */
export function computeFee(gross: Money, snapshot: FeeSnapshot): FeeComputation {
  const fee = gross.applyBasisPoints(snapshot.rateBps);
  if (snapshot.payer === "creator") {
    return { gross, fee, creatorNet: gross.subtract(fee), businessCost: gross };
  }
  return { gross, fee, creatorNet: gross, businessCost: gross.add(fee) };
}

/** Legal successor event types on the creator-payment stream (mirrors PAYMENT_TRANSITIONS). */
const APPENDABLE_AFTER: Readonly<Record<CreatorLedgerEventType, readonly CreatorLedgerEventType[]>> = {
  "payment.authorized": ["platform_fee.recognized"],
  "platform_fee.recognized": ["payment.processing", "payment.reversed"],
  "payment.processing": ["payment.paid", "payment.failed"],
  "payment.paid": ["payment.reversed"],
  "payment.failed": ["payment.processing"],
  "payment.reversed": ["platform_fee.reversed"],
  "platform_fee.reversed": [],
};

/**
 * Guard an append against the prior event stream for one payment. The first
 * event must be `payment.authorized`; subsequent events must be legal successors
 * of the latest event. Rejects illegal transitions before any write.
 */
export function assertCreatorAppendable(
  prior: readonly CreatorLedgerEvent[],
  next: CreatorLedgerEvent,
): Result<CreatorLedgerEvent, IllegalStateError> {
  if (prior.length === 0) {
    if (next.type !== "payment.authorized") {
      return err(
        new IllegalStateError("First creator-payment event must be payment.authorized", {
          got: next.type,
        }),
      );
    }
    return ok(next);
  }
  const last = prior[prior.length - 1]!;
  if (!APPENDABLE_AFTER[last.type].includes(next.type)) {
    return err(
      new IllegalStateError(`Illegal creator-payment transition: ${last.type} -> ${next.type}`, {
        from: last.type,
        to: next.type,
      }),
    );
  }
  return ok(next);
}

/** Per-currency derived balances for a creator. Never stored as truth. */
export interface CreatorBalance {
  readonly currency: string;
  /** Authorized but not yet paid. */
  readonly pending: MoneyJSON;
  readonly paid: MoneyJSON;
  readonly reversed: MoneyJSON;
}

/**
 * Fold a creator's event stream into per-currency balances. Deterministic; the
 * single source of balance truth. `pending` = authorized net not yet paid or
 * reversed; `paid` = confirmed; `reversed` = compensated back out.
 */
export function foldCreatorBalances(events: readonly CreatorLedgerEvent[]): CreatorBalance[] {
  const pending = new Map<string, Money>();
  const paid = new Map<string, Money>();
  const reversed = new Map<string, Money>();
  const add = (m: Map<string, Money>, money: Money) => {
    const cur = m.get(money.currency) ?? Money.zero(money.currency);
    m.set(money.currency, cur.add(money));
  };

  // Track each payment's net + currency + paid state to move amounts correctly.
  const nets = new Map<string, Money>();
  const isPaid = new Map<string, boolean>();

  for (const e of events) {
    if (e.type === "payment.authorized") {
      const net = Money.fromJSON(e.creatorNet);
      nets.set(e.paymentId, net);
      add(pending, net);
    } else if (e.type === "payment.paid") {
      const net = nets.get(e.paymentId);
      if (net) {
        add(pending, net.negate());
        add(paid, net);
        isPaid.set(e.paymentId, true);
      }
    } else if (e.type === "payment.reversed") {
      const net = nets.get(e.paymentId);
      if (net) {
        if (isPaid.get(e.paymentId)) add(paid, net.negate());
        else add(pending, net.negate());
        add(reversed, net);
      }
    }
  }

  const currencies = new Set<string>([...pending.keys(), ...paid.keys(), ...reversed.keys()]);
  return [...currencies].map((currency) => ({
    currency,
    pending: (pending.get(currency) ?? Money.zero(currency)).toJSON(),
    paid: (paid.get(currency) ?? Money.zero(currency)).toJSON(),
    reversed: (reversed.get(currency) ?? Money.zero(currency)).toJSON(),
  }));
}
