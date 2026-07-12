import {
  type BusinessId,
  type DeviceId,
  type InvitationId,
  type OrganizationId,
  type RoleId,
  type SessionId,
  type UserId,
} from "@partnera/core";

/**
 * Session, device, and invitation contracts. Login itself is NOT implemented in
 * this module (per the foundation brief) — these types define the surface the
 * auth delivery layer will fill, plus forward-declared shapes for MFA, SSO, API
 * tokens, and service accounts so later work slots in without reshaping.
 */

export interface Session {
  readonly id: SessionId;
  readonly userId: UserId;
  readonly deviceId: DeviceId | null;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
  /** Elevated (recent-reauth) window for sensitive money actions. */
  readonly elevatedUntil: Date | null;
}

export interface Device {
  readonly id: DeviceId;
  readonly userId: UserId;
  readonly label: string;
  readonly firstSeenAt: Date;
  readonly lastSeenAt: Date;
  readonly trusted: boolean;
}

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface Invitation {
  readonly id: InvitationId;
  readonly email: string;
  readonly scope:
    | { readonly kind: "platform" }
    | { readonly kind: "organization"; readonly organizationId: OrganizationId }
    | { readonly kind: "business"; readonly businessId: BusinessId };
  readonly roleIds: readonly RoleId[];
  readonly status: InvitationStatus;
  readonly expiresAt: Date;
  readonly invitedByUserId: UserId;
}

// --- Forward-declared, not yet wired (build-phase features) ---

/** Multi-factor method registered to a user. */
export interface MfaFactor {
  readonly userId: UserId;
  readonly kind: "totp" | "webauthn" | "sms";
  readonly enrolledAt: Date;
  readonly verified: boolean;
}

/** SSO connection configured at the organization/business level. */
export interface SsoConnection {
  readonly scopeId: OrganizationId | BusinessId;
  readonly protocol: "saml" | "oidc";
  readonly enabled: boolean;
}

/** Scoped, revocable machine credential. Scopes reuse the permission catalog. */
export interface ApiToken {
  readonly id: string;
  readonly ownerUserId: UserId;
  readonly businessId: BusinessId | null;
  readonly scopes: readonly string[];
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
  readonly revokedAt: Date | null;
}

/** Non-human principal (integrations, jobs) with its own role assignment. */
export interface ServiceAccount {
  readonly id: string;
  readonly businessId: BusinessId | null;
  readonly label: string;
  readonly roleIds: readonly RoleId[];
  readonly disabled: boolean;
}
