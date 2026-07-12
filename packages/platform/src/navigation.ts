/**
 * Navigation/module registries for the three surfaces, expressed as data so the
 * apps render their menus and route tables from a single source. Each module
 * declares the permission that gates it, tying navigation to RBAC. The value is
 * a permission key from @partnera/auth's catalog (kept as a string here to avoid
 * a dependency from this lower-level package). See docs/12–14.
 */
export interface NavModule {
  readonly key: string;
  readonly label: string;
  readonly path: string;
  readonly section: string;
  /** Permission key required to see/enter this module (null = always visible). */
  readonly requiredPermission: string | null;
}

export const ADMIN_MODULES: readonly NavModule[] = [
  { key: "overview", label: "Overview", path: "/", section: "Command", requiredPermission: "platform.health.read" },
  { key: "health", label: "System Health", path: "/health", section: "Command", requiredPermission: "platform.health.read" },
  { key: "audit", label: "Audit History", path: "/audit", section: "Command", requiredPermission: "audit.read" },
  { key: "businesses", label: "Businesses", path: "/businesses", section: "Tenants", requiredPermission: "businesses.read" },
  { key: "users", label: "Users", path: "/users", section: "Tenants", requiredPermission: "users.read" },
  { key: "approvals", label: "Approvals", path: "/approvals", section: "Marketplace", requiredPermission: "extensions.approve" },
  { key: "extensions", label: "Extensions", path: "/extensions", section: "Marketplace", requiredPermission: "extensions.read" },
  { key: "marketplace", label: "Marketplace", path: "/marketplace", section: "Marketplace", requiredPermission: "extensions.read" },
  { key: "commissions", label: "Commissions", path: "/commissions", section: "Money", requiredPermission: "commissions.read" },
  { key: "payouts", label: "Payments", path: "/payouts", section: "Money", requiredPermission: "payouts.read" },
  { key: "fraud", label: "Fraud", path: "/fraud", section: "Trust", requiredPermission: "fraud.read" },
  { key: "flags", label: "Feature Flags", path: "/flags", section: "Config", requiredPermission: "flags.manage" },
  { key: "config", label: "Configuration", path: "/config", section: "Config", requiredPermission: "settings.update" },
];

export const BUSINESS_MODULES: readonly NavModule[] = [
  { key: "overview", label: "Overview", path: "/", section: "Home", requiredPermission: null },
  { key: "program", label: "Affiliate Program", path: "/program", section: "Program", requiredPermission: "programs.read" },
  { key: "affiliates", label: "Affiliates", path: "/affiliates", section: "Program", requiredPermission: "affiliates.read" },
  { key: "applications", label: "Applications", path: "/applications", section: "Program", requiredPermission: "affiliates.approve" },
  { key: "offers", label: "Offers", path: "/offers", section: "Offers", requiredPermission: "offers.read" },
  { key: "offer-builder", label: "Offer Builder", path: "/offers/build", section: "Offers", requiredPermission: "offers.create" },
  { key: "campaigns", label: "Campaigns", path: "/campaigns", section: "Offers", requiredPermission: "campaigns.read" },
  { key: "commissions", label: "Pending Commissions", path: "/commissions", section: "Money", requiredPermission: "commissions.read" },
  { key: "payouts", label: "Payments", path: "/payouts", section: "Money", requiredPermission: "payouts.read" },
  { key: "partnerships", label: "Partnerships", path: "/partnerships", section: "Growth", requiredPermission: "partnerships.read" },
  { key: "analytics", label: "Analytics", path: "/analytics", section: "Insight", requiredPermission: "analytics.read" },
  { key: "settings", label: "Settings", path: "/settings", section: "Config", requiredPermission: "settings.read" },
];

export const AFFILIATE_MODULES: readonly NavModule[] = [
  { key: "dashboard", label: "Dashboard", path: "/", section: "Home", requiredPermission: null },
  { key: "programs", label: "Programs", path: "/programs", section: "Promote", requiredPermission: "programs.read" },
  { key: "links", label: "Referral Links", path: "/links", section: "Promote", requiredPermission: "links.manage" },
  { key: "coupons", label: "Coupons", path: "/coupons", section: "Promote", requiredPermission: "coupons.manage" },
  { key: "conversions", label: "Conversions", path: "/conversions", section: "Performance", requiredPermission: "commissions.read" },
  { key: "earnings", label: "Earnings", path: "/earnings", section: "Money", requiredPermission: "commissions.read" },
  { key: "withdrawals", label: "Withdrawals", path: "/withdrawals", section: "Money", requiredPermission: "payouts.request" },
  { key: "settings", label: "Settings", path: "/settings", section: "Account", requiredPermission: null },
];
