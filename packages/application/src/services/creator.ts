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
