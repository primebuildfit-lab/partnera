import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeShopDomain, shopName } from "./shop";
import { verifyAppProxySignature, verifyOAuthHmac, verifyWebhookHmac } from "./hmac";
import { missingRequiredScopes, scopesSatisfied } from "./scopes";
import { LOCAL_CONFIG, validateEnvironment } from "./env";
import { canTransitionInstall, transitionInstall } from "./install";
import { WEBHOOK_MAX_ATTEMPTS, isComplianceTopic, isKnownTopic, webhookIdempotencyKey } from "./webhooks";
import { applicableSteps, canActivate, onboardingProgress, type OnboardingState } from "./onboarding";

describe("shop domain normalization", () => {
  it("accepts and normalizes a valid shop, rejecting anything else", () => {
    const r = normalizeShopDomain("HTTPS://PrimeBuild.myshopify.com/admin");
    expect(r.ok && r.value).toBe("primebuild.myshopify.com");
    expect(shopName(r.ok ? r.value : ("" as never))).toBe("primebuild");
    for (const bad of ["evil.com", "primebuild.myshopify.com.evil.com", "not a shop", "primebuild.shopify.com"]) {
      expect(normalizeShopDomain(bad).ok).toBe(false);
    }
  });
});

describe("HMAC verification (secret-injected, constant-time)", () => {
  const secret = "shpss_test_secret";

  it("verifies a genuine webhook HMAC and rejects a forged one", () => {
    const body = JSON.stringify({ id: 123, topic: "orders/create" });
    const good = createHmac("sha256", secret).update(body).digest("base64");
    expect(verifyWebhookHmac(secret, body, good)).toBe(true);
    expect(verifyWebhookHmac(secret, body, "AAAA")).toBe(false);
    expect(verifyWebhookHmac(secret, body + "x", good)).toBe(false);
    expect(verifyWebhookHmac("wrong", body, good)).toBe(false);
  });

  it("verifies an app-proxy signature over sorted params", () => {
    const query: Record<string, string> = { shop: "primebuild.myshopify.com", path_prefix: "/apps/partnera", timestamp: "1700000000" };
    const message = Object.keys(query).sort().map((k) => `${k}=${query[k]}`).join("");
    const sig = createHmac("sha256", secret).update(message).digest("hex");
    expect(verifyAppProxySignature(secret, { ...query, signature: sig })).toBe(true);
    expect(verifyAppProxySignature(secret, { ...query, signature: "deadbeef" })).toBe(false);
  });

  it("verifies an OAuth callback HMAC", () => {
    const query: Record<string, string> = { code: "abc", shop: "primebuild.myshopify.com", timestamp: "1700000000" };
    const message = Object.keys(query).sort().map((k) => `${k}=${query[k]}`).join("&");
    const hmac = createHmac("sha256", secret).update(message).digest("hex");
    expect(verifyOAuthHmac(secret, { ...query, hmac })).toBe(true);
    expect(verifyOAuthHmac(secret, { ...query, hmac: "00" })).toBe(false);
  });
});

describe("scopes (least privilege)", () => {
  it("detects missing required scopes and satisfaction", () => {
    expect(scopesSatisfied("read_products,read_orders,read_customers")).toBe(true);
    expect(missingRequiredScopes("read_products")).toContain("read_orders");
    expect(scopesSatisfied("read_all")).toBe(false);
  });
});

describe("environment validation (refuses unsafe/mixed config)", () => {
  it("accepts the safe local default", () => {
    expect(validateEnvironment(LOCAL_CONFIG).ok).toBe(true);
  });
  it("rejects local with real money, and production on file storage", () => {
    expect(validateEnvironment({ ...LOCAL_CONFIG, realPayments: true }).ok).toBe(false);
    expect(validateEnvironment({ mode: "production", persistence: "file", realPayments: true, realAi: true, realBilling: true, shopifyConfigured: true }).ok).toBe(false);
  });
  it("requires staging to keep money simulated on a hosted DB", () => {
    expect(validateEnvironment({ mode: "staging", persistence: "database", realPayments: false, realAi: false, realBilling: false, shopifyConfigured: true }).ok).toBe(true);
    expect(validateEnvironment({ mode: "staging", persistence: "file", realPayments: false, realAi: false, realBilling: false, shopifyConfigured: true }).ok).toBe(false);
  });
});

describe("install lifecycle", () => {
  it("allows install→uninstall→reinstall, rejects illegal jumps", () => {
    expect(canTransitionInstall("pending", "installed")).toBe(true);
    expect(canTransitionInstall("installed", "uninstalled")).toBe(true);
    expect(canTransitionInstall("uninstalled", "reinstalled")).toBe(true);
    expect(transitionInstall("pending", "reinstalled").ok).toBe(false);
  });
});

describe("webhooks (idempotent, dead-letter)", () => {
  it("builds a stable idempotency key and flags compliance topics", () => {
    expect(webhookIdempotencyKey("primebuild.myshopify.com" as never, "orders/create", "wh_1")).toBe("primebuild.myshopify.com::orders/create::wh_1");
    expect(isComplianceTopic("shop/redact")).toBe(true);
    expect(isComplianceTopic("orders/create")).toBe(false);
    expect(isKnownTopic("orders/create")).toBe(true);
    expect(isKnownTopic("orders/nope")).toBe(false);
    expect(WEBHOOK_MAX_ATTEMPTS).toBeGreaterThan(0);
  });
});

describe("onboarding", () => {
  const base: OnboardingState = { id: "ob_1" as never, tenantId: "biz_1" as never, businessId: "biz_1" as never, purpose: "both", completed: {}, activated: false, updatedAt: new Date() };

  it("scopes applicable steps to the chosen purpose", () => {
    expect(applicableSteps("affiliate")).not.toContain("evaluation_categories");
    expect(applicableSteps("both")).toContain("evaluation_categories");
  });
  it("blocks activation until applicable steps are complete", () => {
    expect(canActivate(base).ok).toBe(false);
    const done: Record<string, boolean> = {};
    for (const s of applicableSteps("both")) done[s] = true;
    expect(canActivate({ ...base, completed: done }).ok).toBe(true);
    expect(onboardingProgress({ ...base, completed: done })).toBe(1);
  });
  it("requires a purpose before activation", () => {
    expect(canActivate({ ...base, purpose: null }).ok).toBe(false);
  });
});
