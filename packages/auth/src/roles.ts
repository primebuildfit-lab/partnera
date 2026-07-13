import { type RoleId } from "@partnera/core";
import { type PermissionKey } from "./permissions";

/**
 * Roles are *data*. System roles ship as templates below; businesses may define
 * custom roles with any subset of the permission catalog. No permission set is
 * baked into engine code — everything resolves through {@link Role.permissions}.
 */
export type RoleScopeLevel =
  | "platform"
  | "organization"
  | "business"
  | "affiliate"
  | "partner"
  | "developer";

export interface Role {
  readonly id: RoleId;
  readonly key: string;
  readonly name: string;
  readonly scopeLevel: RoleScopeLevel;
  readonly permissions: readonly PermissionKey[];
  /** System roles are platform-managed and immutable; custom roles are tenant-owned. */
  readonly isSystem: boolean;
}

/** A system-role template (no id yet — ids are assigned on persistence). */
export type SystemRoleTemplate = Omit<Role, "id" | "isSystem">;

/**
 * The default role catalog. These cover the personas from the product design;
 * a business can clone/extend them into custom roles.
 */
export const SYSTEM_ROLES: readonly SystemRoleTemplate[] = [
  {
    key: "platform_admin",
    name: "Platform Admin",
    scopeLevel: "platform",
    permissions: ["*"],
  },
  {
    key: "business_owner",
    name: "Business Owner",
    scopeLevel: "business",
    // Everything within the tenant, but not platform operations.
    permissions: [
      "businesses.read",
      "businesses.update",
      "users.read",
      "users.invite",
      "users.update",
      "users.remove",
      "roles.read",
      "roles.create",
      "roles.update",
      "roles.delete",
      "programs.read",
      "programs.create",
      "programs.update",
      "programs.archive",
      "affiliates.read",
      "affiliates.approve",
      "affiliates.suspend",
      "affiliates.invite",
      "offers.read",
      "offers.create",
      "offers.update",
      "offers.simulate",
      "offers.activate",
      "campaigns.read",
      "campaigns.create",
      "campaigns.update",
      "campaigns.launch",
      "partnerships.read",
      "partnerships.propose",
      "partnerships.accept",
      "partnerships.manage",
      "tracking.read",
      "links.manage",
      "coupons.manage",
      "commissions.read",
      "commissions.approve",
      "commissions.adjust",
      "payouts.read",
      "payouts.approve",
      "payouts.execute",
      "fraud.read",
      "fraud.review",
      "fraud.configure",
      "extensions.read",
      "analytics.read",
      "reports.export",
      "settings.read",
      "settings.update",
      "apikeys.manage",
      "flags.manage",
      "audit.read",
      // Creator Marketplace — full authority within the tenant.
      "creator.view",
      "creator.invite",
      "creator_program.manage",
      "creator_page.manage",
      "content_opportunity.manage",
      "content_campaign.manage",
      "deliverable.define",
      "application.manage",
      "submission.review",
      "submission.approve",
      "submission.reject",
      "submission.request_revision",
      "review.override",
      "content_asset.manage",
      "content_license.manage",
      "rank_unlock.manage",
      "affiliate_content.view",
      "creator_payment.authorize",
      "creator_payment.execute",
      "dispute.handle",
    ],
  },
  {
    key: "business_admin",
    name: "Business Admin",
    scopeLevel: "business",
    permissions: [
      "programs.read",
      "programs.create",
      "programs.update",
      "affiliates.read",
      "affiliates.approve",
      "affiliates.suspend",
      "affiliates.invite",
      "offers.read",
      "offers.create",
      "offers.update",
      "offers.simulate",
      "offers.activate",
      "campaigns.read",
      "campaigns.create",
      "campaigns.update",
      "campaigns.launch",
      "tracking.read",
      "links.manage",
      "coupons.manage",
      "commissions.read",
      "commissions.approve",
      "fraud.read",
      "fraud.review",
      "analytics.read",
      "settings.read",
      "audit.read",
    ],
  },
  {
    key: "marketing",
    name: "Marketing",
    scopeLevel: "business",
    permissions: [
      "programs.read",
      "affiliates.read",
      "affiliates.invite",
      "offers.read",
      "offers.create",
      "offers.update",
      "offers.simulate",
      "campaigns.read",
      "campaigns.create",
      "campaigns.update",
      "campaigns.launch",
      "tracking.read",
      "links.manage",
      "coupons.manage",
      "analytics.read",
    ],
  },
  {
    key: "finance",
    name: "Finance",
    scopeLevel: "business",
    permissions: [
      "commissions.read",
      "commissions.approve",
      "commissions.adjust",
      "payouts.read",
      "payouts.approve",
      "payouts.execute",
      "analytics.read",
      "reports.export",
      "audit.read",
      // Creator payments: authorize + execute (separated from creative review).
      "creator_payment.authorize",
      "creator_payment.execute",
    ],
  },
  {
    key: "content_reviewer",
    name: "Content Reviewer",
    scopeLevel: "business",
    // A delegated reviewer: reviews and requests revisions; approval is bounded by
    // configuration. Cannot authorize payment (separation of duties).
    permissions: [
      "creator.view",
      "content_opportunity.manage",
      "submission.review",
      "submission.request_revision",
      "submission.approve",
      "submission.reject",
      "affiliate_content.view",
      "analytics.read",
    ],
  },
  {
    key: "creator",
    name: "Creator",
    scopeLevel: "affiliate",
    // A creator acts on their own profile, jobs, submissions, and earnings only.
    // Authorization for own data is by identity ownership, not tenant RBAC.
    permissions: ["creator.self"],
  },
  {
    key: "support",
    name: "Support",
    scopeLevel: "business",
    permissions: [
      "affiliates.read",
      "programs.read",
      "offers.read",
      "campaigns.read",
      "commissions.read",
      "payouts.read",
      "tracking.read",
    ],
  },
  {
    key: "affiliate",
    name: "Affiliate",
    scopeLevel: "affiliate",
    permissions: [
      "programs.read",
      "links.manage",
      "coupons.manage",
      "commissions.read",
      "payouts.request",
      "payouts.read",
      // View the approved content library (rank-gated at resolution time).
      "affiliate_content.view",
    ],
  },
  {
    key: "partner",
    name: "Partner",
    scopeLevel: "partner",
    permissions: ["partnerships.read", "partnerships.accept", "campaigns.read", "analytics.read"],
  },
  {
    key: "extension_developer",
    name: "Extension Developer",
    scopeLevel: "developer",
    permissions: ["extensions.read", "extensions.submit"],
  },
  {
    key: "read_only",
    name: "Read Only",
    scopeLevel: "business",
    permissions: [
      "programs.read",
      "affiliates.read",
      "offers.read",
      "campaigns.read",
      "commissions.read",
      "payouts.read",
      "analytics.read",
      "tracking.read",
    ],
  },
];

export function findSystemRole(key: string): SystemRoleTemplate | undefined {
  return SYSTEM_ROLES.find((r) => r.key === key);
}

/** Assign ids to a system-role template to materialize a concrete Role. */
export function materializeSystemRole(template: SystemRoleTemplate, id: RoleId): Role {
  return { ...template, id, isSystem: true };
}
