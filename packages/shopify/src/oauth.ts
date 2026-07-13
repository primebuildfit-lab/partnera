import { randomUUID, timingSafeEqual } from "node:crypto";
import { type Result, err, ok, ValidationError } from "@partnera/core";
import { normalizeShopDomain, type ShopDomain } from "./shop";
import { REQUIRED_SCOPES } from "./scopes";

/**
 * OAuth begin/callback helpers (pure). The install URL is built here; the token
 * exchange itself goes through {@link import("./api").ShopifyApiPort}. `state` is
 * a CSRF nonce the caller stores (signed cookie) and verifies on callback —
 * constant-time — so a forged callback cannot complete an install.
 */
export interface InstallUrlParams {
  readonly shop: ShopDomain;
  readonly apiKey: string;
  readonly redirectUri: string;
  readonly state: string;
  readonly scopes?: readonly string[];
}

/** A fresh, unguessable OAuth state nonce. */
export function newOAuthState(): string {
  return randomUUID().replace(/-/g, "");
}

/** Constant-time state comparison (CSRF protection). */
export function verifyState(expected: string, got: string | undefined): boolean {
  if (!expected || !got || expected.length !== got.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(got));
}

/** Build the Shopify authorization URL to begin an install. */
export function buildInstallUrl(params: InstallUrlParams): string {
  const scopes = (params.scopes ?? REQUIRED_SCOPES).join(",");
  const q = new URLSearchParams({
    client_id: params.apiKey,
    scope: scopes,
    redirect_uri: params.redirectUri,
    state: params.state,
    "grant_options[]": "", // offline (permanent) token
  });
  return `https://${params.shop}/admin/oauth/authorize?${q.toString()}`;
}

/**
 * Validate the incoming callback query shape (shop present + normalizable, code
 * present). HMAC and state are verified separately by the host handler.
 */
export function parseCallback(query: Readonly<Record<string, string | undefined>>): Result<{ shop: ShopDomain; code: string; state: string }, ValidationError> {
  const shopRaw = query.shop ?? "";
  const norm = normalizeShopDomain(shopRaw);
  if (!norm.ok) return err(new ValidationError("callback: invalid shop", { shop: shopRaw }));
  if (!query.code) return err(new ValidationError("callback: missing code", {}));
  if (!query.state) return err(new ValidationError("callback: missing state", {}));
  return ok({ shop: norm.value, code: query.code, state: query.state });
}
