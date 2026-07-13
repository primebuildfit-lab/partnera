import {
  asId,
  type BusinessId,
  FixedClock,
  InMemoryEventBus,
  Money,
  PermissionDeniedError,
  type RequestContext,
  type RoleId,
  type UserId,
} from "@partnera/core";
import { type PermissionKey } from "@partnera/auth";
import { UnitOfWork } from "@partnera/persistence";
import { SequentialIdGenerator } from "@partnera/testing";
import { describe, expect, it } from "vitest";
import { createServices, type Services } from "./services";

interface Harness {
  uow: UnitOfWork;
  services: Services;
  tenantId: BusinessId;
  actor: (userId: string, perms?: readonly PermissionKey[]) => RequestContext;
}

function setup(tenantId = asId<BusinessId>("biz_1")): Harness {
  const uow = new UnitOfWork();
  const clock = new FixedClock("2026-03-01T00:00:00.000Z");
  const ids = new SequentialIdGenerator();
  const events = new InMemoryEventBus();
  const services = createServices({ uow, clock, ids, events });

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
    uow.identity.createRole({ id: roleId, key: `role_${userId}`, name: userId, scopeLevel: "business", permissions: perms, isSystem: false });
    uow.identity.createUser({ id: uid, email: `${tenantId}_${userId}@x.com`, displayName: userId, status: "active", authSubject: null, createdAt: clock.now() });
    uow.identity.createMembership({ id: asId(`m_${tenantId}_${userId}_${n++}`), userId: uid, scope: { kind: "business", businessId: tenantId }, roleIds: [roleId], status: "active", createdAt: clock.now() });
    return { tenantId, actorUserId: uid, isPlatformOperator: false, requestId: `r_${userId}` };
  };

  return { uow, services, tenantId, actor };
}

/** Business sets up a program/campaign/opportunity with one 100.00 USD deliverable and publishes it. */
async function seedOpportunity(h: Harness, owner: RequestContext) {
  const programId = h.services.creator.createProgram(owner, { name: "Creators", slug: "creators" });
  const campaignId = h.services.creator.createCampaign(owner, { programId, name: "Launch", budgetMinor: "100000", currency: "USD" });
  const opp = h.services.creator.createOpportunity(owner, {
    campaignId,
    title: "UGC video",
    description: "30s vertical",
    eligibility: "open",
    deliverables: [
      { format: "ugc_video", paymentMinor: "10000", currency: "USD", minWidthPx: 1080, minHeightPx: 1920, minDurationSec: 15, maxDurationSec: 60, requiresAudio: true, requiresCta: true, language: "en" },
    ],
  });
  await h.services.creator.publishOpportunity(owner, opp.id);
  const deliverable = h.uow.creator.listDeliverables(opp.id)[0]!;
  return { opp, deliverable };
}

describe("creator marketplace — end-to-end money spine (local, simulated payout)", () => {
  it("opportunity → apply → accept(fee snapshot) → submit → review → approve → authorize → pay → library → rank unlock", async () => {
    const h = setup();
    const owner = h.actor("owner", [
      "creator_program.manage", "content_campaign.manage", "content_opportunity.manage",
      "submission.review", "submission.approve", "content_asset.manage", "rank_unlock.manage", "affiliate_content.view",
    ]);
    const finance = h.actor("finance", ["creator_payment.authorize", "creator_payment.execute"]);
    const creatorCtx = h.actor("creator", ["creator.self"]);

    const { opp, deliverable } = await seedOpportunity(h, owner);

    // Creator self-service
    const profile = h.services.creator.registerProfile(creatorCtx, { displayName: "Brian", formats: ["ugc_video"], platforms: ["tiktok"] });
    expect(profile.displayName).toBe("Brian");
    const app = h.services.creator.apply(creatorCtx, opp.id);
    const accepted = h.services.creator.acceptTerms(creatorCtx, app.id); // default 3% business-paid
    expect(accepted.feeSnapshot?.rateBps).toBe(300);
    expect(accepted.jobId).not.toBeNull();

    const submission = await h.services.creator.submit(creatorCtx, {
      opportunityId: opp.id,
      deliverableId: deliverable.id,
      fileName: "clip.mp4",
      widthPx: 1080, heightPx: 1920, durationSec: 30, hasAudio: true, hasCta: true, language: "en",
    });
    expect(submission.status).toBe("under_review");

    // Advisory AI review (mock) — never authorizes payment
    const ai = h.services.creator.runAIReview(owner, submission.id);
    expect(ai.result.authorizesPayment).toBe(false);
    expect(ai.result.recommendation).toBe("approve");

    // Human decision: approve (creates a payable; money has NOT moved)
    const decided = await h.services.creator.decide(owner, submission.id, {
      decision: "approve",
      categoryScores: { brief_compliance: 90, technical_quality: 85, brand_alignment: 88, creativity: 80, product_clarity: 90 },
      legalSafetyPass: true, fileRequirementsPass: true, reason: "great",
    });
    expect(decided.status).toBe("approved");
    const payment = h.uow.creator.listPaymentsForTenant(h.tenantId).find((p) => p.submissionId === submission.id)!;
    expect(payment.status).toBe("approved");

    // Authorize (finance ≠ approver) → fee recognized from the locked snapshot
    const authorized = await h.services.creator.authorizePayment(finance, payment.id);
    expect(authorized.status).toBe("scheduled");
    const stream = await h.uow.creator.ledgerForPayment(h.tenantId, payment.id);
    expect(stream.map((e) => e.type)).toEqual(["payment.authorized", "platform_fee.recognized"]);
    const feeEvent = stream.find((e) => e.type === "platform_fee.recognized")!;
    expect(feeEvent.type === "platform_fee.recognized" && Money.fromJSON(feeEvent.fee).toDecimalString()).toBe("3.00");

    // Execute payout (SIMULATED)
    const paid = await h.services.creator.executePayout(finance, payment.id);
    expect(paid.status).toBe("paid");
    const balances = await h.services.creator.myBalances(creatorCtx);
    expect(balances[0]!.paid && Money.fromJSON(balances[0]!.paid).toDecimalString()).toBe("100.00"); // business-paid: creator keeps full gross

    // Publish to library + rank unlock
    const assetId = await h.services.creator.publishToLibrary(owner, submission.id);
    h.services.creator.createRankRule(owner, { minRank: "silver" });
    const gold = h.services.creator.resolveAffiliateAccess(owner, assetId, "gold");
    expect(gold.granted).toBe(true);
    const bronze = h.services.creator.resolveAffiliateAccess(owner, assetId, "bronze");
    expect(bronze.granted).toBe(false);
    expect(!bronze.granted && bronze.requiredRank).toBe("silver");
  });

  it("never moves money before approval and enforces separation of duties", async () => {
    const h = setup();
    const owner = h.actor("owner", ["creator_program.manage", "content_campaign.manage", "content_opportunity.manage", "submission.review", "submission.approve", "creator_payment.authorize"]);
    const creatorCtx = h.actor("creator", ["creator.self"]);
    const { opp, deliverable } = await seedOpportunity(h, owner);
    h.services.creator.registerProfile(creatorCtx, { displayName: "Brian" });
    const app = h.services.creator.apply(creatorCtx, opp.id);
    h.services.creator.acceptTerms(creatorCtx, app.id);
    const submission = await h.services.creator.submit(creatorCtx, { opportunityId: opp.id, deliverableId: deliverable.id, fileName: "c.mp4", widthPx: 1080, heightPx: 1920, durationSec: 30, hasAudio: true, hasCta: true, language: "en" });

    // No payable exists before approval.
    expect(h.uow.creator.listPaymentsForTenant(h.tenantId)).toHaveLength(0);

    // Owner approves, then the SAME owner tries to authorize → SoD rejection.
    await h.services.creator.decide(owner, submission.id, { decision: "approve", categoryScores: { brief_compliance: 90, technical_quality: 85, brand_alignment: 88, creativity: 80, product_clarity: 90 }, legalSafetyPass: true, fileRequirementsPass: true, reason: "ok" });
    const payment = h.uow.creator.listPaymentsForTenant(h.tenantId)[0]!;
    await expect(h.services.creator.authorizePayment(owner, payment.id)).rejects.toThrow(/Separation of duties/);
  });

  it("blocks approval when a mandatory safety gate fails", async () => {
    const h = setup();
    const owner = h.actor("owner", ["creator_program.manage", "content_campaign.manage", "content_opportunity.manage", "submission.approve"]);
    const creatorCtx = h.actor("creator", ["creator.self"]);
    const { opp, deliverable } = await seedOpportunity(h, owner);
    h.services.creator.registerProfile(creatorCtx, { displayName: "Brian" });
    const app = h.services.creator.apply(creatorCtx, opp.id);
    h.services.creator.acceptTerms(creatorCtx, app.id);
    const submission = await h.services.creator.submit(creatorCtx, { opportunityId: opp.id, deliverableId: deliverable.id, fileName: "c.mp4", widthPx: 1080, heightPx: 1920, durationSec: 30, hasAudio: true, hasCta: true, language: "en" });
    await expect(
      h.services.creator.decide(owner, submission.id, { decision: "approve", categoryScores: { brief_compliance: 95 }, legalSafetyPass: false, fileRequirementsPass: true, reason: "prohibited claim" }),
    ).rejects.toThrow(/mandatory gate/);
  });

  it("denies a creator without the profile and enforces RBAC on business actions", () => {
    const h = setup();
    const noProfile = h.actor("nobody", ["creator.self"]);
    expect(() => h.services.creator.apply(noProfile, asId("opp_x"))).toThrow(/creator profile/i);
    const reader = h.actor("reader", ["analytics.read"]);
    expect(() => h.services.creator.createProgram(reader, { name: "x", slug: "x" })).toThrow(PermissionDeniedError);
  });

  it("isolates tenants: another tenant cannot see or act on the submission", async () => {
    const h = setup();
    const owner = h.actor("owner", ["creator_program.manage", "content_campaign.manage", "content_opportunity.manage", "submission.approve", "submission.review"]);
    const creatorCtx = h.actor("creator", ["creator.self"]);
    const { opp, deliverable } = await seedOpportunity(h, owner);
    h.services.creator.registerProfile(creatorCtx, { displayName: "Brian" });
    const app = h.services.creator.apply(creatorCtx, opp.id);
    h.services.creator.acceptTerms(creatorCtx, app.id);
    const submission = await h.services.creator.submit(creatorCtx, { opportunityId: opp.id, deliverableId: deliverable.id, fileName: "c.mp4", widthPx: 1080, heightPx: 1920, durationSec: 30, hasAudio: true, hasCta: true, language: "en" });

    // A second tenant on the same store cannot decide on tenant-1's submission.
    const other = asId<BusinessId>("biz_2");
    h.uow.identity.createBusiness({ id: other, organizationId: null, name: "Other", status: "active", planKey: "pro", createdAt: new Date() });
    const rid = asId<RoleId>("role_other");
    h.uow.identity.createRole({ id: rid, key: "o", name: "o", scopeLevel: "business", permissions: ["*"], isSystem: false });
    const uid = asId<UserId>("u_other");
    h.uow.identity.createUser({ id: uid, email: "o@x.com", displayName: "o", status: "active", authSubject: null, createdAt: new Date() });
    h.uow.identity.createMembership({ id: asId("m_other"), userId: uid, scope: { kind: "business", businessId: other }, roleIds: [rid], status: "active", createdAt: new Date() });
    const ctx2: RequestContext = { tenantId: other, actorUserId: uid, isPlatformOperator: false, requestId: "r2" };
    await expect(
      h.services.creator.decide(ctx2, submission.id, { decision: "approve", categoryScores: { brief_compliance: 90 }, legalSafetyPass: true, fileRequirementsPass: true, reason: "x" }),
    ).rejects.toThrow(/not found/i);
  });
});
