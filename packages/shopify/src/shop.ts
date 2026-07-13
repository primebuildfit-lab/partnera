import { type Brand, type Result, err, ok, ValidationError } from "@partnera/core";

/**
 * A verified Shopify shop domain (e.g. "primebuild.myshopify.com"). Branded so a
 * raw, unverified string from the browser can never be used as a tenant key —
 * the shop is always resolved from a verified Shopify session/HMAC, never trusted
 * from request input (Shopify-as-adapter invariant).
 */
export type ShopDomain = Brand<string, "ShopDomain">;

const SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

/** Normalize and validate a shop domain. Rejects anything not a *.myshopify.com host. */
export function normalizeShopDomain(input: string): Result<ShopDomain, ValidationError> {
  const raw = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!SHOP_RE.test(raw)) {
    return err(new ValidationError("Invalid Shopify shop domain", { input }));
  }
  return ok(raw as ShopDomain);
}

/** The shop's sub-name (before .myshopify.com) — used only for display/slugs. */
export function shopName(shop: ShopDomain): string {
  return shop.replace(/\.myshopify\.com$/, "");
}
