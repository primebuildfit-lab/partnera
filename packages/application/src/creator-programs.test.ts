import { asId, type BusinessId, FixedClock, InMemoryEventBus, Money, PermissionDeniedError, type RequestContext, type RoleId, type UserId } from "@partnera/core";
import { type PermissionKey } from "@partnera/auth";
import { UnitOfWork } from "@partnera/persistence";
import { makeCategory, type CreatorProgramId, type SubmissionId } from "@partnera/creator-marketplace";
import { SequentialIdGenerator } from "@partnera/testing";
import { describe, expect, it } from "vitest";
import { createServices, type Services } from "./services";

interface H { uow: UnitOfWork; services: Services; tenantId: BusinessId; actor: (u: string, p?: readonly PermissionKey[]) => RequestContext }

function setup(tenantId = asId<BusinessId>("biz_1")): H {
  const uow = new UnitOfWork();
  const clock = new FixedClock("2026-03-01T00:00:00.000Z");
  const ids = new SequentialIdGenerator();
  const services = createServices({ uow, clock, ids, events: new InMemoryEventBus() });
  uow.identity.createBusiness({ id: tenantId, organizationId: null, name: "PrimeBuild", status: "active", planKey: "pro", createdAt: clock.now() });
  let n = 0;
  const actor = (u: string, p: readonly PermissionKey[] = ["*"]): RequestContext => {
    const uid = asId<UserId>(`${tenantId}_${u}`); const rid = asId<RoleId>(`role_${tenantId}_${u}`);
    uow.identity.createRole({ id: rid, key: `role_${u}`, name: u, scopeLevel: "business", permissions: p, isSystem: false });
    uow.identity.createUser({ id: uid, email: `${tenantId}_${u}@x.com`, displayName: u, status: "active", authSubject: null, createdAt: clock.now() });
    uow.identity.createMembership({ id: asId(`m_${tenantId}_${u}_${n++}`), userId: uid, scope: { kind: "business", businessId: tenantId }, roleIds: [rid], status: "active", createdAt: clock.now() });
    return { tenantId, actorUserId: uid, isPlatformOperator: false, requestId: `r_${u}` };
  };
  return { uow, services, tenantId, actor };
}

// PrimeBuild's OWN provisional categories — not a Partnera global constant.
const pbCategories = () => [
  makeCategory({ key: "rejected", name: "Rejected", order: 1, minScore: 0, maxScore: 39, paymentMinor: "0", payable: false, libraryEligible: true }),
  makeCategory({ key: "acceptable", name: "Acceptable", order: 2, minScore: 40, maxScore: 64, paymentMinor: "1000" }),
  makeCategory({ key: "good", name: "Good", order: 3, minScore: 65, maxScore: 84, paymentMinor: "2000", affiliateEligible: true }),
  makeCategory({ key: "excellent", name: "Excellent", order: 4, minScore: 85, maxScore: 100, paymentMinor: "3500", affiliateEligible: true }),
];

async function seedSubmission(h: H, owner: RequestContext, creatorCtx: RequestContext) {
  const programId = h.services.creator.createProgram(owner, { name: "Creators", slug: "creators" });
  const campaignId = h.services.creator.createCampaign(owner, { programId, name: "Launch", budgetMinor: "100000", currency: "USD" });
  const opp = h.services.creator.createOpportunity(owner, { campaignId, title: "UGC", description: "d", eligibility: "open", deliverables: [{ format: "ugc_video", paymentMinor: "9999", currency: "USD", minWidthPx: 1080, requiresCta: true }] });
  await h.services.creator.publishOpportunity(owner, opp.id);
  const del = h.uow.creator.listDeliverables(opp.id)[0]!;
  h.services.creator.registerProfile(creatorCtx, { displayName: "Cora" });
  const app = h.services.creator.apply(creatorCtx, opp.id);
  h.services.creator.acceptTerms(creatorCtx, app.id);
  const sub = await h.services.creator.submit(creatorCtx, { opportunityId: opp.id, deliverableId: del.id, fileName: "c.mp4", widthPx: 1080, heightPx: 1920, durationSec: 30, hasAudio: true, hasCta: true, language: "en", note: "nice hook" });
  return { programId, opp, sub };
}

describe("configurable program — business owns categories & payments", () => {
  const ownerPerms: PermissionKey[] = ["creator_program.manage", "content_campaign.manage", "content_opportunity.manage", "submission.review", "submission.approve", "content_asset.manage"];

  it("pays the SCHEME category amount (business config), not the deliverable field", async () => {
    const h = setup();
    const owner = h.actor("owner", ownerPerms);
    const creatorCtx = h.actor("creator", ["creator.self"]);
    const { programId, sub } = await seedSubmission(h, owner, creatorCtx);
    h.services.creator.saveScheme(owner, programId, pbCategories());

    const rec = h.services.creator.recommend(owner, sub.id);
    expect(rec.recommendation.technicalScore).toBeGreaterThan(0);
    expect(rec.recommendation.recommendedCategoryKey).toBeTruthy();

    // Reviewer confirms "excellent" → payment is PrimeBuild's $35, from the scheme.
    const res = await h.services.creator.reviewWithScheme(owner, sub.id, { categoryKey: "excellent", accept: true, reason: "great", legalCleared: true });
    expect(res.paymentId).not.toBeNull();
    const payment = h.uow.creator.getPayment(res.paymentId!)!;
    expect(Money.fromJSON(payment.gross).toDecimalString()).toBe("35.00");
    expect(res.disposition.affiliateAccess).toBe("eligible");
    expect(res.disposition.paymentEligible).toBe(true);
  });

  it("a low-score 'Rejected' category retains content internally with NO payment", async () => {
    const h = setup();
    const owner = h.actor("owner", ownerPerms);
    const creatorCtx = h.actor("creator", ["creator.self"]);
    const { programId, sub } = await seedSubmission(h, owner, creatorCtx);
    h.services.creator.saveScheme(owner, programId, pbCategories());
    const res = await h.services.creator.reviewWithScheme(owner, sub.id, { categoryKey: "rejected", accept: true, reason: "off-brief but reusable b-roll" });
    expect(res.paymentId).toBeNull();
    expect(res.disposition.paymentEligible).toBe(false);
    expect(res.disposition.libraryStatus).toBe("internal_only");
    expect(res.disposition.internalUse).toBe("internal");
  });

  it("routes an accepted payable to waiting_for_budget when budget is short (never auto-rejects)", async () => {
    const h = setup();
    const owner = h.actor("owner", ownerPerms);
    const creatorCtx = h.actor("creator", ["creator.self"]);
    const { programId, sub } = await seedSubmission(h, owner, creatorCtx);
    h.services.creator.saveScheme(owner, programId, pbCategories());
    h.services.creator.setBudget(owner, programId, { totalMinor: "1000", currency: "USD" }); // only $10, need $35
    const res = await h.services.creator.reviewWithScheme(owner, sub.id, { categoryKey: "excellent", accept: true, reason: "great but no budget" });
    expect(res.paymentId).toBeNull();
    expect(res.disposition.queueState).toBe("waiting_for_budget");
    expect(res.disposition.paymentEligible).toBe(true); // honest: eligible, awaiting budget
  });

  it("routes to waiting_for_capacity when the accepted limit is reached", async () => {
    const h = setup();
    const owner = h.actor("owner", ownerPerms);
    const creatorCtx = h.actor("creator", ["creator.self"]);
    const { programId, sub } = await seedSubmission(h, owner, creatorCtx);
    h.services.creator.saveScheme(owner, programId, pbCategories());
    h.services.creator.setBudget(owner, programId, { totalMinor: "100000", currency: "USD" });
    h.services.creator.setCapacity(owner, programId, { maxAccepted: 0, pauseWhenReached: true });
    const res = await h.services.creator.reviewWithScheme(owner, sub.id, { categoryKey: "good", accept: true, reason: "capacity full" });
    expect(res.disposition.queueState).toBe("waiting_for_capacity");
    expect(res.paymentId).toBeNull();
  });

  it("exposure reflects committed spend + projected fee + remaining", async () => {
    const h = setup();
    const owner = h.actor("owner", ownerPerms);
    const creatorCtx = h.actor("creator", ["creator.self"]);
    const { programId, sub } = await seedSubmission(h, owner, creatorCtx);
    h.services.creator.saveScheme(owner, programId, pbCategories());
    h.services.creator.setBudget(owner, programId, { totalMinor: "100000", currency: "USD" });
    await h.services.creator.reviewWithScheme(owner, sub.id, { categoryKey: "excellent", accept: true, reason: "ok" });
    const e = h.services.creator.exposureFor(owner, programId)!;
    expect(Money.fromJSON(e.committed).toDecimalString()).toBe("35.00");
    expect(Money.fromJSON(e.remaining).toDecimalString()).toBe("965.00");
    expect(Money.fromJSON(e.projectedFee).toDecimalString()).toBe("1.05"); // 3% of $35
  });
});

describe("configurable program — permissions & isolation (negative)", () => {
  it("a creator cannot save a scheme or set prices", async () => {
    const h = setup();
    const creatorCtx = h.actor("creator", ["creator.self"]);
    expect(() => h.services.creator.saveScheme(creatorCtx, asId<CreatorProgramId>("p1"), pbCategories())).toThrow(PermissionDeniedError);
    expect(() => h.services.creator.setBudget(creatorCtx, asId<CreatorProgramId>("p1"), { totalMinor: "1", currency: "USD" })).toThrow(PermissionDeniedError);
  });

  it("another tenant cannot read this program's scheme or exposure", async () => {
    const h = setup();
    const owner = h.actor("owner", ["creator_program.manage", "content_campaign.manage", "content_opportunity.manage"]);
    const programId = h.services.creator.createProgram(owner, { name: "P", slug: "p" });
    h.services.creator.saveScheme(owner, programId, pbCategories());

    const other = asId<BusinessId>("biz_2");
    h.uow.identity.createBusiness({ id: other, organizationId: null, name: "Other", status: "active", planKey: "pro", createdAt: new Date() });
    const rid = asId<RoleId>("r2"); h.uow.identity.createRole({ id: rid, key: "o", name: "o", scopeLevel: "business", permissions: ["*"], isSystem: false });
    const uid = asId<UserId>("u2"); h.uow.identity.createUser({ id: uid, email: "o@x.com", displayName: "o", status: "active", authSubject: null, createdAt: new Date() });
    h.uow.identity.createMembership({ id: asId("m2"), userId: uid, scope: { kind: "business", businessId: other }, roleIds: [rid], status: "active", createdAt: new Date() });
    const ctx2: RequestContext = { tenantId: other, actorUserId: uid, isPlatformOperator: false, requestId: "r2" };
    // getScheme for a foreign program returns the *default* (empty), never tenant-1's config.
    const scheme = h.services.creator.getScheme(ctx2, programId);
    expect(scheme.categories.map((c) => c.key)).toEqual(["approved"]); // default, not PrimeBuild's four
  });

  it("AI recommendation never sets payment (advisory only)", async () => {
    const h = setup();
    const owner = h.actor("owner", ["creator_program.manage", "content_campaign.manage", "content_opportunity.manage", "submission.review"]);
    const creatorCtx = h.actor("creator", ["creator.self"]);
    const { programId, sub } = await seedSubmission(h, owner, creatorCtx);
    h.services.creator.saveScheme(owner, programId, pbCategories());
    h.services.creator.recommend(owner, sub.id as SubmissionId);
    // No payable is created by recommending.
    expect(h.uow.creator.listPaymentsForTenant(h.tenantId)).toHaveLength(0);
  });
});
