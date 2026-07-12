import {
  asId,
  type AffiliateId,
  type CommissionId,
  type ConversionId,
  type LedgerEventId,
  type OfferId,
  type ProgramId,
  type TenantId,
} from "@partnera/core";
import { type LedgerEvent } from "@partnera/commission-engine";
import { type OfferDefinition } from "@partnera/offer-engine";
import { describe, expect, it } from "vitest";
import { UnitOfWork } from "./unit-of-work";
import { deserializeStore, serializeStore } from "./snapshot";

const t = asId<TenantId>("biz_1");
const aff = asId<AffiliateId>("aff_1");
const com = asId<CommissionId>("com_1");

function seed(uow: UnitOfWork): Promise<void> {
  const offerId = asId<OfferId>("offer_1");
  const def: OfferDefinition = {
    id: offerId,
    tenantId: t,
    programId: asId<ProgramId>("prog_1"),
    version: 1,
    name: "10%",
    status: "draft",
    scope: [{ kind: "all" }],
    conditions: [],
    calculation: { kind: "percentage", basisPoints: 1000 },
    reward: { kind: "cash" },
    schedule: { kind: "always" },
    limits: [],
    stackingPriority: 0,
  };
  uow.offers.createOffer({
    id: offerId,
    tenantId: t,
    programId: asId<ProgramId>("prog_1"),
    name: "10%",
    definition: def,
    stackingPriority: 0,
    now: new Date("2026-06-01T00:00:00Z"),
  });
  const created: LedgerEvent = {
    id: asId<LedgerEventId>("le_1"),
    type: "commission.created",
    tenantId: t,
    affiliateId: aff,
    commissionId: com,
    occurredAt: new Date("2026-06-01T01:00:00Z"),
    correlationId: "c",
    conversionId: asId<ConversionId>("conv_1"),
    offerId,
    offerVersion: 1,
    amount: { currency: "USD", minorUnits: "5000" },
    rewardKind: "cash",
    reasonPath: ["offer:offer_1@v1"],
  };
  const approved: LedgerEvent = {
    id: asId<LedgerEventId>("le_2"),
    type: "commission.approved",
    tenantId: t,
    affiliateId: aff,
    commissionId: com,
    occurredAt: new Date("2026-06-02T00:00:00Z"),
    correlationId: "c",
  };
  return (async () => {
    await uow.ledger.appendGuarded(created);
    await uow.ledger.appendGuarded(approved);
  })();
}

describe("store snapshot round-trip", () => {
  it("preserves data (and Date types) across serialize/deserialize", async () => {
    const source = new UnitOfWork();
    await seed(source);
    const json = serializeStore(source.store);

    const restored = new UnitOfWork();
    deserializeStore(restored.store, json);

    // Balances fold correctly from restored ledger events (Dates must be real Dates).
    const balances = await restored.ledger.tenantBalances(t);
    expect(balances[0]!.available.toDecimalString()).toBe("50.00");

    // The offer and its immutable version survived.
    const offer = restored.offers.getOffer(t, asId<OfferId>("offer_1"));
    expect(offer!.name).toBe("10%");
    const version = restored.offers.getVersion(t, asId<OfferId>("offer_1"), 1);
    expect(version!.createdAt instanceof Date).toBe(true);

    // A restored ledger event keeps its Date type.
    const events = await restored.ledger.readByCommission(t, com);
    expect(events[0]!.occurredAt instanceof Date).toBe(true);
  });

  it("append-only tables remain append-only after restore", async () => {
    const source = new UnitOfWork();
    await seed(source);
    const restored = new UnitOfWork();
    deserializeStore(restored.store, serializeStore(source.store));
    // A duplicate commission.created must still be rejected on the restored store.
    await expect(
      restored.ledger.appendGuarded({
        id: asId<LedgerEventId>("le_dup"),
        type: "commission.created",
        tenantId: t,
        affiliateId: aff,
        commissionId: com,
        occurredAt: new Date(),
        correlationId: "c",
        conversionId: asId<ConversionId>("conv_1"),
        offerId: asId<OfferId>("offer_1"),
        offerVersion: 1,
        amount: { currency: "USD", minorUnits: "1" },
        rewardKind: "cash",
        reasonPath: [],
      }),
    ).rejects.toThrow();
  });
});
