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
import { UnitOfWork } from "@partnera/persistence";
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

export interface DemoWorld {
  readonly uow: UnitOfWork;
  readonly services: Services;
  readonly tenantId: BusinessId;
  readonly affiliateId: AffiliateId;
  readonly authProvider: DevAuthProvider;
  readonly sessionStore: InMemorySessionStore;
  readonly users: Readonly<Record<"owner" | "finance" | "affiliate" | "admin" | "creator", string>>;
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
export function buildDemoRuntime(opts?: { clock?: Clock; ids?: IdGenerator }): DemoRuntime {
  const uow = new UnitOfWork();
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
  };

  return { world, seed };
}

/** Build and seed a fresh in-memory demo world (used by tests). */
export async function createDemoWorld(): Promise<DemoWorld> {
  const runtime = buildDemoRuntime();
  await runtime.seed();
  return runtime.world;
}
