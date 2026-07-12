/**
 * Permission catalog.
 *
 * A `PermissionKey` is a `resource.action` string. The catalog below is a
 * *discoverable registry* of the actions the platform knows about — it is data,
 * not logic. Engines never hardcode role checks; they call
 * `policy.require(principal, "offers.create")`. Roles (system or tenant-custom)
 * map to sets of these keys, so authorization stays fully configurable.
 *
 * Grants support wildcards: `offers.*` grants every offer action, and `*`
 * grants everything (used by the platform-admin system role).
 */
export type PermissionKey = `${string}.${string}` | "*";

export const PERMISSIONS = {
  platform: ["platform.manage", "platform.impersonate", "platform.health.read"],
  businesses: ["businesses.read", "businesses.create", "businesses.update", "businesses.suspend"],
  users: ["users.read", "users.invite", "users.update", "users.remove"],
  roles: ["roles.read", "roles.create", "roles.update", "roles.delete"],
  programs: ["programs.read", "programs.create", "programs.update", "programs.archive"],
  affiliates: [
    "affiliates.read",
    "affiliates.approve",
    "affiliates.suspend",
    "affiliates.invite",
  ],
  offers: ["offers.read", "offers.create", "offers.update", "offers.simulate", "offers.activate"],
  campaigns: ["campaigns.read", "campaigns.create", "campaigns.update", "campaigns.launch"],
  partnerships: [
    "partnerships.read",
    "partnerships.propose",
    "partnerships.accept",
    "partnerships.manage",
  ],
  tracking: ["tracking.read", "links.manage", "coupons.manage"],
  commissions: ["commissions.read", "commissions.approve", "commissions.adjust"],
  payouts: ["payouts.read", "payouts.request", "payouts.approve", "payouts.execute"],
  fraud: ["fraud.read", "fraud.review", "fraud.configure"],
  extensions: ["extensions.read", "extensions.submit", "extensions.approve", "extensions.publish"],
  analytics: ["analytics.read", "reports.export"],
  settings: ["settings.read", "settings.update", "apikeys.manage", "flags.manage"],
  audit: ["audit.read"],
} as const satisfies Record<string, readonly PermissionKey[]>;

/** Flat list of every known permission (useful for building custom-role UIs). */
export const ALL_PERMISSIONS: readonly PermissionKey[] = Object.values(PERMISSIONS).flat();

/** Does a role's `grant` satisfy a requested `requested` permission? */
export function grantMatches(grant: PermissionKey, requested: PermissionKey): boolean {
  if (grant === "*") return true;
  if (grant === requested) return true;
  const [grantResource, grantAction] = grant.split(".", 2);
  const [reqResource] = requested.split(".", 2);
  return grantAction === "*" && grantResource === reqResource;
}
