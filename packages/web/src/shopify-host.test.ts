import { createHmac } from "node:crypto";
import { FakeSessionTokenVerifier, FakeShopifyApi } from "@partnera/shopify";
import { describe, expect, it } from "vitest";
import { createDemoWorld } from "./demo";
import {
  beginInstall,
  handleCallback,
  handleWebhook,
  renderEmbeddedApp,
  resolveEmbeddedContext,
  type ShopifyHostConfig,
} from "./shopify-host";

const cfg: ShopifyHostConfig = {
  apiKey: "test_api_key",
  apiSecret: "test_api_secret",
  appUrl: "https://staging.partnera.test",
  redirectUri: "https://staging.partnera.test/api/auth/callback",
};

function oauthQuery(shop: string, state: string): Record<string, string> {
  const q: Record<string, string> = { code: "authcode123", shop, state, timestamp: "1700000000" };
  const message = Object.keys(q).sort().map((k) => `${k}=${q[k]}`).join("&");
  q.hmac = createHmac("sha256", cfg.apiSecret).update(message).digest("hex");
  return q;
}
function webhookHeaders(rawBody: string, topic: string, shop: string, id: string): Record<string, string> {
  return {
    "x-shopify-hmac-sha256": createHmac("sha256", cfg.apiSecret).update(rawBody).digest("base64"),
    "x-shopify-topic": topic,
    "x-shopify-shop-domain": shop,
    "x-shopify-webhook-id": id,
  };
}

describe("Block 3 — OAuth begin + callback", () => {
  it("begins an install with a valid shop and a state nonce", () => {
    const r = beginInstall(cfg, "acme.myshopify.com");
    expect(r.ok).toBe(true);
    expect(r.ok && r.value.redirectUrl).toContain("acme.myshopify.com/admin/oauth/authorize");
    expect(r.ok && r.value.state.length).toBeGreaterThan(10);
    expect(beginInstall(cfg, "evil.com").ok).toBe(false);
  });

  it("valid callback provisions a tenant (idempotent) and redirects to the embedded app", async () => {
    const world = await createDemoWorld();
    const api = new FakeShopifyApi();
    const state = "abc123state";
    const res = await handleCallback(cfg, world.services, api, oauthQuery("acme.myshopify.com", state), state);
    expect(res.ok).toBe(true);
    const first = res.ok ? res.value.tenantId : "";
    expect(res.ok && res.value.redirectTo).toContain("/shopify/app?shop=acme.myshopify.com");
    expect(api.registered.length).toBe(1); // webhooks registered
    // Re-install same shop → same tenant.
    const res2 = await handleCallback(cfg, world.services, api, oauthQuery("acme.myshopify.com", state), state);
    expect(res2.ok && res2.value.tenantId).toBe(first);
    expect(world.services.installation.listInstallations().filter((i) => i.shop === "acme.myshopify.com")).toHaveLength(1);
  });

  it("rejects a forged HMAC and a bad state", async () => {
    const world = await createDemoWorld();
    const api = new FakeShopifyApi();
    const q = oauthQuery("acme.myshopify.com", "s1");
    const badHmac = await handleCallback(cfg, world.services, api, { ...q, hmac: "deadbeef" }, "s1");
    expect(badHmac.ok).toBe(false);
    expect(!badHmac.ok && badHmac.status).toBe(401);
    const badState = await handleCallback(cfg, world.services, api, q, "different-state");
    expect(!badState.ok && badState.status).toBe(403);
  });
});

describe("Block 4 — webhooks (HMAC + idempotency + uninstall)", () => {
  it("processes a valid webhook once and dedupes retries", async () => {
    const world = await createDemoWorld();
    const body = JSON.stringify({ id: 1 });
    const h = webhookHeaders(body, "orders/create", "acme.myshopify.com", "wh_1");
    const first = await handleWebhook(cfg, world.services, body, h);
    expect(first.status).toBe(200);
    const retry = await handleWebhook(cfg, world.services, body, h);
    expect(retry.body).toBe("duplicate");
  });

  it("rejects a forged webhook HMAC", async () => {
    const world = await createDemoWorld();
    const body = JSON.stringify({ id: 1 });
    const h = { ...webhookHeaders(body, "orders/create", "acme.myshopify.com", "wh_2"), "x-shopify-hmac-sha256": "AAAA" };
    const res = await handleWebhook(cfg, world.services, body, h);
    expect(res.status).toBe(401);
  });

  it("app/uninstalled marks the installation uninstalled", async () => {
    const world = await createDemoWorld();
    const api = new FakeShopifyApi();
    await handleCallback(cfg, world.services, api, oauthQuery("acme.myshopify.com", "s"), "s");
    const shop = "acme.myshopify.com";
    const body = "{}";
    await handleWebhook(cfg, world.services, body, webhookHeaders(body, "app/uninstalled", shop, "wh_u"));
    // resolveTenant returns null after uninstall.
    const tenant = world.services.installation.resolveRequestContext(shop as never, "r");
    expect(tenant).toBeNull();
  });
});

describe("Block 5 — session token → RequestContext (never trust the browser)", () => {
  it("valid token resolves shop+tenant; invalid/expired/uninstalled are rejected", async () => {
    const world = await createDemoWorld();
    const api = new FakeShopifyApi();
    await handleCallback(cfg, world.services, api, oauthQuery("acme.myshopify.com", "s"), "s");
    const verifier = new FakeSessionTokenVerifier();
    const now = 1000;
    const good = `dest.acme.myshopify.com|sub.user_1|exp.${now + 100}`;
    const ok = resolveEmbeddedContext(world.services, verifier, good, now, "r1");
    expect(ok.ok).toBe(true);
    expect(ok.ok && String(ok.ctx.tenantId).length).toBeGreaterThan(0);
    // expired
    const expired = resolveEmbeddedContext(world.services, verifier, `dest.acme.myshopify.com|sub.u|exp.${now - 1}`, now, "r2");
    expect(!expired.ok && expired.status).toBe(401);
    // shop that never installed
    const unknown = resolveEmbeddedContext(world.services, verifier, `dest.other.myshopify.com|sub.u|exp.${now + 100}`, now, "r3");
    expect(!unknown.ok && unknown.status).toBe(403);
  });
});

describe("Block 6 — minimal embedded app", () => {
  it("renders shop, tenant and status", async () => {
    const world = await createDemoWorld();
    const api = new FakeShopifyApi();
    await handleCallback(cfg, world.services, api, oauthQuery("acme.myshopify.com", "s"), "s");
    const ctx = world.services.installation.resolveRequestContext("acme.myshopify.com" as never, "r")!;
    const html = renderEmbeddedApp(cfg, world.services, ctx, "acme.myshopify.com");
    expect(html).toContain("acme.myshopify.com");
    expect(html).toContain("Partnera");
    expect(html).toContain("shopify-api-key");
    expect(html).not.toContain("fake_offline_token"); // no token leaked to the page
  });
});
