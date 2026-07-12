import {
  type AffiliateId,
  type CampaignId,
  type ConversionId,
  type CouponId,
  type OrderId,
  type TenantId,
} from "@partnera/core";
import {
  type AttributionClaim,
  type Click,
  type Conversion,
  type CouponUse,
  type NormalizedOrder,
  type Refund,
  type TrackingSession,
} from "@partnera/tracking-engine";
import { type Collection } from "../relational/store";

/** A durable referral link definition (the click stream references it by code). */
export interface TrackingLinkRow {
  readonly id: string;
  readonly tenantId: TenantId;
  readonly affiliateId: AffiliateId;
  readonly campaignId: CampaignId | null;
  readonly code: string;
  readonly createdAt: Date;
}

/** A durable coupon definition mapping a code to an affiliate. */
export interface CouponRow {
  readonly id: CouponId;
  readonly tenantId: TenantId;
  readonly affiliateId: AffiliateId;
  readonly campaignId: CampaignId | null;
  readonly code: string;
  readonly createdAt: Date;
}

export interface RefundRow extends Refund {
  readonly id: string;
}

const sessionPk = (tenantId: TenantId, token: string): string => `${tenantId}:${token}`;

/**
 * Tracking persistence: touch points (clicks, coupon uses, sessions), value
 * events (orders, refunds), and resolved conversions. Everything that ingests
 * from a commerce adapter is **replay-safe** — orders dedupe on
 * (tenant, platformOrderId) and conversions on (tenant, orderId), so a webhook
 * delivered twice never double-credits (docs/05 idempotency).
 */
export class TrackingRepository {
  constructor(
    private readonly links: Collection<TrackingLinkRow>,
    private readonly coupons: Collection<CouponRow>,
    private readonly sessions: Collection<TrackingSession>,
    private readonly clicks: Collection<Click>,
    private readonly couponUses: Collection<CouponUse>,
    private readonly orders: Collection<NormalizedOrder>,
    private readonly conversions: Collection<Conversion>,
    private readonly refunds: Collection<RefundRow>,
  ) {}

  // --- Definitions ---

  createLink(row: TrackingLinkRow): void {
    this.links.insert(row);
  }

  getLinkByCode(tenantId: TenantId, code: string): TrackingLinkRow | undefined {
    return this.links.findByUnique("tenant_code", `${tenantId}:${code}`);
  }

  createCoupon(row: CouponRow): void {
    this.coupons.insert(row);
  }

  getCouponByCode(tenantId: TenantId, code: string): CouponRow | undefined {
    return this.coupons.findByUnique("tenant_code", `${tenantId}:${code}`);
  }

  // --- Touches ---

  recordClick(click: Click): void {
    // Append-only, idempotent by click id (safe to retry an ingestion).
    this.clicks.insertIdempotent(click);
  }

  upsertSession(session: TrackingSession): void {
    this.sessions.upsert(session);
  }

  getSession(tenantId: TenantId, token: string): TrackingSession | undefined {
    return this.sessions.get(sessionPk(tenantId, token));
  }

  recordCouponUse(use: CouponUse): void {
    this.couponUses.insertIdempotent(use);
  }

  // --- Value events ---

  /** Ingest a normalized order idempotently. Returns whether it was new. */
  ingestOrder(order: NormalizedOrder): { order: NormalizedOrder; created: boolean } {
    const existing = this.orders.findByUnique(
      "tenant_platform_order",
      `${order.tenantId}:${order.platformOrderId}`,
    );
    if (existing) return { order: existing, created: false };
    this.orders.insert(order);
    return { order, created: true };
  }

  getOrder(tenantId: TenantId, orderId: OrderId): NormalizedOrder | undefined {
    const row = this.orders.get(orderId);
    return row && row.tenantId === tenantId ? row : undefined;
  }

  recordRefund(refund: RefundRow): void {
    this.refunds.insertIdempotent(refund);
  }

  listRefunds(tenantId: TenantId, orderId: OrderId): RefundRow[] {
    return this.refunds.find((r) => r.tenantId === tenantId && r.orderId === orderId);
  }

  // --- Conversions ---

  /**
   * Persist a resolved conversion idempotently (one per order). If the order was
   * already converted, the existing conversion is returned untouched.
   */
  recordConversion(conversion: Conversion): { conversion: Conversion; created: boolean } {
    const existing = this.conversions.findByUnique(
      "tenant_order",
      `${conversion.tenantId}:${conversion.orderId}`,
    );
    if (existing) return { conversion: existing, created: false };
    this.conversions.insert(conversion);
    return { conversion, created: true };
  }

  getConversion(tenantId: TenantId, conversionId: ConversionId): Conversion | undefined {
    const row = this.conversions.get(conversionId);
    return row && row.tenantId === tenantId ? row : undefined;
  }

  getConversionByOrder(tenantId: TenantId, orderId: OrderId): Conversion | undefined {
    return this.conversions.findByUnique("tenant_order", `${tenantId}:${orderId}`);
  }

  // --- Tenant-scoped listings (presentation/reporting) ---

  listConversions(tenantId: TenantId): Conversion[] {
    return this.conversions.find((c) => c.tenantId === tenantId);
  }

  listOrders(tenantId: TenantId): NormalizedOrder[] {
    return this.orders.find((o) => o.tenantId === tenantId);
  }

  listLinks(tenantId: TenantId): TrackingLinkRow[] {
    return this.links.find((l) => l.tenantId === tenantId);
  }

  listCoupons(tenantId: TenantId): CouponRow[] {
    return this.coupons.find((c) => c.tenantId === tenantId);
  }

  listRefundsForTenant(tenantId: TenantId): RefundRow[] {
    return this.refunds.find((r) => r.tenantId === tenantId);
  }

  listConversionsForAffiliate(tenantId: TenantId, affiliateId: AffiliateId): Conversion[] {
    return this.conversions.find((c) => c.tenantId === tenantId && c.affiliateId === affiliateId);
  }

  listLinksForAffiliate(tenantId: TenantId, affiliateId: AffiliateId): TrackingLinkRow[] {
    return this.links.find((l) => l.tenantId === tenantId && l.affiliateId === affiliateId);
  }

  listCouponsForAffiliate(tenantId: TenantId, affiliateId: AffiliateId): CouponRow[] {
    return this.coupons.find((c) => c.tenantId === tenantId && c.affiliateId === affiliateId);
  }

  /** Mark a conversion reversed (refund/clawback). Idempotent. */
  markConversionReversed(tenantId: TenantId, conversionId: ConversionId): Conversion | null {
    const versioned = this.conversions.getVersioned(conversionId);
    if (!versioned || versioned.row.tenantId !== tenantId) return null;
    if (versioned.row.reversed) return versioned.row;
    const updated: Conversion = { ...versioned.row, reversed: true };
    this.conversions.replace(updated, versioned.version);
    return updated;
  }

  /**
   * Build the attribution claims for an order from stored touches: coupon codes
   * on the order map to coupon claims; the order's session token maps to click
   * claims. The engine's resolver then picks the winner under the tenant policy.
   */
  collectClaims(tenantId: TenantId, order: NormalizedOrder): AttributionClaim[] {
    const claims: AttributionClaim[] = [];
    for (const code of order.couponCodes) {
      const coupon = this.getCouponByCode(tenantId, code);
      if (coupon) {
        claims.push({
          basis: "coupon",
          affiliateId: coupon.affiliateId,
          campaignId: coupon.campaignId,
          touchedAt: order.placedAt,
        });
      }
    }
    if (order.sessionToken !== null) {
      const token = order.sessionToken;
      for (const click of this.clicks.find(
        (c) => c.tenantId === tenantId && c.sessionToken === token,
      )) {
        claims.push({
          basis: "link",
          affiliateId: click.affiliateId,
          campaignId: click.campaignId,
          touchedAt: click.occurredAt,
        });
      }
    }
    return claims;
  }
}
