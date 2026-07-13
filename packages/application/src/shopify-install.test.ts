import { asId, FixedClock, InMemoryEventBus, type TenantId } from "@partnera/core";
import { UnitOfWork } from "@partnera/persistence";
import { normalizeShopDomain, type ShopDomain } from "@partnera/shopify";
import { SequentialIdGenerator } from "@partnera/testing";
import { describe, expect, it } from "vitest";
import { createServices } from "./services";

function setup() {
  const uow = new UnitOfWork();
  const clock = new FixedClock("2026-07-13T00:00:00.000Z");
  const services = createServices({ uow, clock, ids: new SequentialIdGenerator(), events: new InMemoryEventBus() });
  return { uow, services, clock };
}
const shop = (s: string): ShopDomain => {
  const r = normalizeShopDomain(s);
  if (!r.ok) throw r.error;
  return r.value;
};

describe("Shopify install → tenant provisioning (idempotent, isolated)", () => {
  it("creates a tenant with an owner membership on first install", () => {
    const h = setup();
    const t = h.services.installation.installOrResolve({ shop: shop("primebuild.myshopify.com"), scopes: "read_orders", tokenRef: "tok_ref_1", ownerEmail: "brian@primebuild.test", ownerName: "Brian" });
    expect(h.uow.identity.getBusiness(t.businessId)).toBeTruthy();
    const owner = h.uow.identity.getUserByEmail("brian@primebuild.test")!;
    const roles = h.uow.identity.resolveRoles(owner.id, t.tenantId);
    expect(roles.some((r) => r.key === "business_owner")).toBe(true);
    // Onboarding + storage default provisioned.
    expect(h.services.onboarding.get(t.tenantId)).toBeTruthy();
  });

  it("is idempotent: installing the same shop twice resolves to the same tenant", () => {
    const h = setup();
    const a = h.services.installation.installOrResolve({ shop: shop("primebuild.myshopify.com"), scopes: "read_orders", tokenRef: "t1", ownerEmail: "brian@primebuild.test", ownerName: "Brian" });
    const b = h.services.installation.installOrResolve({ shop: shop("primebuild.myshopify.com"), scopes: "read_orders,read_products", tokenRef: "t2", ownerEmail: "brian@primebuild.test", ownerName: "Brian" });
    expect(b.businessId).toBe(a.businessId);
    expect(h.services.installation.listInstallations()).toHaveLength(1);
  });

  it("keeps two shops fully isolated (distinct tenants, no cross-shop resolution)", () => {
    const h = setup();
    const a = h.services.installation.installOrResolve({ shop: shop("shop-a.myshopify.com"), scopes: "read_orders", tokenRef: "ta", ownerEmail: "a@a.com", ownerName: "A" });
    const b = h.services.installation.installOrResolve({ shop: shop("shop-b.myshopify.com"), scopes: "read_orders", tokenRef: "tb", ownerEmail: "b@b.com", ownerName: "B" });
    expect(a.tenantId).not.toBe(b.tenantId);
    expect(h.services.installation.resolveTenant(shop("shop-a.myshopify.com"))!.tenantId).toBe(a.tenantId);
    expect(h.services.installation.resolveTenant(shop("shop-b.myshopify.com"))!.tenantId).toBe(b.tenantId);
  });

  it("uninstall then reinstall recovers the same tenant (data retained)", () => {
    const h = setup();
    const s = shop("primebuild.myshopify.com");
    const a = h.services.installation.installOrResolve({ shop: s, scopes: "read_orders", tokenRef: "t1", ownerEmail: "brian@primebuild.test", ownerName: "Brian" });
    h.services.installation.uninstall(s);
    expect(h.services.installation.resolveTenant(s)).toBeNull();
    const b = h.services.installation.installOrResolve({ shop: s, scopes: "read_orders", tokenRef: "t3", ownerEmail: "brian@primebuild.test", ownerName: "Brian" });
    expect(b.tenantId).toBe(a.tenantId);
    expect(h.services.installation.resolveTenant(s)!.tenantId).toBe(a.tenantId);
  });
});

describe("Shopify webhooks (idempotent, dead-letter)", () => {
  it("dedupes retried deliveries by (shop, topic, webhookId)", () => {
    const h = setup();
    const s = shop("primebuild.myshopify.com");
    const first = h.services.webhooks.record(s, "orders/create", "wh_1");
    const retry = h.services.webhooks.record(s, "orders/create", "wh_1");
    expect(first.isNew).toBe(true);
    expect(retry.isNew).toBe(false);
    expect(retry.event.id).toBe(first.event.id);
  });

  it("parks a webhook in dead-letter after repeated failures", () => {
    const h = setup();
    const s = shop("primebuild.myshopify.com");
    const { event } = h.services.webhooks.record(s, "orders/paid", "wh_x");
    for (let i = 0; i < 5; i++) h.services.webhooks.markFailed(event.id, "boom");
    expect(h.services.webhooks.deadLetterCount()).toBe(1);
  });
});

describe("onboarding (persisted, purpose-scoped)", () => {
  it("blocks activation until applicable steps complete", () => {
    const h = setup();
    const t = h.services.installation.installOrResolve({ shop: shop("primebuild.myshopify.com"), scopes: "read_orders", tokenRef: "t1", ownerEmail: "brian@primebuild.test", ownerName: "Brian" });
    h.services.onboarding.setPurpose(t.tenantId, "affiliate");
    expect(() => h.services.onboarding.activate(t.tenantId)).toThrow();
    for (const step of h.services.onboarding.applicableSteps(t.tenantId)) {
      if (step !== "review_activate") h.services.onboarding.completeStep(t.tenantId, step);
    }
    const activated = h.services.onboarding.activate(t.tenantId);
    expect(activated.activated).toBe(true);
  });
});

describe("no browser-trusted tenant", () => {
  it("a shop that never installed resolves to no tenant", () => {
    const h = setup();
    expect(h.services.installation.resolveTenant(shop("evil-unknown.myshopify.com"))).toBeNull();
    void asId<TenantId>("x"); // (type import sanity)
  });
});
