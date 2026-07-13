import { asId, type BusinessId, type TenantId, type UserId, Money } from "@partnera/core";
import {
  type ContentOpportunity,
  type CreatorId,
  type CreatorLedgerEvent,
  type CreatorLedgerEventId,
  type CreatorPayment,
  type CreatorPaymentId,
  type CreatorProfile,
  type OpportunityId,
  type SubmissionId,
  type SubmissionVersion,
  type SubmissionVersionId,
} from "@partnera/creator-marketplace";
import { describe, expect, it } from "vitest";
import { serializeStore, deserializeStore } from "../snapshot";
import { UnitOfWork } from "../unit-of-work";

const t = (id: string) => asId<TenantId>(id);
const now = new Date("2026-07-12T00:00:00Z");

const profile = (id: string, userId: string): CreatorProfile => ({
  id: asId<CreatorId>(id),
  userId: asId<UserId>(userId),
  displayName: id,
  skills: [],
  formats: ["ugc_video"],
  platforms: ["tiktok"],
  verification: "l1",
  status: "active",
  createdAt: now,
});

const opportunity = (id: string, tenant: string): ContentOpportunity => ({
  id: asId<OpportunityId>(id),
  tenantId: t(tenant),
  businessId: asId<BusinessId>(tenant),
  campaignId: asId("camp_1"),
  title: id,
  description: "",
  status: "open",
  eligibility: "open",
  specVersion: 1,
  createdAt: now,
});

const ledgerBase = (id: string, tenant: string, paymentId: string) => ({
  id: asId<CreatorLedgerEventId>(id),
  tenantId: t(tenant),
  businessId: asId<BusinessId>(tenant),
  creatorId: asId<CreatorId>("creator_1"),
  paymentId: asId<CreatorPaymentId>(paymentId),
  occurredAt: now,
  correlationId: "c1",
});

describe("CreatorRepository — tenant isolation", () => {
  it("scopes opportunities and never returns another tenant's", () => {
    const uow = new UnitOfWork();
    uow.creator.createOpportunity(opportunity("opp_a", "biz_1"));
    uow.creator.createOpportunity(opportunity("opp_b", "biz_2"));

    expect(uow.creator.listOpportunities(t("biz_1")).map((o) => o.id)).toEqual(["opp_a"]);
    expect(uow.creator.getOpportunityScoped(t("biz_2"), asId<OpportunityId>("opp_a"))).toBeUndefined();
    expect(uow.creator.listOpenOpportunities()).toHaveLength(2); // discovery is cross-tenant, open only
  });
});

describe("CreatorRepository — append-only", () => {
  it("rejects updates to submission versions", () => {
    const uow = new UnitOfWork();
    const v: SubmissionVersion = {
      id: asId<SubmissionVersionId>("ver_1"),
      submissionId: asId<SubmissionId>("sub_1"),
      seq: 1,
      demoStorage: true,
      fileName: "clip.mp4",
      createdAt: now,
    };
    uow.creator.addVersion(v);
    expect(() => uow.creator.addVersion({ ...v, fileName: "changed.mp4" })).toThrow();
  });
});

describe("CreatorRepository — guarded creator ledger", () => {
  it("rejects an illegal first event and accepts a legal chain", async () => {
    const uow = new UnitOfWork();
    const paid: CreatorLedgerEvent = { ...ledgerBase("e0", "biz_1", "p1"), type: "payment.paid", providerRef: "sim" };
    await expect(uow.creator.appendLedgerGuarded(paid)).rejects.toBeTruthy();

    const auth: CreatorLedgerEvent = {
      ...ledgerBase("e1", "biz_1", "p1"),
      type: "payment.authorized",
      reason: "deliverable",
      gross: Money.parse("50.00", "USD").toJSON(),
      creatorNet: Money.parse("50.00", "USD").toJSON(),
      businessCost: Money.parse("51.50", "USD").toJSON(),
      feeSnapshot: { rateBps: 300, payer: "business", configVersion: 1, snapshotAt: now },
      authorizerUserId: "u_fin",
    };
    const fee: CreatorLedgerEvent = { ...ledgerBase("e2", "biz_1", "p1"), type: "platform_fee.recognized", fee: Money.parse("1.50", "USD").toJSON() };
    await uow.creator.appendLedgerGuarded(auth);
    await uow.creator.appendLedgerGuarded(fee);
    const stream = await uow.creator.ledgerForPayment(t("biz_1"), asId<CreatorPaymentId>("p1"));
    expect(stream.map((e) => e.type)).toEqual(["payment.authorized", "platform_fee.recognized"]);
  });
});

describe("CreatorRepository — durable snapshot", () => {
  it("survives serialize/deserialize with dates and money intact", () => {
    const uow = new UnitOfWork();
    uow.creator.createProfile(profile("creator_1", "user_1"));
    const payment: CreatorPayment = {
      id: asId<CreatorPaymentId>("p1"),
      tenantId: t("biz_1"),
      businessId: asId<BusinessId>("biz_1"),
      creatorId: asId<CreatorId>("creator_1"),
      submissionId: asId<SubmissionId>("sub_1"),
      reason: "deliverable",
      gross: Money.parse("50.00", "USD").toJSON(),
      status: "pending_approval",
      createdAt: now,
      updatedAt: now,
    };
    uow.creator.createPayment(payment);

    const json = serializeStore(uow.store);
    const restored = new UnitOfWork();
    deserializeStore(restored.store, json);

    const p = restored.creator.getProfile(asId<CreatorId>("creator_1"));
    expect(p?.createdAt).toBeInstanceOf(Date);
    const pay = restored.creator.getPayment(asId<CreatorPaymentId>("p1"));
    expect(pay && Money.fromJSON(pay.gross).toDecimalString()).toBe("50.00");
  });
});
