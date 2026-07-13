import { type RequestContext } from "@partnera/core";
import { type PlatformAlertRow } from "@partnera/persistence";
import {
  type RevenueEvent,
  type RevenueBalance,
  type VaultEvent,
  type VaultBalance,
  foldRevenue,
  foldVault,
} from "@partnera/platform-finance";
import { type AppDeps, ServiceBase } from "../context";

/**
 * The Partnera Internal OS service — platform-operator only. Every method
 * requires the caller to be a platform operator (deny-by-default); business,
 * creator and affiliate users can never reach it. The two money books
 * (Revenue = Bank A, Vault = Bank B) are read as derived balances, never mixed.
 */
export class PlatformService extends ServiceBase {
  constructor(deps: AppDeps) {
    super(deps);
  }

  /** Hard gate: only Partnera platform operators may use the Internal OS. */
  private requireOperator(ctx: RequestContext): void {
    if (!ctx.isPlatformOperator) {
      this.require(ctx, "platform.manage"); // throws PermissionDenied for non-operators
    }
  }

  // --- Two separate financial books ---
  revenueBalance(ctx: RequestContext): RevenueBalance {
    this.requireOperator(ctx);
    return foldRevenue(this.uow.platform.listRevenue());
  }
  vaultBalance(ctx: RequestContext): VaultBalance {
    this.requireOperator(ctx);
    return foldVault(this.uow.platform.listVault());
  }
  appendRevenue(ctx: RequestContext, event: RevenueEvent): void {
    this.requireOperator(ctx);
    this.uow.platform.appendRevenue(event);
  }
  appendVault(ctx: RequestContext, event: VaultEvent): void {
    this.requireOperator(ctx);
    this.uow.platform.appendVault(event);
  }

  // --- Alerts ---
  alerts(ctx: RequestContext): PlatformAlertRow[] {
    this.requireOperator(ctx);
    return this.uow.platform.listAlerts();
  }
  openAlerts(ctx: RequestContext): PlatformAlertRow[] {
    this.requireOperator(ctx);
    return this.uow.platform.openAlerts();
  }

  /** The Internal OS home summary — real, derived from the stores. */
  homeSummary(ctx: RequestContext): {
    businesses: number;
    users: { total: number; creators: number; affiliates: number; businessMembers: number };
    offers: number;
    contentOrders: number;
    submissionsAwaitingReview: number;
    revenue: RevenueBalance;
    vault: VaultBalance;
    openAlerts: number;
  } {
    this.requireOperator(ctx);
    const businesses = this.uow.identity.listBusinesses().length;
    const users = this.uow.identity.listUsers();
    const cc = this.uow.creator.recordCounts();
    const creators = cc.creator_profiles ?? 0;
    return {
      businesses,
      users: {
        total: users.length,
        creators,
        affiliates: Math.max(0, users.length - creators - businesses),
        businessMembers: businesses,
      },
      offers: 0, // platform-wide offer aggregate is drilled into per company
      contentOrders: cc.content_opportunities ?? 0,
      submissionsAwaitingReview: cc.submissions ?? 0,
      revenue: foldRevenue(this.uow.platform.listRevenue()),
      vault: foldVault(this.uow.platform.listVault()),
      openAlerts: this.uow.platform.openAlerts().length,
    };
  }

  /** Businesses list for the Internal OS Companies page. */
  businesses(ctx: RequestContext) {
    this.requireOperator(ctx);
    return this.uow.identity.listBusinesses();
  }
}
