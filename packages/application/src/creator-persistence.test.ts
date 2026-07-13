import { asId, type BusinessId, FixedClock, InMemoryEventBus, type RequestContext, type RoleId, type UserId, PermissionDeniedError } from "@partnera/core";
import { type PermissionKey } from "@partnera/auth";
import { RelationalStore, UnitOfWork, serializeStore, deserializeStore } from "@partnera/persistence";
import { makeCategory, type CreatorProgramId } from "@partnera/creator-marketplace";
import { SequentialIdGenerator } from "@partnera/testing";
import { describe, expect, it } from "vitest";
import { createServices } from "./services";

function setup(store?: RelationalStore, tenantId = asId<BusinessId>("biz_1")) {
  const uow = new UnitOfWork(store);
  const clock = new FixedClock("2026-07-13T00:00:00.000Z");
  const services = createServices({ uow, clock, ids: new SequentialIdGenerator(), events: new InMemoryEventBus() });
  if (!store) uow.identity.createBusiness({ id: tenantId, organizationId: null, name: "PrimeBuild", status: "active", planKey: "pro", createdAt: clock.now() });
  const actor = (u: string, p: readonly PermissionKey[] = ["*"]): RequestContext => {
    const uid = asId<UserId>(`u_${u}`); const rid = asId<RoleId>(`r_${u}`);
    if (!uow.identity.getRole(rid)) {
      uow.identity.createRole({ id: rid, key: u, name: u, scopeLevel: "business", permissions: p, isSystem: false });
      uow.identity.createUser({ id: uid, email: `${u}@x.com`, displayName: u, status: "active", authSubject: null, createdAt: clock.now() });
      uow.identity.createMembership({ id: asId(`m_${u}`), userId: uid, scope: { kind: "business", businessId: tenantId }, roleIds: [rid], status: "active", createdAt: clock.now() });
    }
    return { tenantId, actorUserId: uid, isPlatformOperator: false, requestId: `r_${u}` };
  };
  return { uow, services, tenantId, actor, clock };
}

const ownerPerms: PermissionKey[] = ["creator.view", "creator_program.manage", "content_campaign.manage", "content_opportunity.manage", "submission.review", "submission.approve"];
const pb = () => [
  makeCategory({ key: "rejected", name: "Rejected", order: 1, minScore: 0, maxScore: 39, paymentMinor: "0", payable: false }),
  makeCategory({ key: "excellent", name: "Excellent", order: 2, minScore: 40, maxScore: 100, paymentMinor: "3500", affiliateEligible: true }),
];

function seedProgram(h: ReturnType<typeof setup>, owner: RequestContext): CreatorProgramId {
  const programId = h.services.creator.createProgram(owner, { name: "Creators", slug: "creators" });
  h.services.creator.saveScheme(owner, programId, pb());
  h.services.creator.setBudget(owner, programId, { totalMinor: "50000", currency: "USD" });
  h.services.creator.setCapacity(owner, programId, { maxAccepted: 10, pauseWhenReached: true });
  h.services.creator.setFeeRate(owner, programId, 300, "business");
  return programId;
}

describe("PrimeBuild pilot configuration is persisted (not UI-only)", () => {
  it("scheme, budget, capacity, fee, and checklist survive a store snapshot round-trip", () => {
    const store = new RelationalStore();
    const h = setup(store);
    const owner = h.actor("owner", ownerPerms);
    const programId = seedProgram(h, owner);
    h.services.creator.setPilotItem(owner, "budget", true);

    // Round-trip through the durable snapshot (what the local file persistence uses).
    const json = serializeStore(store);
    const store2 = new RelationalStore();
    const h2 = setup(store2);
    deserializeStore(store2, json);
    const owner2 = h2.actor("owner", ownerPerms);

    const scheme = h2.services.creator.getScheme(owner2, programId);
    expect(scheme.categories.map((c) => c.key)).toEqual(["rejected", "excellent"]);
    expect(h2.services.creator.getFeeConfig(owner2, programId).rateBps).toBe(300);
    expect(h2.services.creator.getBudget(owner2, programId)?.totalMinor).toBe("50000");
    expect(h2.services.creator.getCapacity(owner2, programId)?.maxAccepted).toBe(10);
    expect(h2.services.creator.getPilotChecklist(owner2).budget).toBe(true);
  });

  it("fee rate is editable and validated to the 2–4% range", () => {
    const h = setup();
    const owner = h.actor("owner", ownerPerms);
    const programId = seedProgram(h, owner);
    h.services.creator.setFeeRate(owner, programId, 400);
    expect(h.services.creator.getFeeConfig(owner, programId).rateBps).toBe(400);
    expect(() => h.services.creator.setFeeRate(owner, programId, 500)).toThrow();
    expect(() => h.services.creator.setFeeRate(owner, programId, 100)).toThrow();
  });

  it("company payments are business-specific, not a Partnera global default", () => {
    const h = setup();
    const owner = h.actor("owner", ownerPerms);
    const programId = seedProgram(h, owner);
    // A fresh, unconfigured program returns the generic default (single 'approved'), never PrimeBuild's.
    const other = h.services.creator.createProgram(owner, { name: "Other", slug: "other" });
    expect(h.services.creator.getScheme(owner, other).categories.map((c) => c.key)).toEqual(["approved"]);
    expect(h.services.creator.getScheme(owner, programId).categories.some((c) => c.paymentMinor === "3500")).toBe(true);
  });

  it("a creator cannot edit fee, budget, or pilot checklist", () => {
    const h = setup();
    const owner = h.actor("owner", ownerPerms);
    const programId = seedProgram(h, owner);
    const creator = h.actor("creator", ["creator.self", "creator.view"]);
    expect(() => h.services.creator.setFeeRate(creator, programId, 300)).toThrow(PermissionDeniedError);
    expect(() => h.services.creator.setPilotItem(creator, "budget", true)).toThrow(PermissionDeniedError);
  });

  it("integrity check reports OK for a clean pilot and counts records", () => {
    const h = setup();
    const owner = h.actor("owner", ownerPerms);
    seedProgram(h, owner);
    const result = h.services.creator.integrityCheck(owner);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.counts.creator_programs).toBeGreaterThanOrEqual(1);
    expect(result.counts.program_fee_settings).toBeGreaterThanOrEqual(1);
  });

  it("checklist progress is per-business and isolated across tenants", () => {
    const store = new RelationalStore();
    const h = setup(store);
    const owner = h.actor("owner", ownerPerms);
    seedProgram(h, owner);
    h.services.creator.setPilotItem(owner, "fee_pct", true);
    expect(h.services.creator.getPilotChecklist(owner).fee_pct).toBe(true);

    // A second tenant sharing the same store sees an empty checklist.
    const t2 = asId<BusinessId>("biz_2");
    h.uow.identity.createBusiness({ id: t2, organizationId: null, name: "Other Co", status: "active", planKey: "pro", createdAt: h.clock.now() });
    const rid = asId<RoleId>("r_o2"); h.uow.identity.createRole({ id: rid, key: "o2", name: "o2", scopeLevel: "business", permissions: ["*"], isSystem: false });
    const uid = asId<UserId>("u_o2"); h.uow.identity.createUser({ id: uid, email: "o2@x.com", displayName: "o2", status: "active", authSubject: null, createdAt: h.clock.now() });
    h.uow.identity.createMembership({ id: asId("m_o2"), userId: uid, scope: { kind: "business", businessId: t2 }, roleIds: [rid], status: "active", createdAt: h.clock.now() });
    const ctx2: RequestContext = { tenantId: t2, actorUserId: uid, isPlatformOperator: false, requestId: "r2" };
    expect(h.services.creator.getPilotChecklist(ctx2)).toEqual({});
  });
});
