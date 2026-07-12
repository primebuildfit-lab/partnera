import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalWorld } from "./localWorld";

/**
 * Verifies durable local persistence + recovery after restart: a first run seeds
 * and writes a data file; a second run over the same file loads instead of
 * reseeding, and data created in between survives.
 */
describe("local persistence", () => {
  let dir: string;
  let dataFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "partnera-"));
    dataFile = join(dir, "data.json");
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("seeds on first run and writes the data file", async () => {
    const local = await createLocalWorld(dataFile);
    expect(local.firstRun).toBe(true);
    expect(existsSync(dataFile)).toBe(true);
    const offers = local.world.services.query.offers(ownerRequest(local));
    expect(offers.length).toBeGreaterThan(0);
  });

  it("loads existing data on the next run (no reseed) and preserves changes", async () => {
    // First run seeds.
    const first = await createLocalWorld(dataFile);
    const owner = ownerRequest(first);
    const before = first.world.services.query.offers(owner).length;

    // Create a new offer and persist.
    first.world.services.offers.createOffer(owner, {
      programId: "prog_pb_main" as never,
      name: "Persisted Offer",
      scope: [{ kind: "all" }],
      conditions: [],
      calculation: { kind: "percentage", basisPoints: 1000 },
      reward: { kind: "cash" },
      schedule: { kind: "always" },
      limits: [],
    });
    first.save();

    // Second run loads from disk.
    const second = await createLocalWorld(dataFile);
    expect(second.firstRun).toBe(false);
    const owner2 = ownerRequest(second);
    const offers2 = second.world.services.query.offers(owner2);
    expect(offers2.length).toBe(before + 1);
    expect(offers2.some((o) => o.name === "Persisted Offer")).toBe(true);

    // The money spine survived too.
    const balances = await second.world.services.query.tenantBalances(owner2);
    expect(balances.some((b) => b.paid.toDecimalString() === "50.00")).toBe(true);
  });
});

function ownerRequest(local: Awaited<ReturnType<typeof createLocalWorld>>) {
  const user = local.world.uow.identity.getUserByEmail(local.world.users.owner)!;
  return { tenantId: local.world.tenantId, actorUserId: user.id, isPlatformOperator: false, requestId: "t" };
}
