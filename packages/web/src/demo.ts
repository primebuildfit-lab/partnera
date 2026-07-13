import {
  type AffiliateId,
  asId,
  type BusinessId,
  type Clock,
  type CommissionId,
  FixedClock,
  type IdGenerator,
  InMemoryEventBus,
  type OrderId,
  type OrganizationId,
  type ProgramId,
  type RequestContext,
  type RoleId,
  type UserId,
} from "@partnera/core";
import { createServices, type Services } from "@partnera/application";
import { type RelationalStore, UnitOfWork } from "@partnera/persistence";
import {
  type BusinessPlanId,
  makeCategory,
  type PlacementId,
  type PromotionalChannelId,
} from "@partnera/creator-marketplace";
import { type PayoutInstruction, type PayoutRail, type PayoutRailResult } from "@partnera/payment-engine";
import { DevAuthProvider, InMemorySessionStore } from "./auth";

/**
 * The demo environment so the apps are immediately usable. All data is produced
 * through the **real services** (the money spine actually runs — attribute →
 * convert → commission → approve → payout → paid, plus a fraud hold and a refund
 * clawback), never faked.
 *
 * {@link buildDemoRuntime} constructs the runtime without writing data and
 * returns a `seed()` you call only on first run; the local host persists the
 * store to disk afterwards so subsequent runs load instead of reseeding.
 */

class DemoRail implements PayoutRail {
  readonly name = "demo";
  async execute(_i: PayoutInstruction): Promise<PayoutRailResult> {
    return { ok: true, providerRef: "demo_ref", error: null, retryable: false };
  }
}

/** Deterministic, readable ids for the in-memory demo/tests. */
export class DemoIds implements IdGenerator {
  private n = 0;
  next<B>(): B {
    this.n += 1;
    return `id_${this.n}` as unknown as B;
  }
}

/** Where and how the app's data is stored (for the admin data-status view). */
export interface PersistenceInfo {
  mode: "in-memory" | "local-file";
  dataFile: string | null;
  lastSaveAt: Date | null;
  backupDir: string | null;
}

export interface DemoWorld {
  readonly uow: UnitOfWork;
  readonly services: Services;
  readonly tenantId: BusinessId;
  readonly affiliateId: AffiliateId;
  readonly authProvider: DevAuthProvider;
  readonly sessionStore: InMemorySessionStore;
  readonly users: Readonly<Record<"owner" | "finance" | "affiliate" | "admin" | "creator", string>>;
  /** Mutable persistence descriptor; the local runtime updates it on save. */
  readonly persistence: PersistenceInfo;
}

export interface DemoRuntime {
  readonly world: DemoWorld;
  /** Populate the store via the real services. Call once, on first run. */
  seed(): Promise<void>;
}

const USERS = {
  owner: "owner@primebuild.test",
  finance: "finance@primebuild.test",
  affiliate: "brian@primebuild.test",
  admin: "admin@partnera.test",
  creator: "cora@creators.test",
} as const;

/** Construct the runtime (services, auth, ids) without writing any data. */
export function buildDemoRuntime(opts?: { clock?: Clock; ids?: IdGenerator; store?: RelationalStore }): DemoRuntime {
  // The store is injectable so the hosted runtime can pass a SqlStore(Postgres);
  // omitted => the in-memory reference store (local/dev/tests).
  const uow = new UnitOfWork(opts?.store);
  const clock = opts?.clock ?? new FixedClock("2026-06-01T09:00:00.000Z");
  const ids = opts?.ids ?? new DemoIds();
  const services = createServices({ uow, clock, ids, events: new InMemoryEventBus() }, new DemoRail());
  const tenantId = asId<BusinessId>("biz_primebuild");
  const affBrian = asId<AffiliateId>("aff_brian");

  const sessionStore = new InMemorySessionStore();
  const authProvider = new DevAuthProvider(uow, sessionStore, tenantId, () => clock.now(), (userId) =>
    userId === asId<UserId>("user_brian") ? affBrian : null,
  );

  const world: DemoWorld = {
    uow,
    services,
    tenantId,
    affiliateId: affBrian,
    authProvider,
    sessionStore,
    users: USERS,
    persistence: { mode: "in-memory", dataFile: null, lastSaveAt: null, backupDir: null },
  };

  const seed = async (): Promise<void> => {
    const advance = (ms: number) => {
      if (clock instanceof FixedClock) clock.advanceMs(ms);
    };

    uow.identity.createOrganization({
      id: asId<OrganizationId>("org_pb"),
      name: "PrimeBuild Group",
      createdAt: clock.now(),
    });
    uow.identity.createBusiness({
      id: tenantId,
      organizationId: asId<OrganizationId>("org_pb"),
      name: "PrimeBuild",
      status: "active",
      planKey: "pro",
      createdAt: clock.now(),
    });

    const mkUser = (key: string, email: string, name: string, roleKey: string, platform: boolean): RequestContext => {
      const userId = asId<UserId>(`user_${key}`);
      uow.identity.createUser({
        id: userId,
        email,
        displayName: name,
        status: "active",
        authSubject: null,
        createdAt: clock.now(),
      });
      uow.identity.createMembership({
        id: asId(`m_${key}`),
        userId,
        scope: platform ? { kind: "platform" } : { kind: "business", businessId: tenantId },
        roleIds: [asId<RoleId>(`role_sys_${roleKey}`)],
        status: "active",
        createdAt: clock.now(),
      });
      return { tenantId, actorUserId: userId, isPlatformOperator: platform, requestId: `seed_${key}` };
    };

    const owner = mkUser("owner", USERS.owner, "Olivia Owner", "business_owner", false);
    const finance = mkUser("finance", USERS.finance, "Frank Finance", "finance", false);
    const brian = mkUser("brian", USERS.affiliate, "Brian Affiliate", "affiliate", false);
    mkUser("admin", USERS.admin, "Ada Admin", "platform_admin", true);

    const affCasey = asId<AffiliateId>("aff_casey");
    const programId = asId<ProgramId>("prog_pb_main");

    const tenPct = services.offers.createOffer(owner, {
      programId,
      name: "Sitewide 10% Cash",
      scope: [{ kind: "all" }],
      conditions: [{ kind: "attribution", via: ["coupon", "link"] }],
      calculation: { kind: "percentage", basisPoints: 1000 },
      reward: { kind: "cash" },
      schedule: { kind: "always" },
      limits: [{ kind: "max_per_conversion", amount: { currency: "USD", minorUnits: "20000" } }],
    });
    await services.offers.activate(owner, tenPct.id, 1);

    const fixed = services.offers.createOffer(owner, {
      programId,
      name: "$5 Flat Referral",
      scope: [{ kind: "all" }],
      conditions: [{ kind: "attribution", via: ["coupon", "link", "session"] }],
      calculation: { kind: "fixed", amount: { currency: "USD", minorUnits: "500" } },
      reward: { kind: "cash" },
      schedule: { kind: "always" },
      limits: [],
    });
    await services.offers.activate(owner, fixed.id, 1);

    services.offers.createOffer(owner, {
      programId,
      name: "Holiday 15% (draft)",
      scope: [{ kind: "all" }],
      conditions: [{ kind: "attribution", via: ["coupon"] }],
      calculation: { kind: "percentage", basisPoints: 1500 },
      reward: { kind: "cash" },
      schedule: { kind: "window", startsAt: "2026-12-01T00:00:00Z", endsAt: "2026-12-31T23:59:59Z" },
      limits: [],
    });

    services.tracking.createCoupon(owner, { affiliateId: affBrian, code: "BRIAN10" });
    services.tracking.createCoupon(owner, { affiliateId: affCasey, code: "CASEY10" });
    services.tracking.createLink(owner, { affiliateId: affBrian, code: "brian-home" });

    const convert = async (platformOrderId: string, minor: string, coupon: string, fraud = false) => {
      advance(3_600_000);
      const { orderId } = services.tracking.ingestOrder(owner, {
        platformOrderId,
        totalMinorUnits: minor,
        currency: "USD",
        customerType: "new",
        couponCodes: [coupon],
      });
      const result = await services.tracking.processConversion(owner, {
        orderId,
        signals: fraud
          ? [{ type: "self_purchase", strength: 1, detail: "buyer email == affiliate", observedAt: clock.now() }]
          : undefined,
      });
      return { orderId, commissionId: result.commissionId };
    };

    const c1 = await convert("PB-1001", "50000", "BRIAN10");
    const c2 = await convert("PB-1002", "12000", "BRIAN10");
    await convert("PB-1003", "8000", "CASEY10");
    await convert("PB-1004", "30000", "BRIAN10", true);
    await convert("PB-1005", "9000", "CASEY10");

    if (c1.commissionId) await services.ledger.approve(owner, c1.commissionId as CommissionId);
    if (c2.commissionId) await services.ledger.approve(owner, c2.commissionId as CommissionId);

    if (c1.commissionId) {
      const payout = await services.payments.requestPayout(brian, {
        affiliateId: affBrian,
        commissionIds: [c1.commissionId as CommissionId],
        destinationRef: "brian-bank-****",
      });
      await services.payments.approve(finance, payout.payoutId);
      await services.payments.execute(finance, payout.payoutId);
    }

    await services.tracking.recordRefund(owner, {
      orderId: c2.orderId as OrderId,
      amountMinorUnits: "12000",
      currency: "USD",
      reason: "customer return",
    });

    // --- Creator Marketplace: run the real creator spine (money simulated) ---
    const creator = mkUser("creator", USERS.creator, "Cora Creator", "creator", false);
    const svc = services;
    svc.creator.registerProfile(creator, {
      displayName: "Cora Creator",
      skills: ["editing", "on-camera"],
      formats: ["ugc_video", "short_form_video"],
      platforms: ["tiktok", "instagram"],
    });

    const programId2 = svc.creator.createProgram(owner, { name: "PrimeBuild Creators", slug: "creators" });
    const campaignId = svc.creator.createCampaign(owner, { programId: programId2, name: "Summer Launch", budgetMinor: "500000", currency: "USD" });

    // Opportunity A — goes all the way to paid + published to the library.
    const oppA = svc.creator.createOpportunity(owner, {
      campaignId,
      title: "30s UGC product video",
      description: "Authentic vertical UGC featuring the PrimeBuild kit. Hook in first 3s.",
      eligibility: "open",
      deliverables: [
        { format: "ugc_video", paymentMinor: "15000", currency: "USD", minWidthPx: 1080, minHeightPx: 1920, minDurationSec: 15, maxDurationSec: 60, requiresAudio: true, requiresCta: true, language: "en", talkingPoints: ["3-second hook", "show the product", "clear CTA"], licenseDurationDays: 365 },
      ],
    });
    await svc.creator.publishOpportunity(owner, oppA.id);
    const delA = uow.creator.listDeliverables(oppA.id)[0]!;

    const appA = svc.creator.apply(creator, oppA.id);
    svc.creator.acceptTerms(creator, appA.id); // default 3% business-paid
    const subA = await svc.creator.submit(creator, {
      opportunityId: oppA.id,
      deliverableId: delA.id,
      fileName: "primebuild-ugc.mp4",
      widthPx: 1080, heightPx: 1920, durationSec: 32, hasAudio: true, hasCta: true, language: "en",
      note: "Shot outdoors, natural light.",
    });
    svc.creator.runAIReview(owner, subA.id); // advisory only
    await svc.creator.decide(owner, subA.id, {
      decision: "approve",
      categoryScores: { brief_compliance: 92, technical_quality: 85, brand_alignment: 88, creativity: 80, product_clarity: 90 },
      legalSafetyPass: true, fileRequirementsPass: true, reason: "Strong hook, product clearly shown.",
    });
    const payA = uow.creator.listPaymentsForTenant(tenantId).find((p) => p.submissionId === subA.id)!;
    await svc.creator.authorizePayment(finance, payA.id);
    await svc.creator.executePayout(finance, payA.id); // SIMULATED
    await svc.creator.publishToLibrary(owner, subA.id);
    svc.creator.createRankRule(owner, { campaignId, minRank: "silver" });

    // Opportunity B — left open with a submission awaiting review (review queue).
    const oppB = svc.creator.createOpportunity(owner, {
      campaignId,
      title: "Unboxing short",
      description: "15-30s unboxing with genuine reaction.",
      eligibility: "open",
      deliverables: [
        { format: "unboxing", paymentMinor: "8000", currency: "USD", minDurationSec: 15, maxDurationSec: 45, requiresAudio: true, language: "en", licenseDurationDays: 180 },
      ],
    });
    await svc.creator.publishOpportunity(owner, oppB.id);
    const delB = uow.creator.listDeliverables(oppB.id)[0]!;
    const appB = svc.creator.apply(creator, oppB.id);
    svc.creator.acceptTerms(creator, appB.id);
    await svc.creator.submit(creator, {
      opportunityId: oppB.id, deliverableId: delB.id, fileName: "unboxing.mp4",
      durationSec: 28, hasAudio: true, language: "en", note: "First reaction, one take.",
    });
    // (left under_review so the business has a live review queue to work)

    // --- PrimeBuild's OWN configurable program (Part 2/12) ---
    // These categories + payments belong to PrimeBuild, not Partnera.
    svc.creator.saveScheme(owner, programId2, [
      makeCategory({ key: "rejected", name: "Rejected", order: 1, minScore: 0, maxScore: 39, paymentMinor: "0", currency: "USD", payable: false, libraryEligible: true, affiliateEligible: false, color: "#ef4444", description: "Not eligible for payout; may be retained internally." }),
      makeCategory({ key: "acceptable", name: "Acceptable", order: 2, minScore: 40, maxScore: 64, paymentMinor: "1000", currency: "USD", libraryEligible: true, color: "#f59e0b", description: "Basic usable content." }),
      makeCategory({ key: "good", name: "Good", order: 3, minScore: 65, maxScore: 84, paymentMinor: "2000", currency: "USD", affiliateEligible: true, color: "#3b82f6", description: "Strong reusable content; affiliate-eligible." }),
      makeCategory({ key: "excellent", name: "Excellent", order: 4, minScore: 85, maxScore: 100, paymentMinor: "3500", currency: "USD", affiliateEligible: true, color: "#16a34a", description: "Premium; prioritized for affiliate distribution." }),
    ]);
    // Budget deliberately tight so the pilot demonstrates a waiting-for-budget item.
    svc.creator.setBudget(owner, programId2, { totalMinor: "17000", currency: "USD" }); // $170
    svc.creator.setCapacity(owner, programId2, { maxAccepted: 10, pauseWhenReached: true });
    // Persist PrimeBuild's platform-fee rate (3%) as an editable record, not a default.
    svc.creator.setFeeRate(owner, programId2, 300, "business");

    // Opportunity C — reviewed "Excellent" but over budget → waiting_for_budget.
    const oppC = svc.creator.createOpportunity(owner, { campaignId, title: "Testimonial (premium)", description: "Authentic testimonial.", eligibility: "open", deliverables: [{ format: "testimonial", paymentMinor: "3500", currency: "USD", minDurationSec: 15, requiresAudio: true, language: "en" }] });
    await svc.creator.publishOpportunity(owner, oppC.id);
    const delC = uow.creator.listDeliverables(oppC.id)[0]!;
    const appC = svc.creator.apply(creator, oppC.id); svc.creator.acceptTerms(creator, appC.id);
    const subC = await svc.creator.submit(creator, { opportunityId: oppC.id, deliverableId: delC.id, fileName: "testimonial.mp4", durationSec: 40, hasAudio: true, hasCta: true, language: "en", note: "Great story" });
    await svc.creator.reviewWithScheme(owner, subC.id, { categoryKey: "excellent", accept: true, reason: "Excellent, but reserve budget first.", legalCleared: true });

    // Opportunity D — reviewed "Rejected" category but retained internally (reusable b-roll).
    const oppD = svc.creator.createOpportunity(owner, { campaignId, title: "Lifestyle b-roll", description: "Ambient lifestyle footage.", eligibility: "open", deliverables: [{ format: "raw_footage", paymentMinor: "0", currency: "USD", language: "en" }] });
    await svc.creator.publishOpportunity(owner, oppD.id);
    const delD = uow.creator.listDeliverables(oppD.id)[0]!;
    const appD = svc.creator.apply(creator, oppD.id); svc.creator.acceptTerms(creator, appD.id);
    const subD = await svc.creator.submit(creator, { opportunityId: oppD.id, deliverableId: delD.id, fileName: "broll.mp4", durationSec: 12, hasAudio: false, language: "en", note: "Raw ambient" });
    await svc.creator.reviewWithScheme(owner, subD.id, { categoryKey: "rejected", accept: true, reason: "Off-brief but useful as internal b-roll." });

    // Opportunity E — reviewed "Good" and within budget → an APPROVED payable left
    // for Brian to authorize in the pilot (the "authorize simulated payment" step).
    const oppE = svc.creator.createOpportunity(owner, { campaignId, title: "Product demo (short)", description: "Quick product demo.", eligibility: "open", deliverables: [{ format: "product_demo", paymentMinor: "2000", currency: "USD", minWidthPx: 1080, requiresCta: true, language: "en" }] });
    await svc.creator.publishOpportunity(owner, oppE.id);
    const delE = uow.creator.listDeliverables(oppE.id)[0]!;
    const appE = svc.creator.apply(creator, oppE.id); svc.creator.acceptTerms(creator, appE.id);
    const subE = await svc.creator.submit(creator, { opportunityId: oppE.id, deliverableId: delE.id, fileName: "demo.mp4", widthPx: 1080, heightPx: 1920, durationSec: 25, hasAudio: true, hasCta: true, language: "en", note: "Clear product demo with CTA" });
    await svc.creator.reviewWithScheme(owner, subE.id, { categoryKey: "good", accept: true, reason: "Solid demo — approve at Good.", legalCleared: true });

    // --- Provisional business plans + a disclosed house promotion (Parts 9/10) ---
    uow.creator.upsertPlan({ id: asId<BusinessPlanId>("plan_starter"), key: "starter", name: "Starter (provisional)", provisional: true, trialDays: 150, maxActivePrograms: 1, submissionsPerMonth: 50, transactionFeeBps: 400, customBranding: false, notes: "Up to 5-month intro trial; trial length configurable, not globally locked." });
    uow.creator.upsertPlan({ id: asId<BusinessPlanId>("plan_pro"), key: "pro", name: "Pro (provisional)", provisional: true, trialDays: 30, maxActivePrograms: 10, submissionsPerMonth: 1000, transactionFeeBps: 300, customBranding: true, notes: "Reduced fee within the 2-4% range; final price undecided." });
    uow.creator.upsertTrial({ businessId: tenantId, planKey: "pro", state: "active", startedAt: clock.now(), trialEndsAt: new Date(clock.now().getTime() + 150 * 24 * 60 * 60 * 1000) });
    uow.creator.createChannel({ id: asId<PromotionalChannelId>("chan_house"), tenantId: null, kind: "house_promotion", name: "Partnera House", active: true, createdAt: clock.now() });
    uow.creator.createPlacement({ id: asId<PlacementId>("place_1"), channelId: asId<PromotionalChannelId>("chan_house"), tenantId: null, subjectType: "business", subjectId: tenantId, priority: 1, startAt: clock.now(), endAt: new Date(clock.now().getTime() + 30 * 24 * 60 * 60 * 1000), disclosure: "Promoted placement — Partnera house promotion (no paid media).", status: "active", createdAt: clock.now() });

    // --- Internal OS: two separate money books + alerts (SIMULATED, no real money) ---
    const usdJson = (major: string) => ({ currency: "USD", minorUnits: String(Math.round(Number(major) * 100)) });
    const now = clock.now();
    // Bank A — Partnera Revenue (membership fees + platform fees Partnera earned).
    uow.platform.appendRevenue({ id: asId("rev_1"), type: "revenue.recognized", source: "membership", amount: usdJson("299.00"), occurredAt: now, correlationId: "seed", businessId: tenantId, planKey: "pro", country: "US" } as never);
    uow.platform.appendRevenue({ id: asId("rev_2"), type: "revenue.recognized", source: "platform_fee", amount: usdJson("1.05"), occurredAt: now, correlationId: "seed", businessId: tenantId } as never);
    uow.platform.appendRevenue({ id: asId("rev_3"), type: "revenue.reserved", amount: usdJson("50.00"), reason: "operating reserve", occurredAt: now, correlationId: "seed" } as never);
    // Bank B — Vault (PrimeBuild's deposited content budget; committed to a job; a payout).
    uow.platform.appendVault({ id: asId("va_1"), businessId: tenantId, type: "vault.deposited", amount: usdJson("1000.00"), occurredAt: now, correlationId: "seed" } as never);
    uow.platform.appendVault({ id: asId("va_2"), businessId: tenantId, type: "vault.committed", amount: usdJson("150.00"), toward: "creator-order", occurredAt: now, correlationId: "seed" } as never);
    uow.platform.appendVault({ id: asId("va_3"), businessId: tenantId, type: "vault.paid_out", amount: usdJson("35.00"), reference: "SIMULATED", occurredAt: now, correlationId: "seed" } as never);
    // Alerts.
    uow.platform.upsertAlert({ id: "al_1", severity: "warning", category: "capacity", title: "Order 'Testimonial (premium)' waiting for budget", entityRef: tenantId, status: "new", suggestedAction: "Increase program budget or promote from queue", createdAt: now, updatedAt: now });
    uow.platform.upsertAlert({ id: "al_2", severity: "info", category: "integration", title: "Postgres alojado no conectado (modo local)", entityRef: null, status: "acknowledged", suggestedAction: "Activar en deploy", createdAt: now, updatedAt: now });
  };

  return { world, seed };
}

/** Build and seed a fresh in-memory demo world (used by tests). */
export async function createDemoWorld(): Promise<DemoWorld> {
  const runtime = buildDemoRuntime();
  await runtime.seed();
  return runtime.world;
}
