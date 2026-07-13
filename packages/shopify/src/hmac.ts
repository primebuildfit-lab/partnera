import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Shopify request authentication primitives. All verification is constant-time
 * and secret-injected — no secret is ever hardcoded or logged. These are the
 * gate that lets Partnera trust a shop identity: a request is only associated
 * with a tenant after its HMAC is verified here (never from a browser-supplied
 * shop value).
 */

/**
 * Verify a Shopify **webhook** HMAC. Shopify signs the raw request body with the
 * app's API secret and sends base64 in `X-Shopify-Hmac-Sha256`. Compare
 * constant-time. `rawBody` must be the exact bytes received (not re-serialized).
 */
export function verifyWebhookHmac(secret: string, rawBody: string | Buffer, hmacHeaderBase64: string): boolean {
  if (!secret || !hmacHeaderBase64) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest(); // Buffer
  let provided: Buffer;
  try {
    provided = Buffer.from(hmacHeaderBase64, "base64");
  } catch {
    return false;
  }
  return digest.length === provided.length && timingSafeEqual(digest, provided);
}

/**
 * Verify a Shopify **App Proxy** request signature. Shopify appends a hex
 * `signature` computed over the sorted query parameters (excluding `signature`),
 * concatenated as `key=value` with no separators. Constant-time compare.
 */
export function verifyAppProxySignature(secret: string, query: Readonly<Record<string, string | string[]>>): boolean {
  if (!secret) return false;
  const signature = firstValue(query["signature"]);
  if (!signature) return false;
  const message = Object.keys(query)
    .filter((k) => k !== "signature")
    .sort()
    .map((k) => `${k}=${valueForSig(query[k])}`)
    .join("");
  const digestHex = createHmac("sha256", secret).update(message).digest("hex");
  const a = Buffer.from(digestHex, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Verify an OAuth callback / embedded request HMAC (query-param form). Shopify
 * signs the sorted query (excluding `hmac`/`signature`) as `key=value&...` and
 * sends hex in `hmac`. Constant-time compare.
 */
export function verifyOAuthHmac(secret: string, query: Readonly<Record<string, string | string[]>>): boolean {
  if (!secret) return false;
  const provided = firstValue(query["hmac"]);
  if (!provided) return false;
  const message = Object.keys(query)
    .filter((k) => k !== "hmac" && k !== "signature")
    .sort()
    .map((k) => `${k}=${firstValue(query[k]) ?? ""}`)
    .join("&");
  const digestHex = createHmac("sha256", secret).update(message).digest("hex");
  const a = Buffer.from(digestHex, "utf8");
  const b = Buffer.from(provided, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function firstValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
function valueForSig(v: string | string[] | undefined): string {
  return Array.isArray(v) ? v.join(",") : (v ?? "");
}
