import { type Brand } from "@partnera/core";

/**
 * Branded identifiers for the Creator Marketplace. Distinct nominal types stop a
 * CreatorId being passed where an OpportunityId is expected — the same
 * cross-record safety the platform ids already provide.
 */
export type CreatorId = Brand<string, "CreatorId">;
export type CreatorProgramId = Brand<string, "CreatorProgramId">;
export type CreatorProgramPageId = Brand<string, "CreatorProgramPageId">;
export type ContentCampaignId = Brand<string, "ContentCampaignId">;
export type OpportunityId = Brand<string, "OpportunityId">;
export type DeliverableId = Brand<string, "DeliverableId">;
export type ApplicationId = Brand<string, "ApplicationId">;
export type CreatorJobId = Brand<string, "CreatorJobId">;
export type SubmissionId = Brand<string, "SubmissionId">;
export type SubmissionVersionId = Brand<string, "SubmissionVersionId">;
export type SubmissionFileId = Brand<string, "SubmissionFileId">;
export type ReviewId = Brand<string, "ReviewId">;
export type AIReviewRunId = Brand<string, "AIReviewRunId">;
export type DisputeId = Brand<string, "DisputeId">;
export type ContentAssetId = Brand<string, "ContentAssetId">;
export type ContentLicenseId = Brand<string, "ContentLicenseId">;
export type RankUnlockRuleId = Brand<string, "RankUnlockRuleId">;
export type CreatorPaymentId = Brand<string, "CreatorPaymentId">;
export type CreatorLedgerEventId = Brand<string, "CreatorLedgerEventId">;
export type BusinessRatingId = Brand<string, "BusinessRatingId">;
export type ModerationCaseId = Brand<string, "ModerationCaseId">;
