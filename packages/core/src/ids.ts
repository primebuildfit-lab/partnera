import { type Brand } from "./branded";

/**
 * Branded identifier types for every core aggregate. Using distinct types
 * prevents accidentally passing a UserId where a BusinessId is expected — the
 * kind of mistake that, uncaught, becomes a cross-tenant data bug.
 */
export type UserId = Brand<string, "UserId">;
export type OrganizationId = Brand<string, "OrganizationId">;
export type BusinessId = Brand<string, "BusinessId">;
export type MembershipId = Brand<string, "MembershipId">;
export type RoleId = Brand<string, "RoleId">;
export type SessionId = Brand<string, "SessionId">;
export type DeviceId = Brand<string, "DeviceId">;
export type InvitationId = Brand<string, "InvitationId">;

export type AffiliateId = Brand<string, "AffiliateId">;
export type ProgramId = Brand<string, "ProgramId">;
export type OfferId = Brand<string, "OfferId">;
export type CampaignId = Brand<string, "CampaignId">;
export type PartnershipId = Brand<string, "PartnershipId">;

export type ClickId = Brand<string, "ClickId">;
export type CouponId = Brand<string, "CouponId">;
export type ConversionId = Brand<string, "ConversionId">;
export type OrderId = Brand<string, "OrderId">;

export type LedgerEventId = Brand<string, "LedgerEventId">;
export type CommissionId = Brand<string, "CommissionId">;
export type PayoutId = Brand<string, "PayoutId">;

export type FraudCaseId = Brand<string, "FraudCaseId">;
export type ExtensionId = Brand<string, "ExtensionId">;
export type NotificationId = Brand<string, "NotificationId">;
export type AuditEntryId = Brand<string, "AuditEntryId">;

/**
 * Contract for generating identifiers. Kept as an interface so the concrete
 * scheme (UUIDv7, ULID, KSUID…) is a build-phase decision, injected rather than
 * imported. A default UUID-backed implementation is provided for tests and
 * non-persistence use.
 */
export interface IdGenerator {
  next<B extends Brand<string, string>>(): B;
}

export class UuidIdGenerator implements IdGenerator {
  constructor(private readonly random: () => string = () => crypto.randomUUID()) {}

  next<B extends Brand<string, string>>(): B {
    return this.random() as unknown as B;
  }
}

/** Wrap a known-good string as a branded id (trusted boundary only). */
export function asId<B extends Brand<string, string>>(value: string): B {
  return value as unknown as B;
}
