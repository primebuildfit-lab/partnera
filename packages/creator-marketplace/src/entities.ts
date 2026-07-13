import { type BusinessId, type MoneyJSON, type TenantId, type UserId } from "@partnera/core";
import { type FeeSnapshot } from "./config";
import {
  type AIReviewRunId,
  type ApplicationId,
  type ContentAssetId,
  type ContentCampaignId,
  type ContentLicenseId,
  type CreatorId,
  type CreatorJobId,
  type CreatorPaymentId,
  type CreatorProgramId,
  type DeliverableId,
  type DisputeId,
  type OpportunityId,
  type RankUnlockRuleId,
  type ReviewId,
  type SubmissionId,
  type SubmissionVersionId,
} from "./ids";
import {
  type AffiliateRank,
  type ApplicationStatus,
  type ApprovalMode,
  type AssetStatus,
  type ContentFormat,
  type DisputeStatus,
  type Exclusivity,
  type LicenseStatus,
  type OpportunityStatus,
  type PaymentReason,
  type PaymentStatus,
  type Platform,
  type SubmissionStatus,
  type UsageRight,
  type VerificationLevel,
} from "./vocab";

/**
 * Persisted record shapes for the Creator Marketplace. These are the rows the
 * repositories store. Money is JSON-safe {@link MoneyJSON}; ids are branded; the
 * creator is an actor (not a tenant), while business-owned records are
 * tenant-scoped by `tenantId`/`businessId`.
 */

export interface CreatorProfile {
  readonly id: CreatorId;
  /** The global user identity behind this creator (one profile per user). */
  readonly userId: UserId;
  readonly displayName: string;
  readonly skills: readonly string[];
  readonly formats: readonly ContentFormat[];
  readonly platforms: readonly Platform[];
  readonly verification: VerificationLevel;
  readonly status: "active" | "suspended" | "closed";
  readonly createdAt: Date;
}

/** Per-business relationship for a creator (eligibility + standing + isolation). */
export interface CreatorCompanyRelationship {
  readonly creatorId: CreatorId;
  readonly businessId: BusinessId;
  readonly status: ApplicationStatus;
  readonly goodStanding: boolean;
  readonly updatedAt: Date;
}

export interface CreatorProgram {
  readonly id: CreatorProgramId;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly name: string;
  readonly slug: string;
  readonly status: "draft" | "active" | "paused" | "closed";
  readonly approvalMode: ApprovalMode;
  readonly createdAt: Date;
}

export interface ContentCampaign {
  readonly id: ContentCampaignId;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly programId: CreatorProgramId;
  readonly name: string;
  readonly budget: MoneyJSON;
  readonly spent: MoneyJSON;
  readonly status: "draft" | "open" | "paused" | "closed";
  readonly createdAt: Date;
}

export interface DeliverableRequirement {
  readonly id: DeliverableId;
  readonly opportunityId: OpportunityId;
  readonly format: ContentFormat;
  readonly platform?: Platform;
  readonly minWidthPx?: number;
  readonly minHeightPx?: number;
  readonly minDurationSec?: number;
  readonly maxDurationSec?: number;
  readonly requiresAudio?: boolean;
  readonly requiresCta?: boolean;
  readonly language?: string;
  readonly talkingPoints: readonly string[];
  readonly prohibitedClaims: readonly string[];
  readonly payment: MoneyJSON;
  readonly usageRights: readonly UsageRight[];
  readonly exclusivity: Exclusivity;
  readonly licenseDurationDays: number;
  readonly revisionAllowance: number;
}

export interface ContentOpportunity {
  readonly id: OpportunityId;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly campaignId: ContentCampaignId;
  readonly title: string;
  readonly description: string;
  readonly status: OpportunityStatus;
  readonly eligibility: "open" | "invite" | "private_pool";
  readonly minRank?: AffiliateRank;
  readonly publishAt?: Date;
  readonly deadlineAt?: Date;
  /** Spec version frozen when a creator accepts terms (explainability). */
  readonly specVersion: number;
  readonly createdAt: Date;
}

export interface CreatorApplication {
  readonly id: ApplicationId;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly opportunityId: OpportunityId;
  readonly creatorId: CreatorId;
  readonly status: ApplicationStatus;
  /** Fee snapshot locked when the creator accepted terms (null until accepted). */
  readonly feeSnapshot: FeeSnapshot | null;
  readonly jobId: CreatorJobId | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Submission {
  readonly id: SubmissionId;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly opportunityId: OpportunityId;
  readonly deliverableId: DeliverableId;
  readonly jobId: CreatorJobId;
  readonly creatorId: CreatorId;
  readonly status: SubmissionStatus;
  readonly currentVersionId: SubmissionVersionId | null;
  readonly revisionsUsed: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Append-only: one row per (re)submission. Local mode uses demo file metadata only. */
export interface SubmissionVersion {
  readonly id: SubmissionVersionId;
  readonly submissionId: SubmissionId;
  readonly seq: number;
  /** Local/demo storage: metadata only; no real upload occurred. */
  readonly demoStorage: true;
  readonly fileName: string;
  readonly widthPx?: number;
  readonly heightPx?: number;
  readonly durationSec?: number;
  readonly hasAudio?: boolean;
  readonly hasCta?: boolean;
  readonly language?: string;
  readonly note?: string;
  readonly createdAt: Date;
}

/** Append-only review record (human or AI-linked). */
export interface SubmissionReview {
  readonly id: ReviewId;
  readonly tenantId: TenantId;
  readonly submissionId: SubmissionId;
  readonly versionId: SubmissionVersionId;
  readonly reviewerUserId: UserId | null;
  readonly aiRunId: AIReviewRunId | null;
  readonly decision: "approve" | "revision" | "reject";
  readonly weightedScore: number;
  readonly mandatoryPassed: boolean;
  readonly reason: string;
  readonly overrideOfRunId: AIReviewRunId | null;
  readonly createdAt: Date;
}

export interface ContentLicense {
  readonly id: ContentLicenseId;
  readonly assetId: ContentAssetId;
  readonly usageRights: readonly UsageRight[];
  readonly exclusivity: Exclusivity;
  readonly status: LicenseStatus;
  readonly startAt: Date;
  readonly endAt: Date;
}

export interface ContentAsset {
  readonly id: ContentAssetId;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly campaignId: ContentCampaignId;
  readonly creatorId: CreatorId;
  readonly sourceVersionId: SubmissionVersionId;
  readonly title: string;
  readonly format: ContentFormat;
  readonly platform?: Platform;
  readonly language?: string;
  readonly status: AssetStatus;
  readonly createdAt: Date;
}

export interface RankUnlockRule {
  readonly id: RankUnlockRuleId;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly campaignId: ContentCampaignId | null;
  readonly minRank: AffiliateRank;
  readonly status: "draft" | "active" | "paused";
  readonly createdAt: Date;
}

/** Logical payable; money truth lives in the append-only creator-ledger stream. */
export interface CreatorPayment {
  readonly id: CreatorPaymentId;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly creatorId: CreatorId;
  readonly submissionId: SubmissionId;
  readonly reason: PaymentReason;
  readonly gross: MoneyJSON;
  readonly status: PaymentStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface Dispute {
  readonly id: DisputeId;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly submissionId: SubmissionId;
  readonly openedByUserId: UserId;
  readonly status: DisputeStatus;
  readonly reason: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
