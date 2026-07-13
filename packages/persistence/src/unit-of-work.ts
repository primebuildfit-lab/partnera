import { type AuditLogEntry } from "@partnera/platform";
import { type Business, type Membership, type Organization, type Role, type User } from "@partnera/auth";
import { type LedgerEvent } from "@partnera/commission-engine";
import { type PayoutEvent } from "@partnera/payment-engine";
import { type FraudCase } from "@partnera/fraud-engine";
import {
  type Click,
  type Conversion,
  type CouponUse,
  type NormalizedOrder,
  type TrackingSession,
} from "@partnera/tracking-engine";
import {
  type DeliveryRecord,
  type NotificationPreference,
  type NotificationTemplate,
  type QueuedNotification,
} from "@partnera/notification-engine";
import {
  type ContentAsset,
  type ContentCampaign,
  type ContentLicense,
  type ContentOpportunity,
  type CreatorApplication,
  type CreatorCompanyRelationship,
  type CreatorLedgerEvent,
  type CreatorPayment,
  type CreatorProfile,
  type CreatorProgram,
  type DeliverableRequirement,
  type Dispute,
  type RankUnlockRule,
  type Submission,
  type SubmissionReview,
  type SubmissionVersion,
} from "@partnera/creator-marketplace";
import { RelationalStore } from "./relational/store";
import { AuditRepository } from "./repositories/audit";
import { CreatorRepository } from "./repositories/creator";
import { ConfigRepository, type ConfigRow, configPk } from "./repositories/config";
import { ExtensionRepository, type ExtensionRow } from "./repositories/extension";
import { FraudRepository, type FraudSignalRow, type RiskScoreRow } from "./repositories/fraud";
import { IdempotencyRepository, type IdempotencyRow } from "./repositories/idempotency";
import { IdentityRepository } from "./repositories/identity";
import { LedgerRepository } from "./repositories/ledger";
import { NotificationRepository } from "./repositories/notification";
import { OfferRepository, type OfferRow, type OfferVersionRow } from "./repositories/offer";
import { PayoutRepository } from "./repositories/payout";
import {
  type CouponRow,
  type RefundRow,
  type TrackingLinkRow,
  TrackingRepository,
} from "./repositories/tracking";

type DeliveryRow = DeliveryRecord & { readonly id: string };

/**
 * A `UnitOfWork` is one logical database: it declares every table (primary key,
 * unique constraints, append-only flag — mirroring prisma/schema.prisma) and
 * constructs the repositories over a single {@link RelationalStore}. Swapping to
 * Postgres means providing a Prisma-backed store with the same collection
 * surface; nothing above this file changes.
 */
export class UnitOfWork {
  readonly store: RelationalStore;

  readonly identity: IdentityRepository;
  readonly offers: OfferRepository;
  readonly tracking: TrackingRepository;
  readonly ledger: LedgerRepository;
  readonly payouts: PayoutRepository;
  readonly fraud: FraudRepository;
  readonly notifications: NotificationRepository;
  readonly extensions: ExtensionRepository;
  readonly config: ConfigRepository;
  readonly audit: AuditRepository;
  readonly idempotency: IdempotencyRepository;
  readonly creator: CreatorRepository;

  constructor(store: RelationalStore = new RelationalStore()) {
    this.store = store;

    // --- Identity & tenancy ---
    const users = store.define<User>("users", {
      pk: (u) => u.id,
      unique: [{ name: "email", key: (u) => u.email.toLowerCase() }],
    });
    const organizations = store.define<Organization>("organizations", { pk: (o) => o.id });
    const businesses = store.define<Business>("businesses", { pk: (b) => b.id });
    const memberships = store.define<Membership>("memberships", { pk: (m) => m.id });
    const roles = store.define<Role>("roles", { pk: (r) => r.id });
    this.identity = new IdentityRepository(users, organizations, businesses, memberships, roles);

    // --- Offers (append-only versions) ---
    const offers = store.define<OfferRow>("offers", { pk: (o) => o.id });
    const offerVersions = store.define<OfferVersionRow>("offer_versions", {
      pk: (v) => `${v.offerId}:${v.version}`,
      appendOnly: true,
    });
    this.offers = new OfferRepository(offers, offerVersions);

    // --- Tracking ---
    const links = store.define<TrackingLinkRow>("tracking_links", {
      pk: (l) => l.id,
      unique: [{ name: "tenant_code", key: (l) => `${l.tenantId}:${l.code}` }],
    });
    const coupons = store.define<CouponRow>("coupons", {
      pk: (c) => c.id,
      unique: [{ name: "tenant_code", key: (c) => `${c.tenantId}:${c.code}` }],
    });
    const sessions = store.define<TrackingSession>("tracking_sessions", {
      pk: (s) => `${s.tenantId}:${s.token}`,
    });
    const clicks = store.define<Click>("clicks", { pk: (c) => c.id, appendOnly: true });
    const couponUses = store.define<CouponUse>("coupon_uses", {
      pk: (u) => `${u.couponId}:${u.orderId}`,
      appendOnly: true,
    });
    const orders = store.define<NormalizedOrder>("orders", {
      pk: (o) => o.id,
      unique: [{ name: "tenant_platform_order", key: (o) => `${o.tenantId}:${o.platformOrderId}` }],
    });
    const conversions = store.define<Conversion>("conversions", {
      pk: (c) => c.id,
      unique: [{ name: "tenant_order", key: (c) => `${c.tenantId}:${c.orderId}` }],
    });
    const refunds = store.define<RefundRow>("refunds", { pk: (r) => r.id, appendOnly: true });
    this.tracking = new TrackingRepository(
      links,
      coupons,
      sessions,
      clicks,
      couponUses,
      orders,
      conversions,
      refunds,
    );

    // --- Money spine: append-only ledger + payouts ---
    const ledgerEvents = store.define<LedgerEvent>("ledger_events", {
      pk: (e) => e.id,
      appendOnly: true,
    });
    this.ledger = new LedgerRepository(store, ledgerEvents);

    const payoutEvents = store.define<PayoutEvent>("payout_events", {
      pk: (e) => e.id,
      appendOnly: true,
    });
    this.payouts = new PayoutRepository(store, payoutEvents);

    // --- Fraud ---
    const fraudSignals = store.define<FraudSignalRow>("fraud_signals", {
      pk: (s) => s.id,
      appendOnly: true,
    });
    const riskScores = store.define<RiskScoreRow>("fraud_scores", {
      pk: (s) => s.id,
      appendOnly: true,
    });
    const fraudCases = store.define<FraudCase>("fraud_cases", { pk: (c) => c.id });
    this.fraud = new FraudRepository(fraudSignals, riskScores, fraudCases);

    // --- Notifications ---
    const queue = store.define<QueuedNotification>("notifications", { pk: (n) => n.id });
    const deliveries = store.define<DeliveryRow>("delivery_records", {
      pk: (d) => d.id,
      appendOnly: true,
    });
    const preferences = store.define<NotificationPreference>("notification_preferences", {
      pk: (p) => p.userId,
    });
    const templates = store.define<NotificationTemplate>("notification_templates", {
      pk: (t) => t.key,
    });
    this.notifications = new NotificationRepository(queue, deliveries, preferences, templates);

    // --- Extensions ---
    const extensions = store.define<ExtensionRow>("extensions", {
      pk: (e) => e.id,
      unique: [{ name: "key_version", key: (e) => `${e.manifest.key}@${e.manifest.version}` }],
    });
    this.extensions = new ExtensionRepository(extensions);

    // --- Configuration & audit ---
    const configValues = store.define<ConfigRow>("config_values", {
      pk: (c) => configPk(c.key, c.tenantId),
    });
    this.config = new ConfigRepository(configValues);

    const auditLog = store.define<AuditLogEntry>("audit_log", { pk: (a) => a.id, appendOnly: true });
    this.audit = new AuditRepository(auditLog);

    const idempotencyKeys = store.define<IdempotencyRow>("idempotency_keys", {
      pk: (r) => `${r.scope}::${r.key}`,
      appendOnly: true,
    });
    this.idempotency = new IdempotencyRepository(idempotencyKeys);

    // --- Creator Marketplace ---
    // Business-owned records are tenant-scoped; creator profiles are cross-tenant
    // actors. Submission versions, reviews, and the creator-payment ledger are
    // append-only (same money discipline as the commission ledger).
    const creatorProfiles = store.define<CreatorProfile>("creator_profiles", {
      pk: (p) => p.id,
      unique: [{ name: "user", key: (p) => p.userId }],
    });
    const creatorRelationships = store.define<CreatorCompanyRelationship>("creator_relationships", {
      pk: (r) => `${r.creatorId}:${r.businessId}`,
    });
    const creatorPrograms = store.define<CreatorProgram>("creator_programs", {
      pk: (p) => p.id,
      unique: [{ name: "tenant_slug", key: (p) => `${p.tenantId}:${p.slug}` }],
    });
    const contentCampaigns = store.define<ContentCampaign>("content_campaigns", { pk: (c) => c.id });
    const contentOpportunities = store.define<ContentOpportunity>("content_opportunities", {
      pk: (o) => o.id,
    });
    const deliverableRequirements = store.define<DeliverableRequirement>("deliverable_requirements", {
      pk: (d) => d.id,
    });
    const creatorApplications = store.define<CreatorApplication>("creator_applications", {
      pk: (a) => a.id,
      unique: [{ name: "opp_creator", key: (a) => `${a.opportunityId}:${a.creatorId}` }],
    });
    const submissions = store.define<Submission>("submissions", { pk: (s) => s.id });
    const submissionVersions = store.define<SubmissionVersion>("submission_versions", {
      pk: (v) => v.id,
      appendOnly: true,
    });
    const submissionReviews = store.define<SubmissionReview>("submission_reviews", {
      pk: (r) => r.id,
      appendOnly: true,
    });
    const contentAssets = store.define<ContentAsset>("content_assets", { pk: (a) => a.id });
    const contentLicenses = store.define<ContentLicense>("content_licenses", {
      pk: (l) => l.id,
      unique: [{ name: "asset", key: (l) => l.assetId }],
    });
    const rankUnlockRules = store.define<RankUnlockRule>("rank_unlock_rules", { pk: (r) => r.id });
    const creatorPayments = store.define<CreatorPayment>("creator_payments", { pk: (p) => p.id });
    const creatorLedgerEvents = store.define<CreatorLedgerEvent>("creator_ledger_events", {
      pk: (e) => e.id,
      appendOnly: true,
    });
    const creatorDisputes = store.define<Dispute>("creator_disputes", { pk: (d) => d.id });
    this.creator = new CreatorRepository(
      store,
      creatorProfiles,
      creatorRelationships,
      creatorPrograms,
      contentCampaigns,
      contentOpportunities,
      deliverableRequirements,
      creatorApplications,
      submissions,
      submissionVersions,
      submissionReviews,
      contentAssets,
      contentLicenses,
      rankUnlockRules,
      creatorPayments,
      creatorLedgerEvents,
      creatorDisputes,
    );

    // Seed platform-managed system roles so authorization works out of the box.
    this.identity.seedSystemRoles();
  }

  /** Run a function atomically across all repositories. */
  transact<T>(fn: () => Promise<T> | T): Promise<T> {
    return this.store.transact(fn);
  }
}
