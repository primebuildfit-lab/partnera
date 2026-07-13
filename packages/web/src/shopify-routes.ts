import { randomUUID } from "node:crypto";
import { type Services } from "@partnera/application";
import { FakeSessionTokenVerifier, FakeShopifyApi, type SessionTokenVerifier, type ShopifyApiPort } from "@partnera/shopify";
import {
  beginInstall,
  handleCallback,
  handleWebhook,
  renderEmbeddedApp,
  resolveEmbeddedContext,
  type ShopifyHostConfig,
} from "./shopify-host";
import { logLine } from "./observability";

/**
 * Productive-host mounting of the Shopify lifecycle (Block 2). Reads config from
 * the environment; when Shopify secrets are absent it uses **fakes** so the
 * lifecycle is demonstrable locally without credentials (deploy injects the real
 * `ShopifyApiPort` + session-token verifier + secrets). The raw request body and
 * headers are available here (needed for webhook HMAC), unlike the form-parsed
 * generic handler.
 */
export interface ShopifyRuntime {
  readonly cfg: ShopifyHostConfig;
  readonly api: ShopifyApiPort;
  readonly verifier: SessionTokenVerifier;
  readonly configured: boolean;
}

export function shopifyRuntimeFromEnv(env: Readonly<Record<string, string | undefined>>, port: number): ShopifyRuntime {
  const configured = Boolean(env.SHOPIFY_API_KEY && env.SHOPIFY_API_SECRET);
  const appUrl = env.SHOPIFY_APP_URL ?? `http://localhost:${port}`;
  return {
    cfg: {
      apiKey: env.SHOPIFY_API_KEY ?? "local_dev_key",
      apiSecret: env.SHOPIFY_API_SECRET ?? "local_dev_secret",
      appUrl,
      redirectUri: env.SHOPIFY_AUTH_CALLBACK_URL ?? `${appUrl}/api/auth/callback`,
    },
    // Deploy provides real adapters; local uses fakes (no network).
    api: new FakeShopifyApi(),
    verifier: new FakeSessionTokenVerifier(),
    configured,
  };
}

export interface RawResponse {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: string;
}

const STATE_COOKIE = "pt_oauth_state";
const json = (status: number, body: unknown): RawResponse => ({ status, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });

/**
 * Handle a Shopify route, or return null if the path is not a Shopify route (the
 * caller then falls back to the generic app handler).
 */
export async function dispatchShopify(
  services: Services,
  rt: ShopifyRuntime,
  method: string,
  path: string,
  query: URLSearchParams,
  headers: Readonly<Record<string, string | undefined>>,
  rawBody: string,
  cookies: Readonly<Record<string, string>>,
): Promise<RawResponse | null> {
  const requestId = randomUUID();

  // Begin install: GET /shopify/install?shop=...
  if (method === "GET" && path === "/shopify/install") {
    const r = beginInstall(rt.cfg, query.get("shop") ?? "");
    if (!r.ok) return json(400, { error: r.error });
    return { status: 302, headers: { location: r.value.redirectUrl, "set-cookie": `${STATE_COOKIE}=${r.value.state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600` }, body: "" };
  }

  // OAuth callback: GET /api/auth/callback
  if (method === "GET" && path === "/api/auth/callback") {
    const q: Record<string, string> = {};
    for (const [k, v] of query) q[k] = v;
    const res = await handleCallback(rt.cfg, services, rt.api, q, cookies[STATE_COOKIE]);
    if (!res.ok) {
      logLine("warn", "oauth.callback_rejected", { status: res.status, shop: q.shop });
      return json(res.status, { error: res.error });
    }
    return { status: 302, headers: { location: res.value.redirectTo, "set-cookie": `${STATE_COOKIE}=; Path=/; Max-Age=0` }, body: "" };
  }

  // Webhooks: POST /api/webhooks (raw body + HMAC).
  if (method === "POST" && path === "/api/webhooks") {
    const res = await handleWebhook(rt.cfg, services, rawBody, headers);
    return { status: res.status, headers: { "content-type": "text/plain" }, body: res.body };
  }

  // Embedded app: GET /shopify/app (session token in Authorization: Bearer <jwt> or ?id_token=).
  if (method === "GET" && path === "/shopify/app") {
    const auth = headers["authorization"];
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : (query.get("id_token") ?? "");
    if (!token) {
      // First load has no token yet; App Bridge fetches one and re-requests.
      return { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: bootstrapHtml(rt.cfg.apiKey, query.get("shop") ?? "") };
    }
    const ctx = resolveEmbeddedContext(services, rt.verifier, token, Math.floor(Date.now() / 1000), requestId);
    if (!ctx.ok) return json(ctx.status, { error: ctx.error });
    return { status: 200, headers: { "content-type": "text/html; charset=utf-8" }, body: renderEmbeddedApp(rt.cfg, services, ctx.ctx, ctx.shop) };
  }

  return null; // not a Shopify route
}

/** Minimal App Bridge bootstrap that obtains a session token then re-requests. */
function bootstrapHtml(apiKey: string, shop: string): string {
  const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c] ?? c);
  return `<!doctype html><html><head><meta charset="utf-8"/><meta name="shopify-api-key" content="${esc(apiKey)}"/>
<title>Partnera</title></head><body>
<p>Loading Partnera for ${esc(shop)}…</p>
<!-- Deploy: load Shopify App Bridge from the CDN, obtain a session token, then
     request /shopify/app with Authorization: Bearer <token>. Kept minimal (Block 6). -->
</body></html>`;
}
