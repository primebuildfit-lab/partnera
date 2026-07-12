import {
  type AffiliateId,
  asId,
  type CommissionId,
  type ConversionId,
  type LedgerEventId,
  type OfferId,
  type OrderId,
  type ProgramId,
  type TenantId,
} from "@partnera/core";
import { type LedgerEvent } from "@partnera/commission-engine";
import { type OfferDefinition } from "@partnera/offer-engine";
import { type NormalizedOrder } from "@partnera/tracking-engine";
import { beforeEach, describe, expect, it } from "vitest";
import { UnitOfWork } from "../unit-of-work";

const t1 = asId<TenantId>("biz_1");
const t2 = asId<TenantId>("biz_2");
const aff = asId<AffiliateId>("aff_1");
const com = asId<CommissionId>("com_1");
const conv = asId<ConversionId>("conv_1");

let ev = 0;
const at = (ms: number): Date => new Date(Date.parse("2026-03-01T00:00:00Z") + ms);
const created = (tenantId = t1, commissionId = com): LedgerEvent => ({
  id: asId<LedgerEventId>(`le_${++ev}`),
  type: "commission.created",
  tenantId,
  affiliateId: aff,
  commissionId,
  occurredAt: at(ev),
  correlationId: "c",
  conversionId: conv,
  offerId: asId<OfferId>("offer_1"),
  offerVersion: 1,
  amount: { currency: "USD", minorUnits: "5000" },
  rewardKind: "cash",
  reasonPath: ["offer:offer_1@v1"],
});
const evt = (type: LedgerEvent["type"], extra: Record<string, unknown> = {}, commissionId = com): LedgerEvent =>
  ({
    id: asId<LedgerEventId>(`le_${++ev}`),
    type,
    tenantId: t1,
    affiliateId: aff,
    commissionId,
    occurredAt: at(ev),
    correlationId: "c",
    ...extra,
  }) as LedgerEvent;

describe("LedgerRepository — append-only money spine", () => {
  let uow: UnitOfWork;
  beforeEach(() => {
    uow = new UnitOfWork();
    ev = 0;
  });

  it("rejects a second commission.created (append-only guard)", async () => {
    await uow.ledger.appendGuarded(created());
    await expect(uow.ledger.appendGuarded(created())).rejects.toThrow();
  });

  it("rejects an illegal transition (pay before approve)", async () => {
    await uow.ledger.appendGuarded(created());
    await expect(
      uow.ledger.appendGuarded(evt("commission.paid", { payoutId: asId("payout_1") })),
    ).rejects.toThrow(/Illegal transition/);
  });

  it("is idempotent on repeated append by event id", async () => {
    const e = created();
    await uow.ledger.append(e);
    await uow.ledger.append(e);
    const events = await uow.ledger.readByCommission(t1, com);
    expect(events).toHaveLength(1);
  });

  it("derives balances across the lifecycle", async () => {
    await uow.ledger.appendGuarded(created());
    let bal = await uow.ledger.balancesForAffiliate(t1, aff);
    expect(bal[0]!.pending.toDecimalString()).toBe("50.00");

    await uow.ledger.appendGuarded(evt("commission.approved"));
    bal = await uow.ledger.balancesForAffiliate(t1, aff);
    expect(bal[0]!.available.toDecimalString()).toBe("50.00");
    expect(bal[0]!.pending.toDecimalString()).toBe("0.00");

    await uow.ledger.appendGuarded(evt("commission.paid", { payoutId: asId("payout_1") }));
    bal = await uow.ledger.balancesForAffiliate(t1, aff);
    expect(bal[0]!.paid.toDecimalString()).toBe("50.00");
  });

  it("isolates reads by tenant", async () => {
    await uow.ledger.appendGuarded(created(t1));
    expect(await uow.ledger.readByCommission(t2, com)).toHaveLength(0);
    expect(await uow.ledger.readByCommission(t1, com)).toHaveLength(1);
  });

  it("finds commissions produced by a conversion (for clawback)", async () => {
    await uow.ledger.appendGuarded(created());
    expect(await uow.ledger.commissionsForConversion(t1, conv)).toEqual([com]);
    expect(await uow.ledger.commissionsForConversion(t2, conv)).toEqual([]);
  });
});

const baseDefinition = (id: OfferId): OfferDefinition => ({
  id,
  tenantId: t1,
  programId: asId<ProgramId>("prog_1"),
  version: 1,
  name: "Ten percent",
  status: "draft",
  scope: [{ kind: "all" }],
  conditions: [],
  calculation: { kind: "percentage", basisPoints: 1000 },
  reward: { kind: "cash" },
  schedule: { kind: "always" },
  limits: [],
  stackingPriority: 0,
});

describe("OfferRepository — versioning", () => {
  let uow: UnitOfWork;
  beforeEach(() => {
    uow = new UnitOfWork();
  });

  it("never overwrites an existing version; edits append", () => {
    const id = asId<OfferId>("offer_1");
    uow.offers.createOffer({
      id,
      tenantId: t1,
      programId: asId<ProgramId>("prog_1"),
      name: "v1",
      definition: baseDefinition(id),
      stackingPriority: 0,
      now: at(0),
    });
    const edited: OfferDefinition = {
      ...baseDefinition(id),
      calculation: { kind: "percentage", basisPoints: 2000 },
    };
    uow.offers.addVersion(t1, id, edited, at(1));

    // v1 body is unchanged (immutable); v2 carries the edit.
    expect(uow.offers.getVersion(t1, id, 1)!.definition.calculation).toEqual({
      kind: "percentage",
      basisPoints: 1000,
    });
    expect(uow.offers.getVersion(t1, id, 2)!.definition.calculation).toEqual({
      kind: "percentage",
      basisPoints: 2000,
    });
  });

  it("activates a version by pointer and exposes it as active", () => {
    const id = asId<OfferId>("offer_1");
    uow.offers.createOffer({
      id,
      tenantId: t1,
      programId: asId<ProgramId>("prog_1"),
      name: "v1",
      definition: baseDefinition(id),
      stackingPriority: 0,
      now: at(0),
    });
    uow.offers.addVersion(t1, id, baseDefinition(id), at(1));
    uow.offers.activate(t1, id, 2, at(2));
    const active = uow.offers.getActiveDefinition(t1, id)!;
    expect(active.version).toBe(2);
    expect(active.status).toBe("active");
  });

  it("refuses to activate a non-existent version", () => {
    const id = asId<OfferId>("offer_1");
    uow.offers.createOffer({
      id,
      tenantId: t1,
      programId: asId<ProgramId>("prog_1"),
      name: "v1",
      definition: baseDefinition(id),
      stackingPriority: 0,
      now: at(0),
    });
    expect(() => uow.offers.activate(t1, id, 9, at(2))).toThrow();
  });

  it("isolates offers by tenant", () => {
    const id = asId<OfferId>("offer_1");
    uow.offers.createOffer({
      id,
      tenantId: t1,
      programId: asId<ProgramId>("prog_1"),
      name: "v1",
      definition: baseDefinition(id),
      stackingPriority: 0,
      now: at(0),
    });
    expect(uow.offers.getOffer(t2, id)).toBeNull();
    expect(uow.offers.getOffer(t1, id)).not.toBeNull();
  });
});

describe("TrackingRepository — replay safety", () => {
  let uow: UnitOfWork;
  beforeEach(() => {
    uow = new UnitOfWork();
  });

  const order = (id: string): NormalizedOrder => ({
    id: asId<OrderId>(id),
    tenantId: t1,
    platformOrderId: "shopify_1",
    totalMinorUnits: "10000",
    currency: "USD",
    customerType: "new",
    couponCodes: [],
    sessionToken: null,
    placedAt: at(0),
  });

  it("dedupes orders by (tenant, platformOrderId)", () => {
    const a = uow.tracking.ingestOrder(order("order_1"));
    const b = uow.tracking.ingestOrder(order("order_2"));
    expect(a.created).toBe(true);
    expect(b.created).toBe(false);
    expect(b.order.id).toBe(a.order.id);
  });
});
