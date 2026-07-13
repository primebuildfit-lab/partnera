import { type ShopDomain } from "./shop";

/**
 * The Shopify network boundary — the ONLY place real HTTP to Shopify happens.
 * Everything else in this package is pure. Two implementations: a `FakeShopifyApi`
 * for tests/local (no network, deterministic) and a real `pg`-style adapter at
 * deploy (documented in docs/shopify-pilot/DEPLOY.md). The offline access token
 * returned here is handed to the persistence layer as an encrypted reference —
 * never returned to a browser or logged.
 */
export interface OfflineTokenResult {
  readonly accessToken: string;
  readonly scope: string;
}

export interface ShopInfo {
  readonly shop: ShopDomain;
  readonly name: string;
  readonly email: string | null;
  readonly countryCode: string | null;
}

export interface ShopifyApiPort {
  /** Exchange an authorization code for a permanent offline access token. */
  exchangeToken(shop: ShopDomain, code: string): Promise<OfflineTokenResult>;
  /** Minimal shop identity read (verifies the token works). */
  getShopInfo(shop: ShopDomain, accessToken: string): Promise<ShopInfo>;
  /** Register the required webhook topics for a shop (idempotent on Shopify side). */
  registerWebhooks(shop: ShopDomain, accessToken: string, topics: readonly string[]): Promise<void>;
}

/** Deterministic fake — lets the whole install/webhook flow be tested without credentials. */
export class FakeShopifyApi implements ShopifyApiPort {
  readonly exchanged: { shop: string; code: string }[] = [];
  readonly registered: { shop: string; topics: readonly string[] }[] = [];

  constructor(private readonly scope = "read_products,read_orders,read_customers") {}

  async exchangeToken(shop: ShopDomain, code: string): Promise<OfflineTokenResult> {
    this.exchanged.push({ shop, code });
    if (!code) throw new Error("missing code");
    return { accessToken: `fake_offline_token_for_${shop}`, scope: this.scope };
  }
  async getShopInfo(shop: ShopDomain, accessToken: string): Promise<ShopInfo> {
    if (!accessToken) throw new Error("missing token");
    return { shop, name: shop.replace(".myshopify.com", ""), email: null, countryCode: "US" };
  }
  async registerWebhooks(shop: ShopDomain, _accessToken: string, topics: readonly string[]): Promise<void> {
    this.registered.push({ shop, topics });
  }
}
