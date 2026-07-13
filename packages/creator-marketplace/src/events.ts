/**
 * Versioned domain-event names for the Creator Marketplace. Names are stable,
 * dotted, and carry an explicit schema version so consumers can evolve safely.
 * These match the contracts in docs/creator-marketplace/API_AND_EVENTS.md.
 */
export const CREATOR_EVENT_VERSION = 1 as const;

export const CREATOR_EVENTS = {
  profileCreated: "creator.profile_created",
  joinedBusiness: "creator.joined_business",
  opportunityPublished: "opportunity.published",
  opportunityClosed: "opportunity.closed",
  applicationSubmitted: "application.submitted",
  applicationInvited: "application.invited",
  applicationAccepted: "application.accepted",
  submissionUploaded: "submission.uploaded",
  submissionReviewStarted: "submission.review_started",
  submissionRevisionRequested: "submission.revision_requested",
  submissionApproved: "submission.approved",
  submissionRejected: "submission.rejected",
  aiReviewCompleted: "aireview.completed",
  paymentAuthorized: "payment.authorized",
  paymentProcessing: "payment.processing",
  paymentPaid: "payment.paid",
  paymentFailed: "payment.failed",
  paymentReversed: "payment.reversed",
  platformFeeRecognized: "platform_fee.recognized",
  platformFeeReversed: "platform_fee.reversed",
  disputeOpened: "dispute.opened",
  disputeResolved: "dispute.resolved",
  contentPublishedToLibrary: "content.published_to_library",
  affiliateContentUnlocked: "affiliate.content_unlocked",
  licenseExpired: "license.expired",
  rankUnlockChanged: "rank_unlock.changed",
} as const;

export type CreatorEventName = (typeof CREATOR_EVENTS)[keyof typeof CREATOR_EVENTS];
