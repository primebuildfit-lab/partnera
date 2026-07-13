import {
  type BusinessId,
  type DomainEvent,
  IllegalStateError,
  Money,
  NotFoundError,
  PermissionDeniedError,
  type RequestContext,
  ValidationError,
  asId,
} from "@partnera/core";
import {
  type AIReviewInput,
  type AIReviewRunId,
  type AIReviewRunResult,
  APPLICATION_TRANSITIONS,
  type ApplicationId,
  type ApprovalMode,
  type AffiliateRank,
  type AssetAccessContext,
  type ContentAssetId,
  type ContentCampaignId,
  type ContentLicenseId,
  type ContentOpportunity,
  type CreatorApplication,
  type CreatorId,
  type CreatorJobId,
  type CreatorLedgerEvent,
  type CreatorLedgerEventId,
  type CreatorPayment,
  type CreatorPaymentId,
  type CreatorProfile,
  type CreatorProgramId,
  type ContentFormat,
  type DeliverableId,
  type DeliverableRequirement,
  DEFAULT_SCORING_WEIGHTS,
  DeterministicMockReviewer,
  type FeeConfig,
  type FeeSnapshot,
  type OpportunityId,
  OPPORTUNITY_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  type Platform,
  SUBMISSION_TRANSITIONS,
  type RankUnlockRuleId,
  type ReviewCategory,
  type ReviewId,
  type Submission,
  type SubmissionId,
  type SubmissionVersionId,
  CREATOR_EVENTS,
  CREATOR_MARKETPLACE_DEFAULTS,
  computeFee,
  foldCreatorBalances,
  resolveAssetAccess,
  scoreSubmission,
  transition,
  validateFeeConfig,
  // Configurable business programs
  type EvaluationCategory,
  type EvaluationScheme,
  type EvaluationSchemeId,
  type ProgramBudget,
  type ProgramCapacity,
  type SubmissionDisposition,
  type QueueState,
  type LibraryStatus,
  type AffiliateAccessStatus,
  type EditingStatus,
  type CommercialStatus,
  type LegalStatus,
  type InternalUseStatus,
  type ReviewRecommendation,
  capacityGate,
  categoryForScore,
  computeExposure,
  defaultDisposition,
  defaultSchemeCategories,
  mockTwoScoreReview,
  paymentForCategory,
  validateScheme,
} from "@partnera/creator-marketplace";
import { ServiceBase } from "../context";

const reviewer = new DeterministicMockReviewer();

/** Input to create an opportunity with its deliverables. */
export interface CreateOpportunityInput {
  readonly campaignId: ContentCampaignId;
  readonly title: string;
  readonly description: string;
  readonly eligibility: "open" | "invite" | "private_pool";
  readonly deliverables: readonly NewDeliverable[];
}

export interface NewDeliverable {
  readonly format: ContentFormat;
  readonly platform?: Platform;
  readonly paymentMinor: string;
  readonly currency: string;
  readonly minWidthPx?: number;
  readonly minHeightPx?: number;
  readonly minDurationSec?: number;
  readonly maxDurationSec?: number;
  readonly requiresAudio?: boolean;
  readonly requiresCta?: boolean;
  readonly language?: string;
  readonly talkingPoints?: readonly string[];
  readonly prohibitedClaims?: readonly string[];
  readonly licenseDurationDays?: number;
}

export interface SubmitInput {
  readonly opportunityId: OpportunityId;
  readonly deliverableId: DeliverableId;
  readonly fileName: string;
  readonly widthPx?: number;
  readonly heightPx?: number;
  readonly durationSec?: number;
  readonly hasAudio?: boolean;
  readonly hasCta?: boolean;
  readonly language?: string;
  readonly note?: string;
  /** Safety flags surfaced by (mock) scanning; a hard flag blocks review. */
  readonly riskFlags?: readonly string[];
}

export interface DecisionInput {
  readonly decision: "approve" | "revision" | "reject";
  readonly categoryScores: Readonly<Partial<Record<ReviewCategory, number>>>;
  readonly legalSafetyPass: boolean;
  readonly fileRequirementsPass: boolean;
  readonly reason: string;
  readonly overrideOfRunId?: AIReviewRunId;
}

/**
 * Creator Marketplace application services. Reuses {@link ServiceBase} for the
 * security spine (principal resolution, deny-by-default permissions, audit). Two
 * authorization styles:
 *  - **Business/staff actions** go through tenant-scoped RBAC (`this.require`).
 *  - **Creator self-actions** are authorized by **identity ownership** (the actor
 *    owns the CreatorProfile) — creators are cross-tenant actors, so their own
 *    data is not gated by any one tenant's roles (creator privacy, D-316).
 *
 * Money never moves before content approval (D-305); the fee is snapshotted at
 * terms acceptance (D-310); approve/authorize/execute are separate permissions
 * (D-317). Local payouts are **simulated** — no provider, no real money.
 */
export class CreatorService extends ServiceBase {
  // --- Creator self-service (ownership-authorized) ---

  registerProfile(
    ctx: RequestContext,
    input: { displayName: string; skills?: readonly string[]; formats?: readonly ContentFormat[]; platforms?: readonly Platform[] },
  ): CreatorProfile {
    const existing = this.uow.creator.getProfileByUser(ctx.actorUserId);
    if (existing) return existing;
    const profile: CreatorProfile = {
      id: this.ids.next<CreatorId>(),
      userId: ctx.actorUserId,
      displayName: input.displayName,
      skills: input.skills ?? [],
      formats: input.formats ?? [],
      platforms: input.platforms ?? [],
      verification: "l1",
      status: "active",
      createdAt: this.clock.now(),
    };
    this.uow.creator.createProfile(profile);
    void this.emit(CREATOR_EVENTS.profileCreated, ctx, null, { creatorId: profile.id });
    return profile;
  }

  /** Public discovery: only open opportunities, across tenants. */
  discoverOpportunities(): ContentOpportunity[] {
    return this.uow.creator.listOpenOpportunities();
  }

  apply(ctx: RequestContext, opportunityId: OpportunityId): CreatorApplication {
    const creator = this.creatorSelf(ctx);
    const opp = this.uow.creator.getOpportunity(opportunityId);
    if (!opp) throw new NotFoundError("Opportunity not found", { opportunityId });
    if (opp.status !== "open") throw new IllegalStateError("Opportunity is not open", { status: opp.status });

    const existing = this.uow.creator.findApplication(opportunityId, creator.id);
    if (existing) return existing;

    const now = this.clock.now();
    const app: CreatorApplication = {
      id: this.ids.next<ApplicationId>(),
      tenantId: opp.tenantId,
      businessId: opp.businessId,
      opportunityId,
      creatorId: creator.id,
      status: "applied",
      feeSnapshot: null,
      jobId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.uow.creator.createApplication(app);
    this.touchRelationship(creator.id, opp.businessId, "applied", now);
    void this.emit(CREATOR_EVENTS.applicationSubmitted, ctx, opp.tenantId, { applicationId: app.id });
    return app;
  }

  /**
   * Accept terms: locks the fee snapshot and opens a job. After this, nothing
   * about the money can silently change (D-310). Fee defaults to the provisional
   * business-paid rate unless the business supplied one within the 2%–4% range.
   */
  acceptTerms(ctx: RequestContext, applicationId: ApplicationId, feeConfig?: FeeConfig): CreatorApplication {
    const creator = this.creatorSelf(ctx);
    const app = this.uow.creator.getApplication(applicationId);
    if (!app) throw new NotFoundError("Application not found", { applicationId });
    if (app.creatorId !== creator.id) throw new PermissionDeniedError("Not your application", { permission: "creator.self" });

    const next = transition(APPLICATION_TRANSITIONS, "application", app.status, "accepted");
    if (!next.ok) throw next.error;

    const config = feeConfig ?? CREATOR_MARKETPLACE_DEFAULTS.fee;
    const validated = validateFeeConfig(config);
    if (!validated.ok) throw validated.error;
    const feeSnapshot: FeeSnapshot = {
      rateBps: config.rateBps,
      payer: config.payer,
      configVersion: 1,
      snapshotAt: this.clock.now(),
    };
    const updated: CreatorApplication = {
      ...app,
      status: "accepted",
      feeSnapshot,
      jobId: this.ids.next<CreatorJobId>(),
      updatedAt: this.clock.now(),
    };
    this.uow.creator.updateApplication(updated);
    this.touchRelationship(creator.id, app.businessId, "accepted", this.clock.now());
    void this.emit(CREATOR_EVENTS.applicationAccepted, ctx, app.tenantId, { applicationId, feeBps: config.rateBps });
    return updated;
  }

  /** Upload a submission for an accepted job. Local storage is metadata-only. */
  async submit(ctx: RequestContext, input: SubmitInput): Promise<Submission> {
    const creator = this.creatorSelf(ctx);
    const opp = this.uow.creator.getOpportunity(input.opportunityId);
    if (!opp) throw new NotFoundError("Opportunity not found", { opportunityId: input.opportunityId });
    const app = this.uow.creator.findApplication(input.opportunityId, creator.id);
    if (!app || app.status !== "accepted" || !app.jobId) {
      throw new IllegalStateError("No accepted job for this opportunity", { opportunityId: input.opportunityId });
    }
    const deliverable = this.uow.creator.getDeliverable(input.deliverableId);
    if (!deliverable || deliverable.opportunityId !== input.opportunityId) {
      throw new NotFoundError("Deliverable not found for opportunity", { deliverableId: input.deliverableId });
    }

    const now = this.clock.now();
    const submissionId = this.ids.next<SubmissionId>();
    const versionId = this.ids.next<SubmissionVersionId>();
    this.uow.creator.addVersion({
      id: versionId,
      submissionId,
      seq: 1,
      demoStorage: true,
      fileName: input.fileName,
      widthPx: input.widthPx,
      heightPx: input.heightPx,
      durationSec: input.durationSec,
      hasAudio: input.hasAudio,
      hasCta: input.hasCta,
      language: input.language,
      note: input.note,
      createdAt: now,
    });
    // uploaded -> validating -> under_review (safety auto-passes in local mode
    // unless a hard risk flag is present, which routes to rejected pre-review).
    const hardFail = (input.riskFlags ?? []).length > 0;
    const submission: Submission = {
      id: submissionId,
      tenantId: opp.tenantId,
      businessId: opp.businessId,
      opportunityId: input.opportunityId,
      deliverableId: input.deliverableId,
      jobId: app.jobId,
      creatorId: creator.id,
      status: hardFail ? "rejected" : "under_review",
      currentVersionId: versionId,
      revisionsUsed: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.uow.creator.createSubmission(submission);
    void this.emit(CREATOR_EVENTS.submissionUploaded, ctx, opp.tenantId, { submissionId, hardFail });
    return submission;
  }

  /** Derived per-currency balances for the acting creator within a tenant. */
  async myBalances(ctx: RequestContext) {
    const creator = this.creatorSelf(ctx);
    const events = await this.uow.creator.ledgerForCreator(ctx.tenantId, creator.id);
    return foldCreatorBalances(events);
  }

  // --- Business/staff actions (tenant RBAC) ---

  createProgram(ctx: RequestContext, input: { name: string; slug: string; approvalMode?: ApprovalMode }): CreatorProgramId {
    this.require(ctx, "creator_program.manage");
    const id = this.ids.next<CreatorProgramId>();
    this.uow.creator.createProgram({
      id,
      tenantId: ctx.tenantId,
      businessId: asId<BusinessId>(ctx.tenantId),
      name: input.name,
      slug: input.slug,
      status: "active",
      approvalMode: input.approvalMode ?? CREATOR_MARKETPLACE_DEFAULTS.approvalMode,
      createdAt: this.clock.now(),
    });
    return id;
  }

  createCampaign(ctx: RequestContext, input: { programId: CreatorProgramId; name: string; budgetMinor: string; currency: string }): ContentCampaignId {
    this.require(ctx, "content_campaign.manage");
    const id = this.ids.next<ContentCampaignId>();
    this.uow.creator.createCampaign({
      id,
      tenantId: ctx.tenantId,
      businessId: asId<BusinessId>(ctx.tenantId),
      programId: input.programId,
      name: input.name,
      budget: Money.ofMinor(BigInt(input.budgetMinor), input.currency).toJSON(),
      spent: Money.zero(input.currency).toJSON(),
      status: "open",
      createdAt: this.clock.now(),
    });
    return id;
  }

  createOpportunity(ctx: RequestContext, input: CreateOpportunityInput): ContentOpportunity {
    this.require(ctx, "content_opportunity.manage");
    if (input.deliverables.length === 0) throw new ValidationError("Opportunity needs at least one deliverable");
    const now = this.clock.now();
    const id = this.ids.next<OpportunityId>();
    const opp: ContentOpportunity = {
      id,
      tenantId: ctx.tenantId,
      businessId: asId<BusinessId>(ctx.tenantId),
      campaignId: input.campaignId,
      title: input.title,
      description: input.description,
      status: "draft",
      eligibility: input.eligibility,
      specVersion: 1,
      createdAt: now,
    };
    this.uow.creator.createOpportunity(opp);
    for (const d of input.deliverables) {
      const req: DeliverableRequirement = {
        id: this.ids.next<DeliverableId>(),
        opportunityId: id,
        format: d.format,
        platform: d.platform,
        minWidthPx: d.minWidthPx,
        minHeightPx: d.minHeightPx,
        minDurationSec: d.minDurationSec,
        maxDurationSec: d.maxDurationSec,
        requiresAudio: d.requiresAudio,
        requiresCta: d.requiresCta,
        language: d.language,
        talkingPoints: d.talkingPoints ?? [],
        prohibitedClaims: d.prohibitedClaims ?? [],
        payment: Money.ofMinor(BigInt(d.paymentMinor), d.currency).toJSON(),
        usageRights: ["owned_channels", "affiliate_distribution"],
        exclusivity: "none",
        licenseDurationDays: d.licenseDurationDays ?? 365,
        revisionAllowance: CREATOR_MARKETPLACE_DEFAULTS.revisionAllowance,
      };
      this.uow.creator.addDeliverable(req);
    }
    return opp;
  }

  async publishOpportunity(ctx: RequestContext, opportunityId: OpportunityId): Promise<ContentOpportunity> {
    this.require(ctx, "content_opportunity.manage");
    const opp = this.uow.creator.getOpportunityScoped(ctx.tenantId, opportunityId);
    if (!opp) throw new NotFoundError("Opportunity not found", { opportunityId });
    const next = transition(OPPORTUNITY_TRANSITIONS, "opportunity", opp.status, "open");
    if (!next.ok) throw next.error;
    const updated = { ...opp, status: "open" as const };
    this.uow.creator.updateOpportunity(updated);
    await this.audit(ctx, "opportunity.publish", "opportunity", opportunityId, {});
    void this.emit(CREATOR_EVENTS.opportunityPublished, ctx, ctx.tenantId, { opportunityId });
    return updated;
  }

  /** Advisory AI review (mock). Never decides money; always audited. */
  runAIReview(ctx: RequestContext, submissionId: SubmissionId): { runId: AIReviewRunId; result: AIReviewRunResult } {
    this.require(ctx, "submission.review");
    const sub = this.getSubmissionScoped(ctx, submissionId);
    const version = this.uow.creator.listVersions(sub.id).at(-1);
    if (!version) throw new NotFoundError("No submission version", { submissionId });
    const deliverable = this.uow.creator.getDeliverable(sub.deliverableId);
    const aiInput: AIReviewInput = {
      submissionVersionId: version.id,
      objective: {
        widthPx: version.widthPx,
        heightPx: version.heightPx,
        durationSec: version.durationSec,
        hasAudio: version.hasAudio,
        hasCta: version.hasCta,
        language: version.language,
      },
      requirement: {
        minWidthPx: deliverable?.minWidthPx,
        minHeightPx: deliverable?.minHeightPx,
        minDurationSec: deliverable?.minDurationSec,
        maxDurationSec: deliverable?.maxDurationSec,
        requiresAudio: deliverable?.requiresAudio,
        requiresCta: deliverable?.requiresCta,
        language: deliverable?.language,
      },
    };
    const result = reviewer.review(aiInput);
    const runId = this.ids.next<AIReviewRunId>();
    void this.emit(CREATOR_EVENTS.aiReviewCompleted, ctx, ctx.tenantId, { submissionId, runId, recommendation: result.recommendation, isMock: true });
    return { runId, result };
  }

  /** Human decision. Appends an immutable review record and moves the submission. */
  async decide(ctx: RequestContext, submissionId: SubmissionId, input: DecisionInput): Promise<Submission> {
    const permission = input.decision === "approve" ? "submission.approve" : input.decision === "reject" ? "submission.reject" : "submission.request_revision";
    this.require(ctx, permission);
    const sub = this.getSubmissionScoped(ctx, submissionId);
    if (sub.status !== "under_review" && sub.status !== "resubmitted") {
      throw new IllegalStateError("Submission is not awaiting a decision", { status: sub.status });
    }

    const scored = scoreSubmission({
      categories: (Object.keys(input.categoryScores) as ReviewCategory[]).map((c) => ({ category: c, score: input.categoryScores[c] ?? 0 })),
      weights: DEFAULT_SCORING_WEIGHTS,
      mandatory: { legal_safety: input.legalSafetyPass, file_requirements: input.fileRequirementsPass },
      minApprovalScore: CREATOR_MARKETPLACE_DEFAULTS.minApprovalScore,
      rejectionThreshold: CREATOR_MARKETPLACE_DEFAULTS.rejectionThreshold,
    });
    if (!scored.ok) throw scored.error;

    // A human cannot approve when a mandatory gate failed (safety rule wins).
    if (input.decision === "approve" && !scored.value.mandatoryPassed) {
      throw new IllegalStateError("Cannot approve: a mandatory gate failed", { failedGates: scored.value.failedGates });
    }

    const targetStatus = input.decision === "approve" ? "approved" : input.decision === "reject" ? "rejected" : "revision_requested";
    const next = transition(SUBMISSION_TRANSITIONS, "submission", sub.status, targetStatus);
    if (!next.ok) throw next.error;

    const version = this.uow.creator.listVersions(sub.id).at(-1)!;
    const reviewId = this.ids.next<ReviewId>();
    this.uow.creator.addReview({
      id: reviewId,
      tenantId: ctx.tenantId,
      submissionId: sub.id,
      versionId: version.id,
      reviewerUserId: ctx.actorUserId,
      aiRunId: null,
      decision: input.decision,
      weightedScore: scored.value.weightedTotal,
      mandatoryPassed: scored.value.mandatoryPassed,
      reason: input.reason,
      overrideOfRunId: input.overrideOfRunId ?? null,
      createdAt: this.clock.now(),
    });

    const revisionsUsed = input.decision === "revision" ? sub.revisionsUsed + 1 : sub.revisionsUsed;
    const updated: Submission = { ...sub, status: targetStatus, revisionsUsed, updatedAt: this.clock.now() };
    this.uow.creator.updateSubmission(updated);

    if (input.decision === "approve") {
      // Content approved ⇒ a payable exists (money still doesn't move until authorized).
      const deliverable = this.uow.creator.getDeliverable(sub.deliverableId)!;
      const payment: CreatorPayment = {
        id: this.ids.next<CreatorPaymentId>(),
        tenantId: ctx.tenantId,
        businessId: sub.businessId,
        creatorId: sub.creatorId,
        submissionId: sub.id,
        reason: "deliverable",
        gross: deliverable.payment,
        status: "approved",
        createdAt: this.clock.now(),
        updatedAt: this.clock.now(),
      };
      this.uow.creator.createPayment(payment);
      void this.emit(CREATOR_EVENTS.submissionApproved, ctx, ctx.tenantId, { submissionId, paymentId: payment.id });
    } else if (input.decision === "reject") {
      void this.emit(CREATOR_EVENTS.submissionRejected, ctx, ctx.tenantId, { submissionId });
    } else {
      void this.emit(CREATOR_EVENTS.submissionRevisionRequested, ctx, ctx.tenantId, { submissionId });
    }
    await this.audit(ctx, `submission.${input.decision}`, "submission", submissionId, { reviewId, score: scored.value.weightedTotal });
    return updated;
  }

  /**
   * Authorize a payment (separation of duties: authorizer must differ from the
   * approving reviewer). Appends `payment.authorized` + `platform_fee.recognized`
   * from the LOCKED fee snapshot. No money moves yet.
   */
  async authorizePayment(ctx: RequestContext, paymentId: CreatorPaymentId): Promise<CreatorPayment> {
    this.require(ctx, "creator_payment.authorize");
    const payment = this.getPaymentScoped(ctx, paymentId);
    const sub = this.uow.creator.getSubmission(payment.submissionId);
    if (!sub) throw new NotFoundError("Submission not found", { submissionId: payment.submissionId });

    // Separation of duties: the approver of this submission cannot also authorize.
    const approval = this.uow.creator.listReviews(sub.id).find((r) => r.decision === "approve");
    if (approval && approval.reviewerUserId === ctx.actorUserId) {
      throw new PermissionDeniedError("Separation of duties: approver cannot authorize payment", { permission: "creator_payment.authorize" });
    }

    const app = this.uow.creator.findApplication(sub.opportunityId, sub.creatorId);
    const snapshot = app?.feeSnapshot;
    if (!snapshot) throw new IllegalStateError("No fee snapshot on the job", { paymentId });

    const next = transition(PAYMENT_TRANSITIONS, "payment", payment.status, "scheduled");
    if (!next.ok) throw next.error;

    const gross = Money.fromJSON(payment.gross);
    const fee = computeFee(gross, snapshot);
    const now = this.clock.now();
    const authorized: CreatorLedgerEvent = {
      id: this.ids.next<CreatorLedgerEventId>(),
      tenantId: ctx.tenantId,
      businessId: payment.businessId,
      creatorId: payment.creatorId,
      paymentId,
      occurredAt: now,
      correlationId: ctx.requestId,
      type: "payment.authorized",
      reason: payment.reason,
      gross: gross.toJSON(),
      creatorNet: fee.creatorNet.toJSON(),
      businessCost: fee.businessCost.toJSON(),
      feeSnapshot: snapshot,
      authorizerUserId: ctx.actorUserId,
    };
    await this.uow.creator.appendLedgerGuarded(authorized);
    const feeEvent: CreatorLedgerEvent = {
      id: this.ids.next<CreatorLedgerEventId>(),
      tenantId: ctx.tenantId,
      businessId: payment.businessId,
      creatorId: payment.creatorId,
      paymentId,
      occurredAt: now,
      correlationId: ctx.requestId,
      type: "platform_fee.recognized",
      fee: fee.fee.toJSON(),
    };
    await this.uow.creator.appendLedgerGuarded(feeEvent);

    const updated: CreatorPayment = { ...payment, status: "scheduled", updatedAt: now };
    this.uow.creator.updatePayment(updated);
    await this.audit(ctx, "creator_payment.authorize", "creator_payment", paymentId, { feeBps: snapshot.rateBps, net: fee.creatorNet.toDecimalString() });
    void this.emit(CREATOR_EVENTS.paymentAuthorized, ctx, ctx.tenantId, { paymentId });
    void this.emit(CREATOR_EVENTS.platformFeeRecognized, ctx, ctx.tenantId, { paymentId, fee: fee.fee.toDecimalString() });
    return updated;
  }

  /**
   * Execute the payout — SIMULATED in local mode (no provider, no real money).
   * Appends `payment.processing` + `payment.paid` with a SIMULATED provider ref.
   */
  async executePayout(ctx: RequestContext, paymentId: CreatorPaymentId): Promise<CreatorPayment> {
    this.require(ctx, "creator_payment.execute");
    const payment = this.getPaymentScoped(ctx, paymentId);
    const next = transition(PAYMENT_TRANSITIONS, "payment", payment.status, "processing");
    if (!next.ok) throw next.error;
    const now = this.clock.now();
    const base = { tenantId: ctx.tenantId, businessId: payment.businessId, creatorId: payment.creatorId, paymentId, occurredAt: now, correlationId: ctx.requestId };
    await this.uow.creator.appendLedgerGuarded({ ...base, id: this.ids.next<CreatorLedgerEventId>(), type: "payment.processing" });
    await this.uow.creator.appendLedgerGuarded({ ...base, id: this.ids.next<CreatorLedgerEventId>(), type: "payment.paid", providerRef: `SIMULATED-${paymentId}` });
    const updated: CreatorPayment = { ...payment, status: "paid", updatedAt: now };
    this.uow.creator.updatePayment(updated);
    await this.audit(ctx, "creator_payment.execute", "creator_payment", paymentId, { mode: CREATOR_MARKETPLACE_DEFAULTS.localPayoutMode });
    void this.emit(CREATOR_EVENTS.paymentPaid, ctx, ctx.tenantId, { paymentId, simulated: true });
    return updated;
  }

  /** Publish an approved submission's content to the library with a license. */
  async publishToLibrary(ctx: RequestContext, submissionId: SubmissionId): Promise<ContentAssetId> {
    this.require(ctx, "content_asset.manage");
    const sub = this.getSubmissionScoped(ctx, submissionId);
    if (sub.status !== "approved") throw new IllegalStateError("Only approved submissions can be published", { status: sub.status });
    const version = this.uow.creator.listVersions(sub.id).at(-1)!;
    const deliverable = this.uow.creator.getDeliverable(sub.deliverableId)!;
    const opp = this.uow.creator.getOpportunity(sub.opportunityId)!;
    const now = this.clock.now();
    const assetId = this.ids.next<ContentAssetId>();
    this.uow.creator.createAsset({
      id: assetId,
      tenantId: ctx.tenantId,
      businessId: sub.businessId,
      campaignId: opp.campaignId,
      creatorId: sub.creatorId,
      sourceVersionId: version.id,
      title: `${deliverable.format} — ${opp.title}`,
      format: deliverable.format,
      platform: deliverable.platform,
      language: deliverable.language,
      status: "published",
      createdAt: now,
    });
    const end = new Date(now.getTime() + deliverable.licenseDurationDays * 24 * 60 * 60 * 1000);
    this.uow.creator.createLicense({
      id: this.ids.next<ContentLicenseId>(),
      assetId,
      usageRights: deliverable.usageRights,
      exclusivity: deliverable.exclusivity,
      status: "active",
      startAt: now,
      endAt: end,
    });
    await this.audit(ctx, "content.publish", "content_asset", assetId, {});
    void this.emit(CREATOR_EVENTS.contentPublishedToLibrary, ctx, ctx.tenantId, { assetId });
    return assetId;
  }

  createRankRule(ctx: RequestContext, input: { campaignId?: ContentCampaignId; minRank: AffiliateRank }): RankUnlockRuleId {
    this.require(ctx, "rank_unlock.manage");
    const id = this.ids.next<RankUnlockRuleId>();
    this.uow.creator.createRankRule({
      id,
      tenantId: ctx.tenantId,
      businessId: asId<BusinessId>(ctx.tenantId),
      campaignId: input.campaignId ?? null,
      minRank: input.minRank,
      status: "active",
      createdAt: this.clock.now(),
    });
    return id;
  }

  /**
   * Resolve whether an affiliate at `affiliateRank` may access an asset. Enforces
   * the hard access rules plus rank unlock resolution — the same logic the UI and
   * any download endpoint must use.
   */
  resolveAffiliateAccess(ctx: RequestContext, assetId: ContentAssetId, affiliateRank: AffiliateRank, enrolled = true, goodStanding = true) {
    this.require(ctx, "affiliate_content.view");
    const asset = this.uow.creator.getAsset(assetId);
    if (!asset || asset.tenantId !== ctx.tenantId) throw new NotFoundError("Asset not found", { assetId });
    const license = this.uow.creator.getLicenseForAsset(assetId);
    const rules = this.uow.creator
      .listRankRules(ctx.tenantId)
      .filter((r) => r.status === "active" && (r.campaignId === null || r.campaignId === asset.campaignId))
      .map((r) => ({ minRank: r.minRank }));
    const accessCtx: AssetAccessContext = {
      affiliateRank,
      enrolled,
      inGoodStanding: goodStanding,
      assetStatus: asset.status,
      licenseStatus: license?.status ?? "expired",
      licenseAllowsAffiliateDistribution: (license?.usageRights ?? []).includes("affiliate_distribution"),
    };
    return resolveAssetAccess(accessCtx, rules);
  }

  // --- Reads for the UI (permission-gated; the UI never reaches past services) ---

  listOpportunities(ctx: RequestContext): ContentOpportunity[] {
    this.require(ctx, "creator.view");
    return this.uow.creator.listOpportunities(ctx.tenantId);
  }
  /** Programs for this tenant (UI needs the program to show its scheme/budget). */
  listPrograms(ctx: RequestContext) {
    this.require(ctx, "creator.view");
    return this.uow.creator.listPrograms(ctx.tenantId);
  }
  /** Budget + capacity for a program (config surface). */
  getBudget(ctx: RequestContext, programId: CreatorProgramId) {
    this.require(ctx, "creator_program.manage");
    return this.uow.creator.getBudget(ctx.tenantId, programId) ?? null;
  }
  /** All submission dispositions for the tenant, joined with submission + creator name. */
  listDispositionsView(ctx: RequestContext) {
    this.require(ctx, "submission.review");
    return this.uow.creator.listDispositions(ctx.tenantId).map((d) => {
      const submission = this.uow.creator.getSubmission(d.submissionId) ?? null;
      return {
        disposition: d,
        submission,
        creatorName: submission ? this.creatorDisplayName(submission.creatorId) : d.submissionId,
      };
    });
  }
  /** Public: deliverable specs of an opportunity (shown to creators browsing + businesses). */
  deliverablesFor(_ctx: RequestContext, opportunityId: OpportunityId): DeliverableRequirement[] {
    return this.uow.creator.listDeliverables(opportunityId);
  }
  reviewQueue(ctx: RequestContext): Submission[] {
    this.require(ctx, "submission.review");
    return this.uow.creator.listSubmissionsForTenant(ctx.tenantId).filter((s) => s.status === "under_review" || s.status === "resubmitted");
  }
  listSubmissions(ctx: RequestContext): Submission[] {
    this.require(ctx, "submission.review");
    return this.uow.creator.listSubmissionsForTenant(ctx.tenantId);
  }
  listPayments(ctx: RequestContext): CreatorPayment[] {
    this.require(ctx, "creator_payment.authorize");
    return this.uow.creator.listPaymentsForTenant(ctx.tenantId);
  }
  listAssets(ctx: RequestContext) {
    this.require(ctx, "content_asset.manage");
    return this.uow.creator.listAssets(ctx.tenantId).map((asset) => ({
      asset,
      license: this.uow.creator.getLicenseForAsset(asset.id) ?? null,
    }));
  }
  creatorDisplayName(creatorId: CreatorId): string {
    return this.uow.creator.getProfile(creatorId)?.displayName ?? creatorId;
  }
  versionsFor(ctx: RequestContext, submissionId: SubmissionId) {
    this.require(ctx, "submission.review");
    return this.uow.creator.listVersions(submissionId);
  }

  /** Affiliate content library: assets with license + this affiliate's access decision. */
  libraryForAffiliate(ctx: RequestContext, affiliateRank: AffiliateRank) {
    this.require(ctx, "affiliate_content.view");
    return this.uow.creator.listAssets(ctx.tenantId).map((asset) => {
      const license = this.uow.creator.getLicenseForAsset(asset.id) ?? null;
      const rules = this.uow.creator
        .listRankRules(ctx.tenantId)
        .filter((r) => r.status === "active" && (r.campaignId === null || r.campaignId === asset.campaignId))
        .map((r) => ({ minRank: r.minRank }));
      const decision = resolveAssetAccess(
        {
          affiliateRank,
          enrolled: true,
          inGoodStanding: true,
          assetStatus: asset.status,
          licenseStatus: license?.status ?? "expired",
          licenseAllowsAffiliateDistribution: (license?.usageRights ?? []).includes("affiliate_distribution"),
        },
        rules,
      );
      return { asset, license, decision };
    });
  }

  // Creator self reads
  myProfile(ctx: RequestContext): CreatorProfile | null {
    return this.uow.creator.getProfileByUser(ctx.actorUserId) ?? null;
  }
  myApplications(ctx: RequestContext): CreatorApplication[] {
    const creator = this.creatorSelf(ctx);
    return this.uow.creator.listApplicationsForCreator(creator.id);
  }
  mySubmissions(ctx: RequestContext): Submission[] {
    const creator = this.creatorSelf(ctx);
    return this.uow.creator.listSubmissionsForCreator(creator.id);
  }

  // ======================================================================
  // Configurable business program (Parts 1-8, 11): the business owns its own
  // categories, payments, capacity, budget, and content disposition. Partnera
  // imposes none of these values.
  // ======================================================================

  /** The program's evaluation scheme, or the generic editable default if unset. */
  getScheme(ctx: RequestContext, programId: CreatorProgramId): EvaluationScheme {
    const existing = this.uow.creator.getSchemeForProgram(ctx.tenantId, programId);
    if (existing) return existing;
    return {
      id: this.ids.next<EvaluationSchemeId>(),
      tenantId: ctx.tenantId,
      businessId: asId<BusinessId>(ctx.tenantId),
      programId,
      name: "Default",
      categories: defaultSchemeCategories(),
      updatedAt: this.clock.now(),
    };
  }

  /** Save the business's evaluation scheme (custom categories → payments). */
  saveScheme(ctx: RequestContext, programId: CreatorProgramId, categories: readonly EvaluationCategory[]): EvaluationScheme {
    this.require(ctx, "creator_program.manage");
    const existing = this.uow.creator.getSchemeForProgram(ctx.tenantId, programId);
    const scheme: EvaluationScheme = {
      id: existing?.id ?? this.ids.next<EvaluationSchemeId>(),
      tenantId: ctx.tenantId,
      businessId: asId<BusinessId>(ctx.tenantId),
      programId,
      name: existing?.name ?? "Program scheme",
      categories,
      updatedAt: this.clock.now(),
    };
    const valid = validateScheme(scheme);
    if (!valid.ok) throw valid.error;
    this.uow.creator.upsertScheme(scheme);
    return scheme;
  }

  setCapacity(ctx: RequestContext, programId: CreatorProgramId, input: Omit<ProgramCapacity, "programId" | "tenantId">): void {
    this.require(ctx, "creator_program.manage");
    this.uow.creator.upsertCapacity({ programId, tenantId: ctx.tenantId, ...input });
  }
  getCapacity(ctx: RequestContext, programId: CreatorProgramId): ProgramCapacity | null {
    return this.uow.creator.getCapacity(ctx.tenantId, programId) ?? null;
  }

  setBudget(ctx: RequestContext, programId: CreatorProgramId, input: { totalMinor: string; currency: string; reservedMinor?: string }): void {
    this.require(ctx, "creator_program.manage");
    this.uow.creator.upsertBudget({ programId, tenantId: ctx.tenantId, currency: input.currency, totalMinor: input.totalMinor, reservedMinor: input.reservedMinor ?? "0" });
  }

  /** Derived budget exposure for a program (committed/paid/remaining/projected fee). */
  exposureFor(ctx: RequestContext, programId: CreatorProgramId) {
    this.require(ctx, "creator_program.manage");
    const budget = this.uow.creator.getBudget(ctx.tenantId, programId);
    const feeBps = CREATOR_MARKETPLACE_DEFAULTS.fee.rateBps;
    if (!budget) return null;
    let committed = 0n;
    let paid = 0n;
    for (const p of this.uow.creator.listPaymentsForTenant(ctx.tenantId)) {
      if (this.programForSubmissionId(ctx, p.submissionId) !== programId) continue;
      const minor = BigInt(p.gross.minorUnits);
      if (p.status === "paid") paid += minor;
      else if (p.status === "approved" || p.status === "scheduled" || p.status === "processing") committed += minor;
    }
    return computeExposure(budget, committed, paid, feeBps);
  }

  /** AI advisory recommendation: two scores + the scheme category the score maps to. */
  recommend(ctx: RequestContext, submissionId: SubmissionId): { runId: AIReviewRunId; recommendation: ReviewRecommendation } {
    this.require(ctx, "submission.review");
    const recommendation = this.computeRecommendation(ctx, submissionId);
    const runId = this.ids.next<AIReviewRunId>();
    void this.emit(CREATOR_EVENTS.aiReviewCompleted, ctx, ctx.tenantId, { submissionId, runId, recommendedCategoryKey: recommendation.recommendedCategoryKey, isMock: true });
    return { runId, recommendation };
  }

  /** Side-effect-free recommendation for rendering a review workspace. */
  recommendPreview(ctx: RequestContext, submissionId: SubmissionId): ReviewRecommendation {
    this.require(ctx, "submission.review");
    return this.computeRecommendation(ctx, submissionId);
  }

  private computeRecommendation(ctx: RequestContext, submissionId: SubmissionId): ReviewRecommendation {
    const sub = this.getSubmissionScoped(ctx, submissionId);
    const version = this.uow.creator.listVersions(sub.id).at(-1);
    const deliverable = this.uow.creator.getDeliverable(sub.deliverableId);
    const two = mockTwoScoreReview({
      submissionVersionId: version?.id ?? submissionId,
      objective: { widthPx: version?.widthPx, heightPx: version?.heightPx, durationSec: version?.durationSec, hasAudio: version?.hasAudio, hasCta: version?.hasCta, language: version?.language },
      requirement: { minWidthPx: deliverable?.minWidthPx, minHeightPx: deliverable?.minHeightPx, minDurationSec: deliverable?.minDurationSec, maxDurationSec: deliverable?.maxDurationSec, requiresAudio: deliverable?.requiresAudio, requiresCta: deliverable?.requiresCta, language: deliverable?.language },
      commercial: { hasHook: (version?.note ?? "").length > 0, noteLength: (version?.note ?? "").length, brandMentioned: true },
    });
    const programId = this.programForSubmissionId(ctx, submissionId);
    const scheme = programId ? this.getScheme(ctx, programId) : null;
    const recommendedCategoryKey = scheme ? (categoryForScore(scheme, two.combinedScore)?.key ?? null) : null;
    return {
      technicalScore: two.technicalScore,
      commercialScore: two.commercialScore,
      combinedScore: two.combinedScore,
      recommendedCategoryKey,
      confidence: two.confidence,
      strengths: two.strengths,
      weaknesses: two.weaknesses,
      failedRequirements: two.failedRequirements,
    };
  }

  /** The program's scheme for a submission (UI review workspace needs the categories). */
  schemeForSubmission(ctx: RequestContext, submissionId: SubmissionId): EvaluationScheme | null {
    this.require(ctx, "submission.review");
    const programId = this.programForSubmissionId(ctx, submissionId);
    return programId ? this.getScheme(ctx, programId) : null;
  }

  /**
   * The human review decision, driven by the business's own scheme. The reviewer
   * confirms a **category**; the business config maps it to the **payment** (AI
   * never sets money). Capacity/budget gates route over-limit accepted content to
   * a **waiting** state instead of rejecting it. Payment/quality/reuse are set as
   * **independent** disposition fields.
   */
  async reviewWithScheme(
    ctx: RequestContext,
    submissionId: SubmissionId,
    input: { categoryKey: string; accept: boolean; reason: string; legalCleared?: boolean; overrideLibrary?: LibraryStatus; overrideAffiliate?: AffiliateAccessStatus },
  ): Promise<{ submission: Submission; disposition: SubmissionDisposition; paymentId: CreatorPaymentId | null }> {
    this.require(ctx, input.accept ? "submission.approve" : "submission.review");
    const sub = this.getSubmissionScoped(ctx, submissionId);
    const programId = this.programForSubmissionId(ctx, submissionId);
    if (!programId) throw new NotFoundError("Program not found for submission", { submissionId });
    const scheme = this.getScheme(ctx, programId);
    const category = scheme.categories.find((c) => c.key === input.categoryKey);
    if (!category) throw new ValidationError("Unknown category for this program", { categoryKey: input.categoryKey });

    const pay = paymentForCategory(scheme, input.categoryKey);
    const now = this.clock.now();
    const businessId = sub.businessId;

    // Independent disposition (Part 5): pay / quality / reuse are separate.
    let disposition = this.uow.creator.getDisposition(submissionId) ?? defaultDisposition(submissionId, ctx.tenantId, businessId, now);
    let paymentId: CreatorPaymentId | null = null;
    let submissionStatusTarget: "approved" | "rejected" | "revision_requested" = input.accept && category.payable ? "approved" : "rejected";

    if (input.accept && category.payable && pay.amount) {
      // Capacity + budget gate — over-limit content WAITS, is never auto-rejected.
      const budget = this.uow.creator.getBudget(ctx.tenantId, programId);
      const remaining = budget ? this.budgetRemainingMinor(ctx, programId, budget) : null;
      const capacity = this.uow.creator.getCapacity(ctx.tenantId, programId);
      const counts = this.capacityCounts(ctx, programId);
      const gate = capacityGate(capacity ?? null, counts, remaining ?? BigInt(Number.MAX_SAFE_INTEGER), BigInt(pay.amount.minorUnits));

      if (gate.state !== "under_review") {
        // Waiting: record the review + a honest waiting disposition; NO payable yet.
        disposition = { ...disposition, queueState: gate.state, categoryKey: input.categoryKey, paymentEligible: true, paymentMinor: pay.amount.minorUnits, currency: pay.amount.currency, commercialStatus: "approved", legalStatus: input.legalCleared ? "cleared" : disposition.legalStatus, updatedAt: now };
        this.uow.creator.upsertDisposition(disposition);
        this.recordReview(ctx, sub, "approve", category.maxScore, input.reason, now);
        void this.emit(gate.state === "waiting_for_budget" ? CREATOR_EVENTS.submissionApproved : CREATOR_EVENTS.submissionApproved, ctx, ctx.tenantId, { submissionId, waiting: gate.state });
        return { submission: sub, disposition, paymentId: null };
      }

      // Within limits → create the payable at the business-configured amount.
      const payment: CreatorPayment = {
        id: this.ids.next<CreatorPaymentId>(),
        tenantId: ctx.tenantId, businessId, creatorId: sub.creatorId, submissionId: sub.id,
        reason: "deliverable", gross: pay.amount, status: "approved", createdAt: now, updatedAt: now,
      };
      this.uow.creator.createPayment(payment);
      paymentId = payment.id;
      disposition = {
        ...disposition, queueState: "approved_for_payment", categoryKey: input.categoryKey,
        paymentEligible: true, paymentMinor: pay.amount.minorUnits, currency: pay.amount.currency,
        libraryStatus: input.overrideLibrary ?? (category.libraryEligible ? "reusable" : "none"),
        affiliateAccess: input.overrideAffiliate ?? (category.affiliateEligible ? "eligible" : "none"),
        commercialStatus: "approved", legalStatus: input.legalCleared ? "cleared" : disposition.legalStatus, updatedAt: now,
      };
    } else {
      // Not payable (e.g. a "Rejected" category) — content may still be RETAINED.
      submissionStatusTarget = input.accept ? "rejected" : "revision_requested";
      disposition = {
        ...disposition, queueState: category.libraryEligible ? "internal_only" : "rejected_for_payment",
        categoryKey: input.categoryKey, paymentEligible: false, paymentMinor: "0", currency: category.currency,
        libraryStatus: input.overrideLibrary ?? (category.libraryEligible ? "internal_only" : "none"),
        affiliateAccess: input.overrideAffiliate ?? "none",
        commercialStatus: input.accept ? "rejected" : disposition.commercialStatus,
        internalUse: category.libraryEligible ? "internal" : "none",
        legalStatus: input.legalCleared ? "cleared" : disposition.legalStatus, updatedAt: now,
      };
    }

    this.uow.creator.upsertDisposition(disposition);
    // Move the submission's review-lifecycle state (guarded).
    if (sub.status === "under_review" || sub.status === "resubmitted") {
      const next = transition(SUBMISSION_TRANSITIONS, "submission", sub.status, submissionStatusTarget);
      if (next.ok) {
        const updated: Submission = { ...sub, status: submissionStatusTarget, revisionsUsed: submissionStatusTarget === "revision_requested" ? sub.revisionsUsed + 1 : sub.revisionsUsed, updatedAt: now };
        this.uow.creator.updateSubmission(updated);
        this.recordReview(ctx, updated, submissionStatusTarget === "approved" ? "approve" : submissionStatusTarget === "rejected" ? "reject" : "revision", category.maxScore, input.reason, now);
        await this.audit(ctx, "submission.review_scheme", "submission", submissionId, { categoryKey: input.categoryKey, paymentEligible: disposition.paymentEligible });
        void this.emit(submissionStatusTarget === "approved" ? CREATOR_EVENTS.submissionApproved : CREATOR_EVENTS.submissionRejected, ctx, ctx.tenantId, { submissionId, categoryKey: input.categoryKey, paymentId });
        return { submission: updated, disposition, paymentId };
      }
    }
    return { submission: sub, disposition, paymentId };
  }

  /** Update independent disposition fields (Part 5/8) without touching money. */
  setDisposition(
    ctx: RequestContext,
    submissionId: SubmissionId,
    patch: Partial<{ queueState: QueueState; libraryStatus: LibraryStatus; affiliateAccess: AffiliateAccessStatus; editingStatus: EditingStatus; commercialStatus: CommercialStatus; legalStatus: LegalStatus; internalUse: InternalUseStatus }>,
  ): SubmissionDisposition {
    this.require(ctx, "submission.review");
    const sub = this.getSubmissionScoped(ctx, submissionId);
    const current = this.uow.creator.getDisposition(submissionId) ?? defaultDisposition(submissionId, ctx.tenantId, sub.businessId, this.clock.now());
    const updated: SubmissionDisposition = { ...current, ...patch, updatedAt: this.clock.now() };
    this.uow.creator.upsertDisposition(updated);
    return updated;
  }

  /** Promote a waiting item back into active review (business decision). */
  promoteFromQueue(ctx: RequestContext, submissionId: SubmissionId): SubmissionDisposition {
    this.require(ctx, "submission.review");
    return this.setDisposition(ctx, submissionId, { queueState: "under_review" });
  }

  getDisposition(ctx: RequestContext, submissionId: SubmissionId): SubmissionDisposition | null {
    this.require(ctx, "submission.review");
    return this.uow.creator.getDisposition(submissionId) ?? null;
  }

  /** Count accepted/active/per-opportunity/per-creator for a program's capacity gate. */
  capacityCounts(ctx: RequestContext, programId: CreatorProgramId): { accepted: number; paid: number; active: number; perOpportunity: number; perCreator: number } {
    let accepted = 0, paid = 0, active = 0;
    for (const p of this.uow.creator.listPaymentsForTenant(ctx.tenantId)) {
      if (this.programForSubmissionId(ctx, p.submissionId) !== programId) continue;
      if (p.status === "paid") { paid += 1; accepted += 1; }
      else if (p.status === "approved" || p.status === "scheduled" || p.status === "processing") { active += 1; accepted += 1; }
    }
    return { accepted, paid, active, perOpportunity: 0, perCreator: 0 };
  }

  // --- Plans / trials / promotional channels (provisional; no billing, disclosed) ---
  listPlans() {
    return this.uow.creator.listPlans();
  }
  listPromoChannels() {
    return this.uow.creator.listChannels();
  }
  listPlacements() {
    return this.uow.creator.listPlacements();
  }

  private budgetRemainingMinor(ctx: RequestContext, programId: CreatorProgramId, budget: ProgramBudget): bigint {
    let committed = 0n;
    let paid = 0n;
    for (const p of this.uow.creator.listPaymentsForTenant(ctx.tenantId)) {
      if (this.programForSubmissionId(ctx, p.submissionId) !== programId) continue;
      const m = BigInt(p.gross.minorUnits);
      if (p.status === "paid") paid += m;
      else if (p.status === "approved" || p.status === "scheduled" || p.status === "processing") committed += m;
    }
    return BigInt(budget.totalMinor) - BigInt(budget.reservedMinor) - committed - paid;
  }

  private programForSubmissionId(ctx: RequestContext, submissionId: SubmissionId): CreatorProgramId | null {
    const sub = this.uow.creator.getSubmission(submissionId);
    if (!sub || sub.tenantId !== ctx.tenantId) return null;
    const opp = this.uow.creator.getOpportunity(sub.opportunityId);
    if (!opp) return null;
    const camp = this.uow.creator.getCampaign(ctx.tenantId, opp.campaignId);
    return camp?.programId ?? null;
  }

  private recordReview(ctx: RequestContext, sub: Submission, decision: "approve" | "revision" | "reject", score: number, reason: string, now: Date): void {
    const version = this.uow.creator.listVersions(sub.id).at(-1);
    if (!version) return;
    this.uow.creator.addReview({
      id: this.ids.next<ReviewId>(), tenantId: ctx.tenantId, submissionId: sub.id, versionId: version.id,
      reviewerUserId: ctx.actorUserId, aiRunId: null, decision, weightedScore: score, mandatoryPassed: true,
      reason, overrideOfRunId: null, createdAt: now,
    });
  }

  // --- helpers ---

  private creatorSelf(ctx: RequestContext): CreatorProfile {
    const profile = this.uow.creator.getProfileByUser(ctx.actorUserId);
    if (!profile) throw new NotFoundError("No creator profile for this user", { userId: ctx.actorUserId });
    if (profile.status !== "active") throw new PermissionDeniedError("Creator profile is not active", { permission: "creator.self" });
    return profile;
  }

  private getSubmissionScoped(ctx: RequestContext, submissionId: SubmissionId): Submission {
    const sub = this.uow.creator.getSubmission(submissionId);
    if (!sub || sub.tenantId !== ctx.tenantId) throw new NotFoundError("Submission not found", { submissionId });
    return sub;
  }

  private getPaymentScoped(ctx: RequestContext, paymentId: CreatorPaymentId): CreatorPayment {
    const payment = this.uow.creator.getPayment(paymentId);
    if (!payment || payment.tenantId !== ctx.tenantId) throw new NotFoundError("Payment not found", { paymentId });
    return payment;
  }

  private touchRelationship(creatorId: CreatorId, businessId: BusinessId, status: CreatorApplication["status"], now: Date): void {
    this.uow.creator.upsertRelationship({ creatorId, businessId, status, goodStanding: true, updatedAt: now });
  }

  private async emit(name: string, ctx: RequestContext, tenantId: string | null, payload: Record<string, unknown>): Promise<void> {
    const event: DomainEvent = {
      id: this.ids.next(),
      name,
      occurredAt: this.clock.now(),
      tenantId: (tenantId as never) ?? null,
      correlationId: ctx.requestId,
      payload,
    };
    await this.events.publish(event);
  }
}
