import {
  type AffiliateId,
  type CampaignId,
  type ClickId,
  type ConversionId,
  type CouponId,
  type OrderId,
  type TenantId,
} from "@partnera/core";

/**
 * Tracking domain records. These capture the touch points and value events the
 * attribution resolver reasons over, plus signals reused by the Fraud Engine.
 * Everything is platform-agnostic — commerce platforms feed normalized data in
 * via adapters. See docs/05-tracking-engine.md.
 */

/** Minimal signal bundle captured per touch — used for attribution AND fraud. */
export interface TouchSignals {
  readonly ipHash: string | null;
  readonly userAgent: string | null;
  readonly deviceHash: string | null;
  readonly country: string | null;
  readonly referrer: string | null;
}

export interface Click {
  readonly id: ClickId;
  readonly tenantId: TenantId;
  readonly affiliateId: AffiliateId;
  readonly campaignId: CampaignId | null;
  readonly linkCode: string;
  readonly sessionToken: string | null;
  readonly occurredAt: Date;
  readonly signals: TouchSignals;
}

export interface CouponUse {
  readonly couponId: CouponId;
  readonly tenantId: TenantId;
  readonly affiliateId: AffiliateId;
  readonly campaignId: CampaignId | null;
  readonly code: string;
  readonly orderId: OrderId;
  readonly occurredAt: Date;
}

export interface TrackingSession {
  readonly token: string;
  readonly tenantId: TenantId;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly signals: TouchSignals;
}

/** A normalized order ingested from a commerce platform adapter. */
export interface NormalizedOrder {
  readonly id: OrderId;
  readonly tenantId: TenantId;
  readonly platformOrderId: string;
  readonly totalMinorUnits: string;
  readonly currency: string;
  readonly customerType: "new" | "returning";
  readonly couponCodes: readonly string[];
  readonly sessionToken: string | null;
  readonly placedAt: Date;
}

/** A refund/cancellation that triggers a commission clawback. */
export interface Refund {
  readonly orderId: OrderId;
  readonly tenantId: TenantId;
  readonly amountMinorUnits: string;
  readonly currency: string;
  readonly reason: string;
  readonly occurredAt: Date;
}

/** A manual correction to an order's attributed value (rare, audited). */
export interface OrderAdjustment {
  readonly orderId: OrderId;
  readonly tenantId: TenantId;
  readonly deltaMinorUnits: string;
  readonly currency: string;
  readonly reason: string;
  readonly occurredAt: Date;
}

/** A resolved conversion linking an order to an affiliate with an explicit basis. */
export interface Conversion {
  readonly id: ConversionId;
  readonly tenantId: TenantId;
  readonly orderId: OrderId;
  readonly affiliateId: AffiliateId;
  readonly campaignId: CampaignId | null;
  readonly basis: "link" | "coupon" | "session";
  readonly attributedAt: Date;
  readonly reversed: boolean;
}
