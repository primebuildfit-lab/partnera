import {
  type AffiliateId,
  type OfferId,
  type RequestContext,
} from "@partnera/core";
import { type Balance, type CommissionRecord } from "@partnera/commission-engine";
import { type Conversion } from "@partnera/tracking-engine";
import { type PayoutRequest } from "@partnera/payment-engine";
import { type FraudCase } from "@partnera/fraud-engine";
import { type AuditLogEntry } from "@partnera/platform";
import { type Business, type Organization, type Role, type User } from "@partnera/auth";
import {
  type CouponRow,
  type OfferRow,
  type OfferVersionRow,
  type RefundRow,
  type TrackingLinkRow,
} from "@partnera/persistence";
import { type NormalizedOrder } from "@partnera/tracking-engine";
import { ServiceBase } from "../context";

/**
 * Read-only query surface for presentation (the delivery/UI layer). Every method
 * is permission-gated and tenant-scoped exactly like the write services — the UI
 * never reaches around the application layer to the repositories, so RBAC and
 * isolation hold uniformly. No business logic lives here; it only reads.
 */
export class QueryService extends ServiceBase {
  // --- Offers ---
  offers(ctx: RequestContext): OfferRow[] {
    this.require(ctx, "offers.read");
    return this.uow.offers.listOffers(ctx.tenantId);
  }
  offerVersions(ctx: RequestContext, offerId: OfferId): OfferVersionRow[] {
    this.require(ctx, "offers.read");
    const offer = this.uow.offers.getOffer(ctx.tenantId, offerId);
    if (!offer) return [];
    const versions: OfferVersionRow[] = [];
    for (let v = 1; v <= offer.latestVersion; v++) {
      const row = this.uow.offers.getVersion(ctx.tenantId, offerId, v);
      if (row) versions.push(row);
    }
    return versions;
  }

  // --- Tracking ---
  conversions(ctx: RequestContext): Conversion[] {
    this.require(ctx, "tracking.read");
    return this.uow.tracking.listConversions(ctx.tenantId);
  }
  orders(ctx: RequestContext): NormalizedOrder[] {
    this.require(ctx, "tracking.read");
    return this.uow.tracking.listOrders(ctx.tenantId);
  }
  links(ctx: RequestContext): TrackingLinkRow[] {
    this.require(ctx, "tracking.read");
    return this.uow.tracking.listLinks(ctx.tenantId);
  }
  coupons(ctx: RequestContext): CouponRow[] {
    this.require(ctx, "tracking.read");
    return this.uow.tracking.listCoupons(ctx.tenantId);
  }
  refunds(ctx: RequestContext): RefundRow[] {
    this.require(ctx, "tracking.read");
    return this.uow.tracking.listRefundsForTenant(ctx.tenantId);
  }

  // --- Money ---
  commissions(ctx: RequestContext): Promise<CommissionRecord[]> {
    this.require(ctx, "commissions.read");
    return this.uow.ledger.listCommissions(ctx.tenantId);
  }
  tenantBalances(ctx: RequestContext): Promise<Balance[]> {
    this.require(ctx, "commissions.read");
    return this.uow.ledger.tenantBalances(ctx.tenantId);
  }
  payouts(ctx: RequestContext): Promise<PayoutRequest[]> {
    this.require(ctx, "payouts.read");
    return this.uow.payouts.listByTenant(ctx.tenantId);
  }

  // --- Affiliate-scoped (for the Affiliate Portal) ---
  affiliateCommissions(ctx: RequestContext, affiliateId: AffiliateId): Promise<CommissionRecord[]> {
    this.require(ctx, "commissions.read");
    return this.uow.ledger.listCommissionsForAffiliate(ctx.tenantId, affiliateId);
  }
  affiliateBalances(ctx: RequestContext, affiliateId: AffiliateId): Promise<Balance[]> {
    this.require(ctx, "commissions.read");
    return this.uow.ledger.balancesForAffiliate(ctx.tenantId, affiliateId);
  }
  affiliateConversions(ctx: RequestContext, affiliateId: AffiliateId): Conversion[] {
    this.require(ctx, "commissions.read");
    return this.uow.tracking.listConversionsForAffiliate(ctx.tenantId, affiliateId);
  }
  affiliateLinks(ctx: RequestContext, affiliateId: AffiliateId): TrackingLinkRow[] {
    this.require(ctx, "links.manage");
    return this.uow.tracking.listLinksForAffiliate(ctx.tenantId, affiliateId);
  }
  affiliateCoupons(ctx: RequestContext, affiliateId: AffiliateId): CouponRow[] {
    this.require(ctx, "coupons.manage");
    return this.uow.tracking.listCouponsForAffiliate(ctx.tenantId, affiliateId);
  }
  affiliatePayouts(ctx: RequestContext, affiliateId: AffiliateId): Promise<PayoutRequest[]> {
    this.require(ctx, "payouts.read");
    return this.uow.payouts.readByAffiliate(ctx.tenantId, affiliateId).then((events) => {
      const ids = new Set(events.map((e) => e.payoutId));
      return this.uow.payouts
        .listByTenant(ctx.tenantId)
        .then((all) => all.filter((p) => ids.has(p.payoutId)));
    });
  }

  // --- Trust, account, admin ---
  fraudCases(ctx: RequestContext): FraudCase[] {
    this.require(ctx, "fraud.read");
    return this.uow.fraud.listCases(ctx.tenantId);
  }
  auditLog(ctx: RequestContext): AuditLogEntry[] {
    this.require(ctx, "audit.read");
    return this.uow.audit.listForTenant(ctx.tenantId);
  }
  organizations(ctx: RequestContext): Organization[] {
    this.require(ctx, "businesses.read");
    return this.uow.identity.listOrganizations();
  }
  business(ctx: RequestContext): Business | undefined {
    this.require(ctx, "businesses.read");
    return this.uow.identity.getBusiness(ctx.tenantId);
  }
  users(ctx: RequestContext): User[] {
    this.require(ctx, "users.read");
    return this.uow.identity.listUsers();
  }
  roles(ctx: RequestContext): Role[] {
    this.require(ctx, "roles.read");
    return this.uow.identity.listRoles();
  }
}
