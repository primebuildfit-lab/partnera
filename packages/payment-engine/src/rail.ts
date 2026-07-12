import { type AffiliateId, type MoneyJSON, type PayoutId, type TenantId } from "@partnera/core";

/**
 * Payout rail (provider) abstraction. Concrete rails — Stripe Connect, PayPal
 * Payouts, Wise, ACH, store-credit — are **deliberately not implemented** in
 * this module (Part 7 / D-105). The domain only knows this contract; the
 * delivery layer wires a real adapter and records the {@link PayoutRailResult}
 * back onto the append-only payout stream.
 */
export interface PayoutInstruction {
  readonly payoutId: PayoutId;
  readonly tenantId: TenantId;
  readonly affiliateId: AffiliateId;
  readonly amount: MoneyJSON;
  /** Opaque, tenant-owned destination handle. Never raw bank/card data. */
  readonly destinationRef: string;
  /** Idempotency key the rail must honor so retries never double-pay. */
  readonly idempotencyKey: string;
}

export interface PayoutRailResult {
  readonly ok: boolean;
  /** Provider-side reference on success (used to reconcile). */
  readonly providerRef: string | null;
  readonly error: string | null;
  /** Whether a failure is worth retrying (transient) vs. terminal. */
  readonly retryable: boolean;
}

export interface PayoutRail {
  readonly name: string;
  execute(instruction: PayoutInstruction): Promise<PayoutRailResult>;
}

/**
 * The default production rail: unconfigured. It refuses to move money and is
 * safe to ship — a real rail must be explicitly injected. This is the "empty
 * provider adapter" the brief asks for: the abstraction exists, the provider
 * does not.
 */
export class UnconfiguredPayoutRail implements PayoutRail {
  readonly name = "unconfigured";

  async execute(_instruction: PayoutInstruction): Promise<PayoutRailResult> {
    return {
      ok: false,
      providerRef: null,
      error: "No payout rail is configured. Inject a provider adapter before executing payouts.",
      retryable: false,
    };
  }
}
