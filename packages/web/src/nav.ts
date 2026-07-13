import { type PermissionKey } from "@partnera/auth";
import { type AppScope } from "./auth";

/**
 * Data-driven navigation. Each item may declare the permission it needs; the
 * shell hides items the current principal cannot use, so the three surfaces feel
 * like one platform while respecting RBAC (docs/16). Groups give the IA shape.
 */
export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly permission?: PermissionKey;
}
export interface NavGroup {
  readonly title: string;
  readonly items: readonly NavItem[];
}
export type NavTree = readonly NavGroup[];

export const BUSINESS_NAV: NavTree = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/business" },
      { label: "Analytics", href: "/business/analytics", permission: "analytics.read" },
    ],
  },
  {
    title: "Program",
    items: [
      { label: "Offers", href: "/business/offers", permission: "offers.read" },
      { label: "Campaigns", href: "/business/campaigns", permission: "campaigns.read" },
      { label: "Tracking", href: "/business/tracking", permission: "tracking.read" },
      { label: "Conversions", href: "/business/conversions", permission: "tracking.read" },
    ],
  },
  {
    title: "Money",
    items: [
      { label: "Commissions", href: "/business/commissions", permission: "commissions.read" },
      { label: "Balances", href: "/business/balances", permission: "commissions.read" },
    ],
  },
  {
    title: "Creators",
    items: [
      { label: "Overview", href: "/business/creators", permission: "creator.view" },
      { label: "Setup guide", href: "/business/creators/setup", permission: "creator_program.manage" },
      { label: "Pilot checklist", href: "/business/creators/pilot", permission: "creator.view" },
      { label: "Creator Program", href: "/business/creators/config", permission: "creator_program.manage" },
      { label: "Opportunities", href: "/business/creators/opportunities", permission: "content_opportunity.manage" },
      { label: "Reviews", href: "/business/creators/submissions", permission: "submission.review" },
      { label: "Queue", href: "/business/creators/queue", permission: "submission.review" },
      { label: "Payments", href: "/business/creators/payments", permission: "creator_payment.authorize" },
      { label: "Content Library", href: "/business/creators/library", permission: "content_asset.manage" },
    ],
  },
  {
    title: "Trust & Safety",
    items: [{ label: "Fraud", href: "/business/fraud", permission: "fraud.read" }],
  },
  {
    title: "Account",
    items: [
      { label: "Company", href: "/business/organization", permission: "businesses.read" },
      { label: "Notifications", href: "/business/notifications" },
      { label: "Settings", href: "/business/configuration", permission: "settings.read" },
      { label: "Audit", href: "/business/audit", permission: "audit.read" },
    ],
  },
];

export const AFFILIATE_NAV: NavTree = [
  {
    title: "Overview",
    items: [
      { label: "Performance", href: "/affiliate" },
      { label: "Profile", href: "/affiliate/profile" },
    ],
  },
  {
    title: "Promote",
    items: [
      { label: "Referral Links", href: "/affiliate/links", permission: "links.manage" },
      { label: "Coupons", href: "/affiliate/coupons", permission: "coupons.manage" },
    ],
  },
  {
    title: "Earnings",
    items: [
      { label: "Pending", href: "/affiliate/pending", permission: "commissions.read" },
      { label: "Approved", href: "/affiliate/approved", permission: "commissions.read" },
      { label: "Paid", href: "/affiliate/paid", permission: "commissions.read" },
      { label: "History", href: "/affiliate/history", permission: "commissions.read" },
      { label: "Payouts", href: "/affiliate/payouts", permission: "payouts.read" },
    ],
  },
  {
    title: "Content",
    items: [{ label: "Content Library", href: "/affiliate/content", permission: "affiliate_content.view" }],
  },
  {
    title: "Account",
    items: [
      { label: "Notifications", href: "/affiliate/notifications" },
      { label: "Settings", href: "/affiliate/settings" },
    ],
  },
];

/** Creator Portal navigation. Creator self-actions are ownership-authorized. */
export const CREATOR_NAV: NavTree = [
  {
    title: "Work",
    items: [
      { label: "Home", href: "/creator" },
      { label: "Find companies", href: "/creator/discover" },
      { label: "My Work", href: "/creator/jobs" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Earnings", href: "/creator/earnings" },
      { label: "Profile", href: "/creator/profile" },
    ],
  },
];

export const ADMIN_NAV: NavTree = [
  {
    title: "Operations",
    items: [
      { label: "Overview", href: "/admin" },
      { label: "Health", href: "/admin/health", permission: "platform.health.read" },
      { label: "Data status", href: "/admin/data", permission: "platform.health.read" },
      { label: "Logs", href: "/admin/logs", permission: "platform.health.read" },
    ],
  },
  {
    title: "Tenants",
    items: [
      { label: "Organizations", href: "/admin/organizations", permission: "businesses.read" },
      { label: "Users", href: "/admin/users", permission: "users.read" },
      { label: "Permissions", href: "/admin/permissions", permission: "roles.read" },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Offers", href: "/admin/offers", permission: "offers.read" },
      { label: "Tracking", href: "/admin/tracking", permission: "tracking.read" },
      { label: "Fraud", href: "/admin/fraud", permission: "fraud.read" },
      { label: "Feature Flags", href: "/admin/flags", permission: "flags.manage" },
      { label: "Configuration", href: "/admin/configuration", permission: "settings.read" },
      { label: "Audit", href: "/admin/audit", permission: "audit.read" },
    ],
  },
];

export function navFor(scope: AppScope): NavTree {
  switch (scope) {
    case "business":
      return BUSINESS_NAV;
    case "affiliate":
      return AFFILIATE_NAV;
    case "admin":
      return ADMIN_NAV;
    case "creator":
      return CREATOR_NAV;
    case "internal":
      return []; // Internal OS ships its own dedicated navigation (pages/internal.tsx)
  }
}
