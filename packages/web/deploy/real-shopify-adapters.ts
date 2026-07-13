/**
 * REAL Shopify network + session-token adapters (Phase 6, Blocks 5–7).
 *
 * Deploy artifacts kept OUTSIDE `src/` so the offline build stays green (they use
 * the network and `jose` for JWT verification). At deploy they replace the fakes
 * in `shopify-routes.ts` when `SHOPIFY_API_KEY`/`SHOPIFY_API_SECRET` are set.
 * Engines/services never import these — they sit behind the existing ports
 * (`ShopifyApiPort`, `SessionTokenVerifier`). Tokens/secrets never reach a
 * browser or a log.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { err, ok, ValidationError } from "@partnera/core";
import {
  normalizeShopDomain,
  type OfflineTokenResult,
  type SessionTokenClaims,
  type SessionTokenVerifier,
  type ShopDomain,
  type ShopifyApiPort,
  type ShopInfo,
} from "@partnera/shopify";

const API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2024-10";

/** Real Admin API adapter (token exchange, shop read, webhook registration). */
export class RealShopifyApi implements ShopifyApiPort {
  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {}

  async exchangeToken(shop: ShopDomain, code: string): Promise<OfflineTokenResult> {
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ client_id: this.apiKey, client_secret: this.apiSecret, code }),
    });
    if (!res.ok) throw new Error(`token exchange failed: ${res.status}`);
    const j = (await res.json()) as { access_token: string; scope: string };
    return { accessToken: j.access_token, scope: j.scope };
  }

  async getShopInfo(shop: ShopDomain, accessToken: string): Promise<ShopInfo> {
    const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/shop.json`, {
      headers: { "X-Shopify-Access-Token": accessToken, accept: "application/json" },
    });
    if (!res.ok) throw new Error(`shop read failed: ${res.status}`);
    const j = (await res.json()) as { shop: { name: string; email: string | null; country_code: string | null } };
    return { shop, name: j.shop.name, email: j.shop.email, countryCode: j.shop.country_code };
  }

  async registerWebhooks(shop: ShopDomain, accessToken: string, topics: readonly string[]): Promise<void> {
    const address = `${process.env.SHOPIFY_APP_URL}/api/webhooks`;
    for (const topic of topics) {
      const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/webhooks.json`, {
        method: "POST",
        headers: { "X-Shopify-Access-Token": accessToken, "content-type": "application/json" },
        body: JSON.stringify({ webhook: { topic, address, format: "json" } }),
      });
      // 422 = already exists → idempotent; anything else non-2xx is an error.
      if (!res.ok && res.status !== 422) throw new Error(`webhook ${topic} failed: ${res.status}`);
    }
  }
}

/**
 * Real App Bridge session-token verifier (HS256 JWT signed with the app secret).
 * Verifies signature, `exp`, `nbf`, `aud` (API key) and derives the shop from
 * `dest`. Pure Node crypto (no extra dependency) for HS256.
 */
export class RealSessionTokenVerifier implements SessionTokenVerifier {
  constructor(
    private readonly apiKey: string,
    private readonly apiSecret: string,
  ) {}

  verify(token: string, nowEpochSec: number) {
    const parts = token.split(".");
    if (parts.length !== 3) return err(new ValidationError("session token: malformed", {}));
    const [h, p, s] = parts;
    const expected = createHmac("sha256", this.apiSecret).update(`${h}.${p}`).digest();
    const provided = Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
      return err(new ValidationError("session token: bad signature", {}));
    }
    let claims: { dest?: string; sub?: string; exp?: number; nbf?: number; aud?: string };
    try {
      claims = JSON.parse(Buffer.from(p, "base64url").toString("utf8"));
    } catch {
      return err(new ValidationError("session token: bad payload", {}));
    }
    if (claims.aud !== this.apiKey) return err(new ValidationError("session token: wrong aud", {}));
    if (!claims.exp || claims.exp <= nowEpochSec) return err(new ValidationError("session token: expired", {}));
    if (claims.nbf && claims.nbf > nowEpochSec) return err(new ValidationError("session token: not yet valid", {}));
    const norm = normalizeShopDomain((claims.dest ?? "").replace(/^https:\/\//, ""));
    if (!norm.ok || !claims.sub) return err(new ValidationError("session token: bad dest/sub", {}));
    const out: SessionTokenClaims = { shop: norm.value, subject: claims.sub, expiresAt: claims.exp };
    return ok(out);
  }
}
