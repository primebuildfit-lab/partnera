import {
  type AffiliateId,
  asId,
  type BusinessId,
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
 * A self-contained demo environment so the apps are immediately explorable. All
 * data is produced through the **real services** (the money spine actually runs
 * — attribute → convert → commission → approve → payout → paid, plus a fraud
 * hold and a refund clawback), never faked. For local exploration and tests only.
 */

class DemoRail implements PayoutRail {
  readonly name = "demo";
  async execute(_i: PayoutInstruction): Promise<PayoutRailResult> {
    return { ok: true, providerRef: "demo_ref", error: null, retryable: false };
  }
}

/** Deterministic, readable ids for the demo. */
class DemoIds implements IdGenerator {
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
  readonly users: Readonly<Record<"owner" | "finance" | "affiliate" | "admin", string>>;
}

export async function createDemoWorld(): Promise<DemoWorld> {
  const uow = new UnitOfWork();
  const clock = new FixedClock("2026-06-01T09:00:00.000Z");
  const ids = new DemoIds();
  const services = createServices({ uow, clock, ids, events: new InMemoryEventBus() }, new DemoRail());
  const tenantId = asId<BusinessId>("biz_primebuild");

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

  const owner = mkUser("owner", "owner@primebuild.test", "Olivia Owner", "business_owner", false);
  const finance = mkUser("finance", "finance@primebuild.test", "Frank Finance", "finance", false);
  const brian = mkUser("brian", "brian@primebuild.test", "Brian Affiliate", "affiliate", false);
  mkUser("admin", "admin@partnera.test", "Ada Admin", "platform_admin", true);

  const affBrian = asId<AffiliateId>("aff_brian");
  const affCasey = asId<AffiliateId>("aff_casey");
  const programId = asId<ProgramId>("prog_pb_main");

  // --- Offers ---
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

  // --- Tracking definitions ---
  services.tracking.createCoupon(owner, { affiliateId: affBrian, code: "BRIAN10" });
  services.tracking.createCoupon(owner, { affiliateId: affCasey, code: "CASEY10" });
  services.tracking.createLink(owner, { affiliateId: affBrian, code: "brian-home" });

  // --- Orders → conversions (the money spine actually runs) ---
  const convert = async (platformOrderId: string, minor: string, coupon: string, fraud = false) => {
    clock.advanceMs(3_600_000);
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

  const c1 = await convert("PB-1001", "50000", "BRIAN10"); // $500 → $50
  const c2 = await convert("PB-1002", "12000", "BRIAN10"); // $120 → $12 (will be refunded)
  await convert("PB-1003", "8000", "CASEY10"); // $80 → $8 (Casey, pending)
  await convert("PB-1004", "30000", "BRIAN10", true); // held by fraud
  await convert("PB-1005", "9000", "CASEY10"); // pending

  // Approve Brian's two; pay one out; reverse the other via refund.
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

  const sessionStore = new InMemorySessionStore();
  const authProvider = new DevAuthProvider(uow, sessionStore, tenantId, () => clock.now(), (userId) =>
    userId === asId<UserId>("user_brian") ? affBrian : null,
  );

  return {
    uow,
    services,
    tenantId,
    affiliateId: affBrian,
    authProvider,
    sessionStore,
    users: {
      owner: "owner@primebuild.test",
      finance: "finance@primebuild.test",
      affiliate: "brian@primebuild.test",
      admin: "admin@partnera.test",
    },
  };
}
