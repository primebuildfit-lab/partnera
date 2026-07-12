import {
  type BusinessId,
  type MembershipId,
  type OrganizationId,
  type RoleId,
  type TenantId,
  type UserId,
} from "@partnera/core";
import {
  type Business,
  type Membership,
  materializeSystemRole,
  type Organization,
  type Role,
  SYSTEM_ROLES,
  type User,
} from "@partnera/auth";
import { type Collection } from "../relational/store";

/**
 * Identity & tenancy persistence: users, organizations, businesses (tenants),
 * memberships, and roles. Its most important job for the money spine is
 * {@link resolveRoles}: given a user and the tenant they are acting in, return
 * the roles that apply — the input the permission engine needs. Membership scope
 * (platform / organization / business) is honored so an org admin's roles apply
 * to every business the org owns, and platform operators act cross-tenant.
 */
export class IdentityRepository {
  constructor(
    private readonly users: Collection<User>,
    private readonly organizations: Collection<Organization>,
    private readonly businesses: Collection<Business>,
    private readonly memberships: Collection<Membership>,
    private readonly roles: Collection<Role>,
  ) {}

  // --- Users ---
  createUser(user: User): void {
    this.users.insert(user);
  }
  getUser(userId: UserId): User | undefined {
    return this.users.get(userId);
  }
  getUserByEmail(email: string): User | undefined {
    return this.users.findByUnique("email", email.toLowerCase());
  }

  // --- Organizations ---
  createOrganization(org: Organization): void {
    this.organizations.insert(org);
  }
  getOrganization(id: OrganizationId): Organization | undefined {
    return this.organizations.get(id);
  }

  // --- Businesses (tenants) ---
  createBusiness(business: Business): void {
    this.businesses.insert(business);
  }
  getBusiness(id: BusinessId): Business | undefined {
    return this.businesses.get(id);
  }
  listBusinessesForOrganization(organizationId: OrganizationId): Business[] {
    return this.businesses.find((b) => b.organizationId === organizationId);
  }

  // --- Memberships ---
  createMembership(membership: Membership): void {
    this.memberships.insert(membership);
  }
  getMembership(id: MembershipId): Membership | undefined {
    return this.memberships.get(id);
  }
  listMembershipsForUser(userId: UserId): Membership[] {
    return this.memberships.find((m) => m.userId === userId);
  }

  // --- Roles ---
  createRole(role: Role): void {
    this.roles.insert(role);
  }
  getRole(id: RoleId): Role | undefined {
    return this.roles.get(id);
  }
  listRoles(): Role[] {
    return this.roles.values();
  }

  /**
   * Seed the platform-managed system roles if absent. Ids are derived from each
   * role key so seeding is idempotent across restarts.
   */
  seedSystemRoles(): void {
    for (const template of SYSTEM_ROLES) {
      const id = `role_sys_${template.key}` as unknown as RoleId;
      if (!this.roles.get(id)) this.roles.insert(materializeSystemRole(template, id));
    }
  }

  /**
   * Resolve the roles a user holds while acting in `tenantId`. Honors membership
   * scope: platform memberships apply everywhere; organization memberships apply
   * to every business the org owns; business memberships apply to that business.
   * Only `active` memberships count.
   */
  resolveRoles(userId: UserId, tenantId: TenantId): Role[] {
    const business = this.businesses.get(tenantId);
    const orgId = business?.organizationId ?? null;
    const roleIds = new Set<RoleId>();

    for (const membership of this.listMembershipsForUser(userId)) {
      if (membership.status !== "active") continue;
      const scope = membership.scope;
      const applies =
        scope.kind === "platform" ||
        (scope.kind === "business" && scope.businessId === tenantId) ||
        (scope.kind === "organization" && orgId !== null && scope.organizationId === orgId);
      if (!applies) continue;
      for (const roleId of membership.roleIds) roleIds.add(roleId);
    }

    const roles: Role[] = [];
    for (const roleId of roleIds) {
      const role = this.roles.get(roleId);
      if (role) roles.push(role);
    }
    return roles;
  }
}
