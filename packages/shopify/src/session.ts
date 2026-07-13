import { type BusinessId, type TenantId, type UserId } from "@partnera/core";
import { type ShopDomain } from "./shop";
import { type ShopifySessionId } from "./ids";

/**
 * Shopify session records. An **offline** session (one per shop) carries the
 * long-lived token used for background work (webhooks, jobs). **Online/embedded**
 * sessions are per-user, short-lived, and verified from the App Bridge session
 * token on each request. The tenant is ALWAYS derived from the verified session's
 * shop → installation → business, never from a browser-supplied shop parameter.
 */
export interface ShopifyOfflineSession {
  readonly id: ShopifySessionId;
  readonly shop: ShopDomain;
  readonly kind: "offline";
  readonly tokenRef: string; // reference to the encrypted token; never the token
  readonly scopes: string;
  readonly createdAt: Date;
}

export interface ShopifyOnlineSession {
  readonly id: ShopifySessionId;
  readonly shop: ShopDomain;
  readonly kind: "online";
  readonly userId: UserId;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export type ShopifySession = ShopifyOfflineSession | ShopifyOnlineSession;

/** The resolved tenant context for a verified Shopify request. */
export interface ResolvedShopTenant {
  readonly shop: ShopDomain;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
}

export function isOnline(s: ShopifySession): s is ShopifyOnlineSession {
  return s.kind === "online";
}
