import {
  type BusinessId,
  type MembershipId,
  type OrganizationId,
  type RequestContext,
  type RoleId,
  type UserId,
  ValidationError,
} from "@partnera/core";
import {
  type Business,
  type BusinessStatus,
  type Membership,
  type MembershipScope,
  type Organization,
  type User,
} from "@partnera/auth";
import { ServiceBase } from "../context";

export interface CreateOrganizationInput {
  readonly name: string;
}
export interface CreateBusinessInput {
  readonly name: string;
  readonly organizationId?: OrganizationId | null;
  readonly planKey?: string;
}
export interface CreateUserInput {
  readonly email: string;
  readonly displayName: string;
}
export interface AddMembershipInput {
  readonly userId: UserId;
  readonly scope: MembershipScope;
  readonly roleIds: readonly RoleId[];
}

/**
 * Identity & tenancy administration: organizations, businesses (tenants), users,
 * and memberships. Bootstrap operations are permission-gated like everything
 * else; a platform-operator context seeds the first tenant and owner.
 */
export class OrganizationService extends ServiceBase {
  createOrganization(ctx: RequestContext, input: CreateOrganizationInput): Organization {
    this.require(ctx, "businesses.create");
    if (input.name.trim() === "") throw new ValidationError("Organization name is required");
    const org: Organization = {
      id: this.ids.next<OrganizationId>(),
      name: input.name,
      createdAt: this.clock.now(),
    };
    this.uow.identity.createOrganization(org);
    return org;
  }

  createBusiness(ctx: RequestContext, input: CreateBusinessInput): Business {
    this.require(ctx, "businesses.create");
    if (input.name.trim() === "") throw new ValidationError("Business name is required");
    const business: Business = {
      id: this.ids.next<BusinessId>(),
      organizationId: input.organizationId ?? null,
      name: input.name,
      status: "trial" satisfies BusinessStatus,
      planKey: input.planKey ?? "starter",
      createdAt: this.clock.now(),
    };
    this.uow.identity.createBusiness(business);
    return business;
  }

  createUser(ctx: RequestContext, input: CreateUserInput): User {
    this.require(ctx, "users.invite");
    if (!input.email.includes("@")) throw new ValidationError("A valid email is required");
    const user: User = {
      id: this.ids.next<UserId>(),
      email: input.email,
      displayName: input.displayName,
      status: "active",
      authSubject: null,
      createdAt: this.clock.now(),
    };
    this.uow.identity.createUser(user);
    return user;
  }

  async addMembership(ctx: RequestContext, input: AddMembershipInput): Promise<Membership> {
    this.require(ctx, "users.invite");
    if (input.roleIds.length === 0) throw new ValidationError("At least one role is required");
    const membership: Membership = {
      id: this.ids.next<MembershipId>(),
      userId: input.userId,
      scope: input.scope,
      roleIds: input.roleIds,
      status: "active",
      createdAt: this.clock.now(),
    };
    this.uow.identity.createMembership(membership);
    await this.audit(ctx, "users.add_membership", "membership", membership.id, {
      userId: input.userId,
    });
    return membership;
  }

  getBusiness(ctx: RequestContext, businessId: BusinessId): Business | undefined {
    this.require(ctx, "businesses.read");
    return this.uow.identity.getBusiness(businessId);
  }
}
