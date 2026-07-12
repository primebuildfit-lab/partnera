import {
  type AffiliateId,
  asId,
  type BusinessId,
  FixedClock,
  InMemoryEventBus,
  PermissionDeniedError,
  type ProgramId,
  type RequestContext,
  type RoleId,
  type UserId,
} from "@partnera/core";
import { type PermissionKey } from "@partnera/auth";
import { UnitOfWork } from "@partnera/persistence";
import {
  type PayoutInstruction,
  type PayoutRail,
  type PayoutRailResult,
} from "@partnera/payment-engine";
import { SequentialIdGenerator } from "@partnera/testing";
import { describe, expect, it } from "vitest";
import { createServices, type Services } from "./services";

class OkRail implements PayoutRail {
  readonly name = "test_ok";
  async execute(_i: PayoutInstruction): Promise<PayoutRailResult> {
    return { ok: true, providerRef: "prov_1", error: null, retryable: false };
  }
}

class FailOnceRail implements PayoutRail {
  readonly name = "test_fail_once";
  private calls = 0;
  async execute(_i: PayoutInstruction): Promise<PayoutRailResult> {
    this.calls += 1;
    if (this.calls === 1) return { ok: false, providerRef: null, error: "transient", retryable: true };
    return { ok: true, providerRef: "prov_retry", error: null, retryable: false };
  }
}

interface Harness {
  uow: UnitOfWork;
  clock: FixedClock;
  ids: SequentialIdGenerator;
  services: Services;
  tenantId: BusinessId;
  actor: (userId: string, perms?: readonly PermissionKey[]) => RequestContext;
}

function setup(rail: PayoutRail = new OkRail(), tenantId = asId<BusinessId>("biz_1")): Harness {
  const uow = new UnitOfWork();
  const clock = new FixedClock("2026-03-01T00:00:00.000Z");
  const ids = new SequentialIdGenerator();
  const events = new InMemoryEventBus();
  const services = createServices({ uow, clock, ids, events }, rail);

  uow.identity.createBusiness({
    id: tenantId,
    organizationId: null,
    name: "PrimeBuild",
    status: "active",
    planKey: "pro",
    createdAt: clock.now(),
  });

  let n = 0;
  const actor = (userId: string, perms: readonly PermissionKey[] = ["*"]): RequestContext => {
    const uid = asId<UserId>(`${tenantId}_${userId}`);
    const roleId = asId<RoleId>(`role_${tenantId}_${userId}`);
    uow.identity.createRole({
      id: roleId,
      key: `role_${userId}`,
      name: userId,
      scopeLevel: "business",
      permissions: perms,
      isSystem: false,
    });
    uow.identity.createUser({
      id: uid,
      email: `${tenantId}_${userId}@x.com`,
      displayName: userId,
      status: "active",
      authSubject: null,
      createdAt: clock.now(),
    });
    uow.identity.createMembership({
      id: asId(`m_${tenantId}_${userId}_${n++}`),
      userId: uid,
      scope: { kind: "business", businessId: tenantId },
      roleIds: [roleId],
      status: "active",
      createdAt: clock.now(),
    });
    return { tenantId, actorUserId: uid, isPlatformOperator: false, requestId: `r_${userId}` };
  };

  return { uow, clock, ids, services, tenantId, actor };
}

const affiliateId = asId<AffiliateId>("aff_1");

/** Create + activate a 10%-of-order cash offer attributed by coupon or link. */
async function seedTenPercentOffer(h: Harness, ctx: RequestContext): Promise<void> {
  const offer = h.services.offers.createOffer(ctx, {
    programId: asId<ProgramId>("prog_1"),
    name: "10% cash",
    scope: [{ kind: "all" }],
    conditions: [{ kind: "attribution", via: ["coupon", "link"] }],
    calculation: { kind: "percentage", basisPoints: 1000 },
    reward: { kind: "cash" },
    schedule: { kind: "always" },
    limits: [],
  });
  await h.services.offers.activate(ctx, offer.id, 1);
}

describe("money spine — end to end", () => {
  it("attributes → converts → commissions → approves → pays out", async () => {
    const h = setup();
    const A = h.actor("userA");
    const B = h.actor("userB");

    h.services.tracking.createCoupon(A, { affiliateId, code: "SAVE10" });
    await seedTenPercentOffer(h, A);

    const { orderId } = h.services.tracking.ingestOrder(A, {
      platformOrderId: "O1",
      totalMinorUnits: "50000",
      currency: "USD",
      customerType: "new",
      couponCodes: ["SAVE10"],
    });

    const result = await h.services.tracking.processConversion(A, { orderId });
    expect(result.converted).toBe(true);
    expect(result.commissionId).not.toBeNull();

    let record = await h.services.ledger.getCommission(A, result.commissionId!);
    expect(record!.amount.toDecimalString()).toBe("50.00"); // 10% of $500
    expect(record!.state).toBe("pending");

    await h.services.ledger.approve(A, result.commissionId!);
    let balances = await h.services.ledger.balances(A, affiliateId);
    expect(balances[0]!.available.toDecimalString()).toBe("50.00");

    const payout = await h.services.payments.requestPayout(A, {
      affiliateId,
      commissionIds: [result.commissionId!],
      destinationRef: "dest_opaque",
    });
    await h.services.payments.approve(B, payout.payoutId);
    const executed = await h.services.payments.execute(B, payout.payoutId);
    expect(executed.state).toBe("paid");

    record = await h.services.ledger.getCommission(A, result.commissionId!);
    expect(record!.state).toBe("paid");
    balances = await h.services.ledger.balances(A, affiliateId);
    expect(balances[0]!.paid.toDecimalString()).toBe("50.00");
  });

  it("is idempotent: re-converting an order does not double-pay", async () => {
    const h = setup();
    const A = h.actor("userA");
    h.services.tracking.createCoupon(A, { affiliateId, code: "SAVE10" });
    await seedTenPercentOffer(h, A);
    const { orderId, created } = h.services.tracking.ingestOrder(A, {
      platformOrderId: "O1",
      totalMinorUnits: "50000",
      currency: "USD",
      customerType: "new",
      couponCodes: ["SAVE10"],
    });
    expect(created).toBe(true);
    // Re-ingest the same platform order → not created again.
    expect(h.services.tracking.ingestOrder(A, {
      platformOrderId: "O1",
      totalMinorUnits: "50000",
      currency: "USD",
      customerType: "new",
      couponCodes: ["SAVE10"],
    }).created).toBe(false);

    const first = await h.services.tracking.processConversion(A, { orderId });
    const second = await h.services.tracking.processConversion(A, { orderId });
    expect(second.reason).toBe("already_converted");
    expect(second.commissionId).toBe(first.commissionId);

    const balances = await h.services.ledger.balances(A, affiliateId);
    expect(balances[0]!.pending.toDecimalString()).toBe("50.00"); // not 100
  });

  it("holds a commission and opens a fraud case on risky signals", async () => {
    const h = setup();
    const A = h.actor("userA");
    h.services.tracking.createCoupon(A, { affiliateId, code: "SAVE10" });
    await seedTenPercentOffer(h, A);
    const { orderId } = h.services.tracking.ingestOrder(A, {
      platformOrderId: "O2",
      totalMinorUnits: "50000",
      currency: "USD",
      customerType: "new",
      couponCodes: ["SAVE10"],
    });
    const result = await h.services.tracking.processConversion(A, {
      orderId,
      signals: [{ type: "self_purchase", strength: 1, detail: "buyer==affiliate", observedAt: h.clock.now() }],
    });
    expect(result.held).toBe(true);
    const record = await h.services.ledger.getCommission(A, result.commissionId!);
    expect(record!.state).toBe("held");
    expect(h.services.fraud.listCases(A)).toHaveLength(1);
  });

  it("reverses commissions on refund (clawback), append-only", async () => {
    const h = setup();
    const A = h.actor("userA");
    h.services.tracking.createCoupon(A, { affiliateId, code: "SAVE10" });
    await seedTenPercentOffer(h, A);
    const { orderId } = h.services.tracking.ingestOrder(A, {
      platformOrderId: "O3",
      totalMinorUnits: "50000",
      currency: "USD",
      customerType: "new",
      couponCodes: ["SAVE10"],
    });
    const result = await h.services.tracking.processConversion(A, { orderId });
    await h.services.ledger.approve(A, result.commissionId!);

    const { reversed } = await h.services.tracking.recordRefund(A, {
      orderId,
      amountMinorUnits: "50000",
      currency: "USD",
      reason: "customer return",
    });
    expect(reversed).toBe(1);
    const record = await h.services.ledger.getCommission(A, result.commissionId!);
    expect(record!.state).toBe("reversed");
    const balances = await h.services.ledger.balances(A, affiliateId);
    expect(balances[0]!.available.toDecimalString()).toBe("0.00");
    expect(balances[0]!.reversed.toDecimalString()).toBe("50.00");
  });

  it("retries a failed payout to success", async () => {
    const h = setup(new FailOnceRail());
    const A = h.actor("userA");
    const B = h.actor("userB");
    h.services.tracking.createCoupon(A, { affiliateId, code: "SAVE10" });
    await seedTenPercentOffer(h, A);
    const { orderId } = h.services.tracking.ingestOrder(A, {
      platformOrderId: "O4",
      totalMinorUnits: "50000",
      currency: "USD",
      customerType: "new",
      couponCodes: ["SAVE10"],
    });
    const result = await h.services.tracking.processConversion(A, { orderId });
    await h.services.ledger.approve(A, result.commissionId!);
    const payout = await h.services.payments.requestPayout(A, {
      affiliateId,
      commissionIds: [result.commissionId!],
      destinationRef: "dest",
    });
    await h.services.payments.approve(B, payout.payoutId);

    const failed = await h.services.payments.execute(B, payout.payoutId);
    expect(failed.state).toBe("failed");
    const retried = await h.services.payments.retry(B, payout.payoutId);
    expect(retried.state).toBe("paid");
    expect(retried.attempts).toBe(2);
  });
});

describe("security", () => {
  it("enforces separation of duties on payout approval", async () => {
    const h = setup();
    const A = h.actor("userA");
    h.services.tracking.createCoupon(A, { affiliateId, code: "SAVE10" });
    await seedTenPercentOffer(h, A);
    const { orderId } = h.services.tracking.ingestOrder(A, {
      platformOrderId: "O5",
      totalMinorUnits: "50000",
      currency: "USD",
      customerType: "new",
      couponCodes: ["SAVE10"],
    });
    const result = await h.services.tracking.processConversion(A, { orderId });
    await h.services.ledger.approve(A, result.commissionId!);
    const payout = await h.services.payments.requestPayout(A, {
      affiliateId,
      commissionIds: [result.commissionId!],
      destinationRef: "dest",
    });
    // Same user approving own request must fail (SoD).
    await expect(h.services.payments.approve(A, payout.payoutId)).rejects.toThrow(/Separation of duties/);
  });

  it("denies actions the principal lacks permission for", () => {
    const h = setup();
    const readOnly = h.actor("reader", ["offers.read"]);
    expect(() =>
      h.services.offers.createOffer(readOnly, {
        programId: asId<ProgramId>("prog_1"),
        name: "nope",
        scope: [{ kind: "all" }],
        conditions: [],
        calculation: { kind: "percentage", basisPoints: 1000 },
        reward: { kind: "cash" },
        schedule: { kind: "always" },
        limits: [],
      }),
    ).toThrow(PermissionDeniedError);
  });

  it("isolates tenants: one tenant cannot read another's commissions", async () => {
    const h1 = setup(new OkRail(), asId<BusinessId>("biz_1"));
    const A = h1.actor("userA");
    h1.services.tracking.createCoupon(A, { affiliateId, code: "SAVE10" });
    await seedTenPercentOffer(h1, A);
    const { orderId } = h1.services.tracking.ingestOrder(A, {
      platformOrderId: "O6",
      totalMinorUnits: "50000",
      currency: "USD",
      customerType: "new",
      couponCodes: ["SAVE10"],
    });
    const result = await h1.services.tracking.processConversion(A, { orderId });

    // A second tenant acting on the SAME UnitOfWork cannot see t1's commission.
    const tenant2 = asId<BusinessId>("biz_2");
    h1.uow.identity.createBusiness({
      id: tenant2,
      organizationId: null,
      name: "Other",
      status: "active",
      planKey: "pro",
      createdAt: h1.clock.now(),
    });
    const roleId = asId<RoleId>("role_biz2_admin");
    h1.uow.identity.createRole({
      id: roleId,
      key: "admin2",
      name: "admin2",
      scopeLevel: "business",
      permissions: ["*"],
      isSystem: false,
    });
    const uid = asId<UserId>("user_biz2");
    h1.uow.identity.createUser({
      id: uid,
      email: "b2@x.com",
      displayName: "b2",
      status: "active",
      authSubject: null,
      createdAt: h1.clock.now(),
    });
    h1.uow.identity.createMembership({
      id: asId("m_b2"),
      userId: uid,
      scope: { kind: "business", businessId: tenant2 },
      roleIds: [roleId],
      status: "active",
      createdAt: h1.clock.now(),
    });
    const ctx2: RequestContext = {
      tenantId: tenant2,
      actorUserId: uid,
      isPlatformOperator: false,
      requestId: "r2",
    };
    expect(await h1.services.ledger.getCommission(ctx2, result.commissionId!)).toBeNull();
  });
});
