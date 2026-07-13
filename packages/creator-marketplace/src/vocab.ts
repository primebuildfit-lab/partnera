/**
 * Configurable vocabularies and status enumerations for the Creator Marketplace.
 *
 * These are the single source of truth for every state string in the module — no
 * scattered literals, no duplicated unions. State machines in `./state/*` import
 * these and define the legal transitions over them.
 */

// --- Content formats & platforms (config-driven catalogs, extensible) ---
export const CONTENT_FORMATS = [
  "short_form_video",
  "long_form_video",
  "ugc_video",
  "product_demo",
  "testimonial",
  "tutorial",
  "unboxing",
  "product_photography",
  "lifestyle_photography",
  "carousel",
  "banner",
  "voiceover",
  "blog_article",
  "script",
  "caption",
  "livestream",
  "raw_footage",
  "edited_footage",
  "reusable_template",
  "custom",
] as const;
export type ContentFormat = (typeof CONTENT_FORMATS)[number];

export const PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "x",
  "pinterest",
  "linkedin",
  "web",
  "other",
] as const;
export type Platform = (typeof PLATFORMS)[number];

// --- Lifecycle status vocabularies ---
export const OPPORTUNITY_STATUSES = [
  "draft",
  "scheduled",
  "open",
  "paused",
  "closed",
  "cancelled",
  "archived",
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export const APPLICATION_STATUSES = [
  "eligible",
  "applied",
  "invited",
  "accepted",
  "rejected",
  "withdrawn",
  "blocked",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const SUBMISSION_STATUSES = [
  "draft",
  "uploaded",
  "validating",
  "under_review",
  "revision_requested",
  "resubmitted",
  "approved",
  "rejected",
  "disputed",
  "expired",
  "archived",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "not_eligible",
  "pending_approval",
  "approved",
  "scheduled",
  "processing",
  "paid",
  "failed",
  "cancelled",
  "reversed",
  "disputed",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DISPUTE_STATUSES = [
  "open",
  "evidence",
  "under_moderation",
  "resolved_creator",
  "resolved_business",
  "resolved_split",
  "withdrawn",
  "escalated",
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const ASSET_STATUSES = [
  "pending",
  "published",
  "restricted",
  "expired",
  "withdrawn",
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const LICENSE_STATUSES = ["active", "expiring", "expired", "revoked"] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export const MODERATION_STATUSES = [
  "open",
  "under_review",
  "actioned",
  "dismissed",
  "escalated",
] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

// --- Rights & license vocabularies ---
export const USAGE_RIGHTS = [
  "organic_only",
  "owned_channels",
  "paid_ads",
  "affiliate_distribution",
] as const;
export type UsageRight = (typeof USAGE_RIGHTS)[number];

export const EXCLUSIVITY = ["none", "category", "full"] as const;
export type Exclusivity = (typeof EXCLUSIVITY)[number];

// --- Review categories (weights configured separately) ---
export const REVIEW_CATEGORIES = [
  "brief_compliance",
  "technical_quality",
  "brand_alignment",
  "creativity",
  "product_clarity",
] as const;
export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number];

/** Mandatory-pass gates: failing any is an automatic non-approval regardless of score. */
export const MANDATORY_GATES = ["legal_safety", "file_requirements"] as const;
export type MandatoryGate = (typeof MANDATORY_GATES)[number];

// --- Approval modes (D-306) ---
export const APPROVAL_MODES = [
  "human_only",
  "ai_recommend_human_decide",
  "ai_objective_human_creative",
  "bounded_automated",
] as const;
export type ApprovalMode = (typeof APPROVAL_MODES)[number];

// --- Affiliate rank ladder (reuses affiliate tiers where available; default ladder) ---
export const AFFILIATE_RANKS = ["bronze", "silver", "gold", "elite"] as const;
export type AffiliateRank = (typeof AFFILIATE_RANKS)[number];

/** Numeric rank order for "at or above" comparisons in rank-unlock resolution. */
export const RANK_ORDER: Readonly<Record<AffiliateRank, number>> = {
  bronze: 0,
  silver: 1,
  gold: 2,
  elite: 3,
};

/** Verification levels for trust & safety (fraud floors gate payouts by level). */
export const VERIFICATION_LEVELS = ["l0", "l1", "l2", "l3"] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

/** Money reasons on the creator-payment append-only stream (distinct from affiliate commissions). */
export const PAYMENT_REASONS = [
  "deliverable",
  "milestone",
  "bonus",
  "reimbursement",
] as const;
export type PaymentReason = (typeof PAYMENT_REASONS)[number];

/** True when `value` is a member of `vocab`. Narrows the type on success. */
export function isMember<T extends string>(vocab: readonly T[], value: string): value is T {
  return (vocab as readonly string[]).includes(value);
}
