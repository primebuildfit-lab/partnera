import { type RequestContext } from "@partnera/core";
import { type Services } from "@partnera/application";
import {
  type ShopifyApiPort,
  type SessionTokenVerifier,
  type WebhookTopic,
  buildInstallUrl,
  isKnownTopic,
  newOAuthState,
  normalizeShopDomain,
  parseCallback,
  REQUIRED_SCOPES,
  verifyOAuthHmac,
  verifyState,
  verifyWebhookHmac,
} from "@partnera/shopify";

/**
 * Shopify delivery handlers (Blocks 3–7), as pure functions over the application
 * services + injected ports, so they are fully testable with fakes and no
 * network. The productive host (`server.ts`) wires HTTP requests to these. The
 * tenant is ALWAYS derived from a verified shop (HMAC / session token), never
 * from browser input; secrets/tokens never reach a browser or a log.
 */
export interface ShopifyHostConfig {
  readonly apiKey: string;
  readonly apiSecret: string;
  readonly appUrl: string;
  readonly redirectUri: string;
}

// --- Block 3: OAuth begin ---
export interface BeginResult {
  readonly redirectUrl: string;
  readonly state: string; // host stores this in a signed cookie
}
export function beginInstall(cfg: ShopifyHostConfig, shopRaw: string): { ok: true; value: BeginResult } | { ok: false; error: string } {
  const shop = normalizeShopDomain(shopRaw);
  if (!shop.ok) return { ok: false, error: "invalid shop" };
  const state = newOAuthState();
  return {
    ok: true,
    value: { redirectUrl: buildInstallUrl({ shop: shop.value, apiKey: cfg.apiKey, redirectUri: cfg.redirectUri, state, scopes: REQUIRED_SCOPES }), state },
  };
}

// --- Block 3: OAuth callback -> token exchange -> tenant provisioning ---
export interface CallbackResult {
  readonly tenantId: string;
  readonly shop: string;
  readonly redirectTo: string; // embedded app entry
}
export async function handleCallback(
  cfg: ShopifyHostConfig,
  services: Services,
  api: ShopifyApiPort,
  query: Readonly<Record<string, string | undefined>>,
  expectedState: string | undefined,
): Promise<{ ok: true; value: CallbackResult } | { ok: false; status: number; error: string }> {
  // 1) HMAC (integrity) — reject forged callbacks before anything else.
  if (!verifyOAuthHmac(cfg.apiSecret, query as Record<string, string>)) {
    return { ok: false, status: 401, error: "invalid hmac" };
  }
  // 2) Shape + shop normalization.
  const parsed = parseCallback(query);
  if (!parsed.ok) return { ok: false, status: 400, error: parsed.error.message };
  // 3) CSRF state (constant-time).
  if (!verifyState(expectedState ?? "", parsed.value.state)) {
    return { ok: false, status: 403, error: "invalid state" };
  }
  // 4) Exchange code for an offline token (network boundary; token stays server-side).
  const token = await api.exchangeToken(parsed.value.shop, parsed.value.code);
  const info = await api.getShopInfo(parsed.value.shop, token.accessToken);
  // 5) Idempotent tenant provisioning; the raw token is referenced, never stored plain.
  const resolved = services.installation.installOrResolve({
    shop: parsed.value.shop,
    scopes: token.scope,
    tokenRef: `vault:${parsed.value.shop}`, // deploy stores the encrypted token by this ref
    ownerEmail: info.email ?? `owner@${info.name}.pilot`,
    ownerName: info.name,
  });
  // 6) Register the webhooks we need (idempotent on Shopify's side).
  await api.registerWebhooks(parsed.value.shop, token.accessToken, REQUIRED_WEBHOOKS);
  return { ok: true, value: { tenantId: resolved.tenantId, shop: parsed.value.shop, redirectTo: `${cfg.appUrl}/shopify/app?shop=${parsed.value.shop}` } };
}

// --- Block 4: webhooks ---
export const REQUIRED_WEBHOOKS: readonly WebhookTopic[] = [
  "app/uninstalled",
  "customers/data_request",
  "customers/redact",
  "shop/redact",
  "orders/create",
  "refunds/create",
];

export async function handleWebhook(
  cfg: ShopifyHostConfig,
  services: Services,
  rawBody: string,
  headers: Readonly<Record<string, string | undefined>>,
): Promise<{ status: number; body: string }> {
  const hmac = headers["x-shopify-hmac-sha256"];
  if (!hmac || !verifyWebhookHmac(cfg.apiSecret, rawBody, hmac)) {
    return { status: 401, body: "invalid hmac" };
  }
  const topic = headers["x-shopify-topic"] ?? "";
  const shopRaw = headers["x-shopify-shop-domain"] ?? "";
  const webhookId = headers["x-shopify-webhook-id"] ?? "";
  const shop = normalizeShopDomain(shopRaw);
  if (!isKnownTopic(topic) || !shop.ok || !webhookId) {
    return { status: 202, body: "ignored" }; // ack unknown/unsupported to avoid retries storms
  }
  const { isNew, event } = services.webhooks.record(shop.value, topic, webhookId);
  if (!isNew) return { status: 200, body: "duplicate" }; // idempotent: already processed
  try {
    // Dispatch. Only a few topics have effects in the pilot; the rest are recorded.
    if (topic === "app/uninstalled") services.installation.uninstall(shop.value);
    // (orders/refunds → attribution jobs; customers/*,shop/redact → compliance — recorded, handled by jobs later)
    services.webhooks.markProcessed(event.id);
    return { status: 200, body: "ok" };
  } catch (e) {
    services.webhooks.markFailed(event.id, e instanceof Error ? e.message : "error");
    return { status: 500, body: "processing error" };
  }
}

// --- Block 6: minimal embedded app (proves the install works inside Shopify Admin) ---
export function renderEmbeddedApp(cfg: ShopifyHostConfig, services: Services, ctx: RequestContext, shop: string): string {
  const onboarding = services.onboarding.get(ctx.tenantId);
  const programs = safe(() => services.creator.listPrograms(ctx).length, 0);
  const reviews = safe(() => services.creator.reviewQueue(ctx).length, 0);
  const activated = onboarding?.activated ? "Active" : "Onboarding in progress";
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c);
  // App Bridge is loaded from Shopify's CDN in the real embedded context; the host
  // must pass ?host= and the API key. Kept minimal on purpose (Block 6).
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="shopify-api-key" content="${esc(cfg.apiKey)}"/>
<title>Partnera</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f6f6f7;color:#202223}
.wrap{max-width:820px;margin:0 auto;padding:24px}.card{background:#fff;border:1px solid #e1e3e5;border-radius:12px;padding:20px;margin:16px 0}
h1{font-size:20px;margin:0 0 4px}dt{color:#6d7175;font-size:13px}dd{margin:0 0 10px;font-weight:600}</style></head>
<body><div class="wrap">
<h1>Partnera</h1><p style="color:#6d7175">Creator &amp; affiliate programs for your store.</p>
<div class="card"><dl>
<dt>Store</dt><dd>${esc(shop)}</dd>
<dt>Tenant</dt><dd>${esc(String(ctx.tenantId))}</dd>
<dt>Status</dt><dd>${esc(activated)}</dd>
<dt>Creator programs</dt><dd>${programs}</dd>
<dt>Submissions awaiting review</dt><dd>${reviews}</dd>
</dl></div>
<div class="card"><strong>Dashboard</strong><p style="color:#6d7175">Open the full dashboard to manage opportunities, reviews, payments (simulated) and your content library.</p>
<a href="/business/creators">Open creator dashboard →</a></div>
</div></body></html>`;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// --- Block 5: session token -> RequestContext ---
export function resolveEmbeddedContext(
  services: Services,
  verifier: SessionTokenVerifier,
  token: string,
  nowEpochSec: number,
  requestId: string,
): { ok: true; ctx: RequestContext; shop: string } | { ok: false; status: number; error: string } {
  const claims = verifier.verify(token, nowEpochSec);
  if (!claims.ok) return { ok: false, status: 401, error: claims.error.message };
  const ctx = services.installation.resolveRequestContext(claims.value.shop, requestId);
  if (!ctx) return { ok: false, status: 403, error: "shop not installed" };
  return { ok: true, ctx, shop: claims.value.shop };
}
