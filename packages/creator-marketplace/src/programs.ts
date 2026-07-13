import {
  type BusinessId,
  type MoneyJSON,
  type Result,
  type TenantId,
  type UserId,
  err,
  Money,
  ok,
  ValidationError,
} from "@partnera/core";
import {
  type AffiliateAccessStatus,
  type AffiliateRank,
  type CommercialStatus,
  type EditingStatus,
  type InternalUseStatus,
  type LegalStatus,
  type LibraryStatus,
  type QueueState,
} from "./vocab";
import {
  type BusinessPlanId,
  type ContentCampaignId,
  type CreatorId,
  type CreatorProgramId,
  type EvaluationSchemeId,
  type OpportunityId,
  type PlacementId,
  type PromotionalChannelId,
  type SubmissionId,
} from "./ids";

/**
 * Configurable business programs. Everything a business decides about *its own*
 * program lives here as data: the evaluation categories and the payment each
 * maps to, acceptance capacity, budget, and how a submission is classified for
 * payment vs. quality vs. reuse (three independent decisions). Partnera imposes
 * none of these values — it validates and interprets them.
 */

// ==========================================================================
// Evaluation scheme (custom categories → payment)
// ==========================================================================

/**
 * One business-defined quality category. The business owns every field: name,
 * score band, whether it pays and how much, and whether content in this category
 * may enter the library or reach affiliates. Partnera never hardcodes these.
 */
export interface EvaluationCategory {
  readonly key: string;
  readonly name: string;
  readonly description: string;
  readonly order: number;
  readonly color: string;
  readonly minScore: number; // 0-100 band this category covers
  readonly maxScore: number;
  readonly paymentMinor: string; // business-set payment for this category
  readonly currency: string;
  readonly payable: boolean;
  readonly revisionAllowed: boolean;
  readonly libraryEligible: boolean;
  readonly affiliateEligible: boolean;
  readonly humanApprovalRequired: boolean;
  readonly active: boolean;
}

/** A business's evaluation scheme: an ordered set of its own categories. */
export interface EvaluationScheme {
  readonly id: EvaluationSchemeId;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly programId: CreatorProgramId;
  readonly name: string;
  readonly categories: readonly EvaluationCategory[];
  readonly updatedAt: Date;
}

/** Build a category with sensible, fully-editable defaults. */
export function makeCategory(input: Partial<EvaluationCategory> & { key: string; name: string; order: number }): EvaluationCategory {
  return {
    description: "",
    color: "#6b7280",
    minScore: 0,
    maxScore: 100,
    paymentMinor: "0",
    currency: "USD",
    payable: true,
    revisionAllowed: true,
    libraryEligible: true,
    affiliateEligible: false,
    humanApprovalRequired: true,
    active: true,
    ...input,
  };
}

/**
 * The generic Partnera **default** scheme template — a single "Approved"
 * category. Every value is editable; a business may replace it entirely. This is
 * a starting point, not a global constant applied to anyone.
 */
export function defaultSchemeCategories(currency = "USD"): EvaluationCategory[] {
  return [
    makeCategory({ key: "approved", name: "Approved", order: 1, minScore: 50, maxScore: 100, paymentMinor: "0", currency, color: "#16a34a", affiliateEligible: true, description: "Meets the brief." }),
  ];
}

/** Look up the category a score falls into (highest-ordered matching active band). */
export function categoryForScore(scheme: EvaluationScheme, score: number): EvaluationCategory | null {
  const matches = scheme.categories.filter((c) => c.active && score >= c.minScore && score <= c.maxScore);
  if (matches.length === 0) return null;
  return matches.reduce((best, c) => (c.order > best.order ? c : best));
}

export function categoryByKey(scheme: EvaluationScheme, key: string): EvaluationCategory | null {
  return scheme.categories.find((c) => c.key === key) ?? null;
}

/** The payment a confirmed category maps to (business config, not AI). */
export function paymentForCategory(scheme: EvaluationScheme, key: string): { payable: boolean; amount: MoneyJSON | null } {
  const category = categoryByKey(scheme, key);
  if (!category) return { payable: false, amount: null };
  if (!category.payable) return { payable: false, amount: Money.zero(category.currency).toJSON() };
  return { payable: true, amount: Money.ofMinor(BigInt(category.paymentMinor), category.currency).toJSON() };
}

/** Validate a scheme: at least one category, unique keys, valid bands + payments. */
export function validateScheme(scheme: EvaluationScheme): Result<EvaluationScheme, ValidationError> {
  if (scheme.categories.length === 0) {
    return err(new ValidationError("An evaluation scheme needs at least one category", { schemeId: scheme.id }));
  }
  const keys = new Set<string>();
  for (const c of scheme.categories) {
    if (keys.has(c.key)) return err(new ValidationError("Duplicate category key", { key: c.key }));
    keys.add(c.key);
    if (c.minScore < 0 || c.maxScore > 100 || c.minScore > c.maxScore) {
      return err(new ValidationError("Invalid score band", { key: c.key, minScore: c.minScore, maxScore: c.maxScore }));
    }
    if (BigInt(c.paymentMinor) < 0n) {
      return err(new ValidationError("Category payment cannot be negative", { key: c.key }));
    }
  }
  return ok(scheme);
}

// ==========================================================================
// Capacity & budget
// ==========================================================================

/** Business-configured acceptance limits. Any unset field means "no limit". */
export interface ProgramCapacity {
  readonly programId: CreatorProgramId;
  readonly tenantId: TenantId;
  readonly maxAccepted?: number;
  readonly maxPaid?: number;
  readonly maxActive?: number;
  readonly perOpportunity?: number;
  readonly perCreator?: number;
  readonly maxWeekly?: number;
  readonly maxMonthly?: number;
  /** When a limit is reached: pause new submissions, or keep receiving them. */
  readonly pauseWhenReached: boolean;
}

/** Business-configured budget for a program (committed/paid/remaining are derived). */
export interface ProgramBudget {
  readonly programId: CreatorProgramId;
  readonly tenantId: TenantId;
  readonly currency: string;
  readonly totalMinor: string;
  readonly reservedMinor: string;
}

/** Derived financial exposure — never stored as truth; folded from payments. */
export interface BudgetExposure {
  readonly currency: string;
  readonly committed: MoneyJSON; // approved/scheduled but not yet paid
  readonly paid: MoneyJSON;
  readonly reserved: MoneyJSON;
  readonly total: MoneyJSON;
  readonly remaining: MoneyJSON;
  readonly projectedFee: MoneyJSON;
  readonly projectedTotalCost: MoneyJSON;
}

/**
 * Compute a program's budget exposure from its payments. `committed` counts
 * approved+scheduled payables; `paid` counts paid ones. `remaining` = total −
 * reserved − committed − paid. Fee is projected at the given rate.
 */
export function computeExposure(
  budget: ProgramBudget,
  committedMinor: bigint,
  paidMinor: bigint,
  feeBps: number,
): BudgetExposure {
  const cur = budget.currency;
  const total = Money.ofMinor(BigInt(budget.totalMinor), cur);
  const reserved = Money.ofMinor(BigInt(budget.reservedMinor), cur);
  const committed = Money.ofMinor(committedMinor, cur);
  const paid = Money.ofMinor(paidMinor, cur);
  const remaining = total.subtract(reserved).subtract(committed).subtract(paid);
  const spend = committed.add(paid);
  const projectedFee = spend.applyBasisPoints(feeBps);
  return {
    currency: cur,
    committed: committed.toJSON(),
    paid: paid.toJSON(),
    reserved: reserved.toJSON(),
    total: total.toJSON(),
    remaining: remaining.toJSON(),
    projectedFee: projectedFee.toJSON(),
    projectedTotalCost: spend.add(projectedFee).toJSON(),
  };
}

export interface CapacityCounts {
  readonly accepted: number;
  readonly paid: number;
  readonly active: number;
  readonly perOpportunity: number;
  readonly perCreator: number;
}

/**
 * Decide the queue state a newly-reviewable submission should take given the
 * business's capacity and budget. Never returns "rejected" — over-limit content
 * waits, it is not discarded (Part 9/10 of the brief).
 */
export function capacityGate(
  capacity: ProgramCapacity | null,
  counts: CapacityCounts,
  budgetRemainingMinor: bigint,
  nextPaymentMinor: bigint,
): { state: Extract<QueueState, "under_review" | "waiting_for_capacity" | "waiting_for_budget"> } {
  if (capacity) {
    const overCapacity =
      (capacity.maxAccepted !== undefined && counts.accepted >= capacity.maxAccepted) ||
      (capacity.maxActive !== undefined && counts.active >= capacity.maxActive) ||
      (capacity.perOpportunity !== undefined && counts.perOpportunity >= capacity.perOpportunity) ||
      (capacity.perCreator !== undefined && counts.perCreator >= capacity.perCreator);
    if (overCapacity) return { state: "waiting_for_capacity" };
  }
  if (nextPaymentMinor > budgetRemainingMinor) return { state: "waiting_for_budget" };
  return { state: "under_review" };
}

// ==========================================================================
// Content disposition (three independent decisions: pay / quality / reuse)
// ==========================================================================

/**
 * A submission's business-side disposition — separate, independent fields for
 * payment, quality, and reuse. A submission may be not-payable-but-reusable, or
 * payable-but-not-affiliate-eligible, etc. Never collapsed into one flag.
 */
export interface SubmissionDisposition {
  readonly submissionId: SubmissionId;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly queueState: QueueState;
  readonly categoryKey: string | null;
  readonly paymentEligible: boolean;
  readonly paymentMinor: string | null;
  readonly currency: string | null;
  readonly libraryStatus: LibraryStatus;
  readonly affiliateAccess: AffiliateAccessStatus;
  readonly editingStatus: EditingStatus;
  readonly commercialStatus: CommercialStatus;
  readonly legalStatus: LegalStatus;
  readonly internalUse: InternalUseStatus;
  readonly updatedAt: Date;
}

export function defaultDisposition(submissionId: SubmissionId, tenantId: TenantId, businessId: BusinessId, now: Date, queueState: QueueState = "submitted"): SubmissionDisposition {
  return {
    submissionId, tenantId, businessId, queueState,
    categoryKey: null, paymentEligible: false, paymentMinor: null, currency: null,
    libraryStatus: "none", affiliateAccess: "none", editingStatus: "none",
    commercialStatus: "undecided", legalStatus: "pending", internalUse: "none",
    updatedAt: now,
  };
}

// ==========================================================================
// AI recommendation vs. human decision (kept distinct)
// ==========================================================================

/** AI advisory output: two scores + a recommended category. Never sets payment. */
export interface ReviewRecommendation {
  readonly technicalScore: number;
  readonly commercialScore: number;
  readonly combinedScore: number;
  readonly recommendedCategoryKey: string | null;
  readonly confidence: number;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly failedRequirements: readonly string[];
}

/** The human's binding decision — the only thing that sets category + payment. */
export interface HumanReviewDecision {
  readonly categoryKey: string;
  readonly paymentMinor: string;
  readonly currency: string;
  readonly accepted: boolean;
  readonly reviewerUserId: UserId;
  readonly reason: string;
}

// ==========================================================================
// Business plans / trials (provisional; no billing)
// ==========================================================================

/** A provisional, editable local plan definition. No prices are locked. */
export interface BusinessPlanDefinition {
  readonly id: BusinessPlanId;
  readonly key: string;
  readonly name: string;
  readonly provisional: true;
  readonly trialDays: number;
  readonly maxActivePrograms?: number;
  readonly maxActiveOpportunities?: number;
  readonly submissionsPerMonth?: number;
  readonly acceptedPerMonth?: number;
  readonly storageAllowanceMb?: number;
  readonly staffReviewers?: number;
  readonly aiReviewAllowance?: number;
  readonly transactionFeeBps: number;
  readonly customBranding: boolean;
  readonly notes: string;
}

export type TrialState = "trial" | "active" | "downgraded" | "read_only";

export interface BusinessTrialState {
  readonly businessId: BusinessId;
  readonly planKey: string;
  readonly state: TrialState;
  readonly startedAt: Date;
  readonly trialEndsAt: Date;
}

// ==========================================================================
// Promotional channels (configurable, disclosed; no paid media)
// ==========================================================================

export type PromotionKind = "featured_business" | "promoted_opportunity" | "sponsored_placement" | "house_promotion";

export interface PromotionalChannel {
  readonly id: PromotionalChannelId;
  readonly tenantId: TenantId | null; // null = platform house channel
  readonly kind: PromotionKind;
  readonly name: string;
  readonly active: boolean;
  readonly createdAt: Date;
}

export interface PromotedPlacement {
  readonly id: PlacementId;
  readonly channelId: PromotionalChannelId;
  readonly tenantId: TenantId | null;
  readonly subjectType: "business" | "opportunity" | "program" | "app";
  readonly subjectId: string;
  readonly priority: number;
  readonly startAt: Date;
  readonly endAt: Date;
  /** Every promoted placement MUST carry a disclosure (Part 10). */
  readonly disclosure: string;
  readonly status: "draft" | "approved" | "active" | "ended";
  readonly createdAt: Date;
}

/** Re-exports so downstream types can import affiliate rank alongside programs. */
export type { AffiliateRank, ContentCampaignId, CreatorId, OpportunityId };
