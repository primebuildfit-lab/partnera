import {
  type BusinessId,
  type MembershipId,
  type OrganizationId,
  type RoleId,
  type UserId,
} from "@partnera/core";

/**
 * Identity & tenancy model. One person is exactly one {@link User}; their
 * relationships to businesses are {@link Membership}s. This prevents the
 * "four accounts for one human" problem and keeps tenant isolation clean.
 *
 * These are pure domain shapes — no persistence, no auth-provider coupling.
 */

export type UserStatus = "active" | "suspended" | "deactivated";

export interface User {
  readonly id: UserId;
  readonly email: string;
  readonly displayName: string;
  readonly status: UserStatus;
  /** Reference to an external auth identity (provider chosen in build phase). */
  readonly authSubject: string | null;
  readonly createdAt: Date;
}

export type BusinessStatus = "trial" | "active" | "past_due" | "suspended" | "closed";

export interface Business {
  readonly id: BusinessId;
  readonly organizationId: OrganizationId | null;
  readonly name: string;
  readonly status: BusinessStatus;
  /** Entitlement/plan key resolved by @partnera/platform feature flags. */
  readonly planKey: string;
  readonly createdAt: Date;
}

export interface Organization {
  readonly id: OrganizationId;
  readonly name: string;
  readonly createdAt: Date;
}

/**
 * The scope a membership grants access to. Business memberships are the common
 * case; organization memberships span all businesses an org owns; platform
 * memberships belong to Partnera operators.
 */
export type MembershipScope =
  | { readonly kind: "platform" }
  | { readonly kind: "organization"; readonly organizationId: OrganizationId }
  | { readonly kind: "business"; readonly businessId: BusinessId };

export type MembershipStatus = "invited" | "active" | "suspended" | "removed";

export interface Membership {
  readonly id: MembershipId;
  readonly userId: UserId;
  readonly scope: MembershipScope;
  readonly roleIds: readonly RoleId[];
  readonly status: MembershipStatus;
  readonly createdAt: Date;
}
