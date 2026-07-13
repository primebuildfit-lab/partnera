import { type BusinessId, type TenantId } from "@partnera/core";
import { type BillingSubscriptionId } from "./ids";

/**
 * Billing abstraction (Part 19). Prices are PROVISIONAL and no charge is ever
 * made in the pilot — PrimeBuild is an internal pilot with no subscription
 * requirement. Shopify Billing (or another provider) plugs in behind this port;
 * test mode is the only mode used here. Nothing here blocks installation.
 */
export type BillingMode = "test" | "live";

export type SubscriptionStatus = "none" | "trial" | "active" | "cancelled" | "read_only";

export interface BillingSubscription {
  readonly id: BillingSubscriptionId;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly planKey: string;
  readonly status: SubscriptionStatus;
  readonly mode: BillingMode;
  /** PrimeBuild and other internal pilots: never charged. */
  readonly internalPilot: boolean;
  readonly trialEndsAt: Date | null;
  readonly updatedAt: Date;
}

/** Port for a billing provider. The pilot uses a no-charge test implementation. */
export interface BillingProvider {
  readonly mode: BillingMode;
  createTrial(tenantId: TenantId, businessId: BusinessId, planKey: string, trialDays: number): Promise<BillingSubscription>;
  cancel(id: BillingSubscriptionId): Promise<BillingSubscription>;
}

/** All prices here are provisional and not commercially active. */
export const BILLING_DISCLAIMER = "Plans and pricing are provisional and not commercially active. No charge is made during the pilot.";
