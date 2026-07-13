import { type BusinessId, type TenantId, type UserId } from "@partnera/core";
import {
  assertCreatorAppendable,
  type ContentAsset,
  type ContentCampaign,
  type ContentLicense,
  type ContentOpportunity,
  type CreatorApplication,
  type CreatorCompanyRelationship,
  type CreatorId,
  type CreatorLedgerEvent,
  type CreatorPayment,
  type CreatorPaymentId,
  type CreatorProfile,
  type CreatorProgram,
  type DeliverableRequirement,
  type Dispute,
  type OpportunityId,
  type RankUnlockRule,
  type Submission,
  type SubmissionId,
  type SubmissionReview,
  type SubmissionVersion,
  type BusinessPlanDefinition,
  type BusinessTrialState,
  type EvaluationScheme,
  type ProgramBudget,
  type ProgramCapacity,
  type PromotedPlacement,
  type PromotionalChannel,
  type SubmissionDisposition,
} from "@partnera/creator-marketplace";
import { type CreatorProgramId } from "@partnera/creator-marketplace";
import { type Collection, type RelationalStore } from "../relational/store";

const byCreatedAsc = <T extends { createdAt: Date }>(a: T, b: T): number =>
  a.createdAt.getTime() - b.createdAt.getTime();

/**
 * Persistence for the Creator Marketplace. Business-owned records are strictly
 * tenant-scoped by `tenantId` (taken from the authenticated context one layer up,
 * never from client input); creator profiles are cross-tenant actors. Money
 * (creator-ledger), submission versions, and reviews are append-only, enforced by
 * the store's append-only collections and, for money, by
 * {@link assertCreatorAppendable} inside a transaction — the same guarded-append
 * discipline as the commission ledger.
 */
export class CreatorRepository {
  constructor(
    private readonly store: RelationalStore,
    private readonly profiles: Collection<CreatorProfile>,
    private readonly relationships: Collection<CreatorCompanyRelationship>,
    private readonly programs: Collection<CreatorProgram>,
    private readonly campaigns: Collection<ContentCampaign>,
    private readonly opportunities: Collection<ContentOpportunity>,
    private readonly deliverables: Collection<DeliverableRequirement>,
    private readonly applications: Collection<CreatorApplication>,
    private readonly submissions: Collection<Submission>,
    private readonly versions: Collection<SubmissionVersion>,
    private readonly reviews: Collection<SubmissionReview>,
    private readonly assets: Collection<ContentAsset>,
    private readonly licenses: Collection<ContentLicense>,
    private readonly rankRules: Collection<RankUnlockRule>,
    private readonly payments: Collection<CreatorPayment>,
    private readonly ledger: Collection<CreatorLedgerEvent>,
    private readonly disputes: Collection<Dispute>,
    private readonly schemes: Collection<EvaluationScheme>,
    private readonly capacities: Collection<ProgramCapacity>,
    private readonly budgets: Collection<ProgramBudget>,
    private readonly dispositions: Collection<SubmissionDisposition>,
    private readonly plans: Collection<BusinessPlanDefinition>,
    private readonly trials: Collection<BusinessTrialState>,
    private readonly channels: Collection<PromotionalChannel>,
    private readonly placements: Collection<PromotedPlacement>,
  ) {}

  // --- Creator profiles (cross-tenant actors) ---
  createProfile(profile: CreatorProfile): void {
    this.profiles.insert(profile);
  }
  getProfile(id: CreatorId): CreatorProfile | undefined {
    return this.profiles.get(id);
  }
  getProfileByUser(userId: UserId): CreatorProfile | undefined {
    return this.profiles.findByUnique("user", userId);
  }
  updateProfile(profile: CreatorProfile, expectedVersion?: number): void {
    this.profiles.replace(profile, expectedVersion);
  }
  listProfiles(): CreatorProfile[] {
    return this.profiles.values();
  }

  // --- Relationships ---
  upsertRelationship(rel: CreatorCompanyRelationship): void {
    this.relationships.upsert(rel);
  }
  getRelationship(creatorId: CreatorId, businessId: BusinessId): CreatorCompanyRelationship | undefined {
    return this.relationships.get(`${creatorId}:${businessId}`);
  }
  listRelationshipsForCreator(creatorId: CreatorId): CreatorCompanyRelationship[] {
    return this.relationships.find((r) => r.creatorId === creatorId);
  }

  // --- Programs / campaigns (tenant-scoped) ---
  createProgram(program: CreatorProgram): void {
    this.programs.insert(program);
  }
  getProgram(tenantId: TenantId, id: string): CreatorProgram | undefined {
    const p = this.programs.get(id);
    return p && p.tenantId === tenantId ? p : undefined;
  }
  listPrograms(tenantId: TenantId): CreatorProgram[] {
    return this.programs.find((p) => p.tenantId === tenantId);
  }
  createCampaign(campaign: ContentCampaign): void {
    this.campaigns.insert(campaign);
  }
  getCampaign(tenantId: TenantId, id: string): ContentCampaign | undefined {
    const c = this.campaigns.get(id);
    return c && c.tenantId === tenantId ? c : undefined;
  }
  updateCampaign(campaign: ContentCampaign, expectedVersion?: number): void {
    this.campaigns.replace(campaign, expectedVersion);
  }
  listCampaigns(tenantId: TenantId): ContentCampaign[] {
    return this.campaigns.find((c) => c.tenantId === tenantId);
  }

  // --- Opportunities / deliverables ---
  createOpportunity(opp: ContentOpportunity): void {
    this.opportunities.insert(opp);
  }
  getOpportunity(id: OpportunityId): ContentOpportunity | undefined {
    return this.opportunities.get(id);
  }
  getOpportunityScoped(tenantId: TenantId, id: OpportunityId): ContentOpportunity | undefined {
    const o = this.opportunities.get(id);
    return o && o.tenantId === tenantId ? o : undefined;
  }
  updateOpportunity(opp: ContentOpportunity, expectedVersion?: number): void {
    this.opportunities.replace(opp, expectedVersion);
  }
  listOpportunities(tenantId: TenantId): ContentOpportunity[] {
    return this.opportunities.find((o) => o.tenantId === tenantId);
  }
  /** Public discovery: only open opportunities, across tenants. */
  listOpenOpportunities(): ContentOpportunity[] {
    return this.opportunities.find((o) => o.status === "open");
  }
  addDeliverable(req: DeliverableRequirement): void {
    this.deliverables.insert(req);
  }
  listDeliverables(opportunityId: OpportunityId): DeliverableRequirement[] {
    return this.deliverables.find((d) => d.opportunityId === opportunityId);
  }
  getDeliverable(id: string): DeliverableRequirement | undefined {
    return this.deliverables.get(id);
  }

  // --- Applications ---
  createApplication(app: CreatorApplication): void {
    this.applications.insert(app);
  }
  getApplication(id: string): CreatorApplication | undefined {
    return this.applications.get(id);
  }
  updateApplication(app: CreatorApplication, expectedVersion?: number): void {
    this.applications.replace(app, expectedVersion);
  }
  findApplication(opportunityId: OpportunityId, creatorId: CreatorId): CreatorApplication | undefined {
    return this.applications.findByUnique("opp_creator", `${opportunityId}:${creatorId}`);
  }
  listApplicationsForOpportunity(opportunityId: OpportunityId): CreatorApplication[] {
    return this.applications.find((a) => a.opportunityId === opportunityId);
  }
  listApplicationsForCreator(creatorId: CreatorId): CreatorApplication[] {
    return this.applications.find((a) => a.creatorId === creatorId);
  }

  // --- Submissions + append-only versions/reviews ---
  createSubmission(sub: Submission): void {
    this.submissions.insert(sub);
  }
  getSubmission(id: SubmissionId): Submission | undefined {
    return this.submissions.get(id);
  }
  updateSubmission(sub: Submission, expectedVersion?: number): void {
    this.submissions.replace(sub, expectedVersion);
  }
  listSubmissionsForTenant(tenantId: TenantId): Submission[] {
    return this.submissions.find((s) => s.tenantId === tenantId);
  }
  listSubmissionsForCreator(creatorId: CreatorId): Submission[] {
    return this.submissions.find((s) => s.creatorId === creatorId);
  }
  addVersion(version: SubmissionVersion): void {
    this.versions.insert(version);
  }
  listVersions(submissionId: SubmissionId): SubmissionVersion[] {
    return this.versions.find((v) => v.submissionId === submissionId).sort((a, b) => a.seq - b.seq);
  }
  addReview(review: SubmissionReview): void {
    this.reviews.insert(review);
  }
  listReviews(submissionId: SubmissionId): SubmissionReview[] {
    return this.reviews.find((r) => r.submissionId === submissionId).sort(byCreatedAsc);
  }

  // --- Content library ---
  createAsset(asset: ContentAsset): void {
    this.assets.insert(asset);
  }
  updateAsset(asset: ContentAsset, expectedVersion?: number): void {
    this.assets.replace(asset, expectedVersion);
  }
  getAsset(id: string): ContentAsset | undefined {
    return this.assets.get(id);
  }
  listAssets(tenantId: TenantId): ContentAsset[] {
    return this.assets.find((a) => a.tenantId === tenantId);
  }
  createLicense(license: ContentLicense): void {
    this.licenses.insert(license);
  }
  updateLicense(license: ContentLicense, expectedVersion?: number): void {
    this.licenses.replace(license, expectedVersion);
  }
  getLicenseForAsset(assetId: string): ContentLicense | undefined {
    return this.licenses.findByUnique("asset", assetId);
  }
  createRankRule(rule: RankUnlockRule): void {
    this.rankRules.insert(rule);
  }
  listRankRules(tenantId: TenantId): RankUnlockRule[] {
    return this.rankRules.find((r) => r.tenantId === tenantId);
  }

  // --- Payments (logical) + append-only creator ledger ---
  createPayment(payment: CreatorPayment): void {
    this.payments.insert(payment);
  }
  getPayment(id: CreatorPaymentId): CreatorPayment | undefined {
    return this.payments.get(id);
  }
  updatePayment(payment: CreatorPayment, expectedVersion?: number): void {
    this.payments.replace(payment, expectedVersion);
  }
  listPaymentsForTenant(tenantId: TenantId): CreatorPayment[] {
    return this.payments.find((p) => p.tenantId === tenantId);
  }
  listPaymentsForCreator(creatorId: CreatorId): CreatorPayment[] {
    return this.payments.find((p) => p.creatorId === creatorId);
  }

  /** Read a payment's immutable event stream (tenant-scoped). */
  async ledgerForPayment(
    tenantId: TenantId,
    paymentId: CreatorPaymentId,
  ): Promise<readonly CreatorLedgerEvent[]> {
    return this.ledger
      .find((e) => e.tenantId === tenantId && e.paymentId === paymentId)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }

  /** All creator-ledger events for one creator (tenant-scoped) — derives balances. */
  async ledgerForCreator(tenantId: TenantId, creatorId: CreatorId): Promise<CreatorLedgerEvent[]> {
    return this.ledger
      .find((e) => e.tenantId === tenantId && e.creatorId === creatorId)
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }

  async ledgerForTenant(tenantId: TenantId): Promise<CreatorLedgerEvent[]> {
    return this.ledger.find((e) => e.tenantId === tenantId);
  }

  /**
   * Guarded append to the creator-payment stream: reads the payment's prior
   * events, asserts the transition is legal, and appends idempotently — all in one
   * transaction, so an illegal money transition is rejected before any write.
   */
  async appendLedgerGuarded(event: CreatorLedgerEvent): Promise<void> {
    await this.store.transact(async () => {
      const prior = await this.ledgerForPayment(event.tenantId, event.paymentId);
      const guard = assertCreatorAppendable(prior, event);
      if (!guard.ok) throw guard.error;
      this.ledger.insertIdempotent(event);
    });
  }

  // --- Evaluation schemes (business-owned categories → payment) ---
  upsertScheme(scheme: EvaluationScheme): void {
    this.schemes.upsert(scheme);
  }
  getSchemeForProgram(tenantId: TenantId, programId: CreatorProgramId): EvaluationScheme | undefined {
    return this.schemes.find((s) => s.tenantId === tenantId && s.programId === programId)[0];
  }
  getScheme(tenantId: TenantId, id: string): EvaluationScheme | undefined {
    const s = this.schemes.get(id);
    return s && s.tenantId === tenantId ? s : undefined;
  }

  // --- Capacity & budget ---
  upsertCapacity(capacity: ProgramCapacity): void {
    this.capacities.upsert(capacity);
  }
  getCapacity(tenantId: TenantId, programId: CreatorProgramId): ProgramCapacity | undefined {
    const c = this.capacities.get(programId);
    return c && c.tenantId === tenantId ? c : undefined;
  }
  upsertBudget(budget: ProgramBudget): void {
    this.budgets.upsert(budget);
  }
  getBudget(tenantId: TenantId, programId: CreatorProgramId): ProgramBudget | undefined {
    const b = this.budgets.get(programId);
    return b && b.tenantId === tenantId ? b : undefined;
  }

  // --- Submission disposition (independent pay/quality/reuse decisions) ---
  upsertDisposition(d: SubmissionDisposition): void {
    this.dispositions.upsert(d);
  }
  getDisposition(submissionId: SubmissionId): SubmissionDisposition | undefined {
    return this.dispositions.get(submissionId);
  }
  listDispositions(tenantId: TenantId): SubmissionDisposition[] {
    return this.dispositions.find((d) => d.tenantId === tenantId);
  }

  // --- Business plans (provisional definitions) & trials ---
  upsertPlan(plan: BusinessPlanDefinition): void {
    this.plans.upsert(plan);
  }
  listPlans(): BusinessPlanDefinition[] {
    return this.plans.values();
  }
  upsertTrial(trial: BusinessTrialState): void {
    this.trials.upsert(trial);
  }
  getTrial(businessId: string): BusinessTrialState | undefined {
    return this.trials.get(businessId);
  }

  // --- Promotional channels & placements (disclosed; no paid media) ---
  createChannel(channel: PromotionalChannel): void {
    this.channels.insert(channel);
  }
  listChannels(): PromotionalChannel[] {
    return this.channels.values();
  }
  createPlacement(placement: PromotedPlacement): void {
    this.placements.insert(placement);
  }
  listPlacements(): PromotedPlacement[] {
    return this.placements.values();
  }

  // --- Disputes ---
  createDispute(dispute: Dispute): void {
    this.disputes.insert(dispute);
  }
  getDispute(id: string): Dispute | undefined {
    return this.disputes.get(id);
  }
  updateDispute(dispute: Dispute, expectedVersion?: number): void {
    this.disputes.replace(dispute, expectedVersion);
  }
  listDisputes(tenantId: TenantId): Dispute[] {
    return this.disputes.find((d) => d.tenantId === tenantId);
  }
}
