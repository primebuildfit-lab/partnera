/**
 * Shopify OAuth scopes for Partnera — least privilege. The pilot needs only what
 * affiliate tracking + shop identity require; broad write scopes are deliberately
 * NOT requested. Optional scopes are documented but not requested until a feature
 * that needs them is activated (with its own reauthorization).
 */
export const REQUIRED_SCOPES = [
  "read_products", // opportunities/content may reference products
  "read_orders", // affiliate conversion attribution (webhooks)
  "read_customers", // associate affiliate/creator identities (minimal)
] as const;
export type RequiredScope = (typeof REQUIRED_SCOPES)[number];

/** Requested only when the corresponding feature is turned on (separate reauth). */
export const OPTIONAL_SCOPES = [
  "write_discounts", // only if affiliate offers issue discount codes
  "read_themes", // only if a theme app extension needs it (blocks don't)
] as const;
export type OptionalScope = (typeof OPTIONAL_SCOPES)[number];

/** Parse Shopify's comma-separated granted-scope string into a set. */
export function parseScopes(granted: string): Set<string> {
  return new Set(granted.split(",").map((s) => s.trim()).filter(Boolean));
}

/**
 * Which required scopes are missing from what the shop granted. A non-empty
 * result means a reauthorization is needed before install can complete.
 */
export function missingRequiredScopes(granted: string, required: readonly string[] = REQUIRED_SCOPES): string[] {
  const have = parseScopes(granted);
  return required.filter((s) => !have.has(s));
}

/** True if the granted scopes satisfy the required set. */
export function scopesSatisfied(granted: string, required: readonly string[] = REQUIRED_SCOPES): boolean {
  return missingRequiredScopes(granted, required).length === 0;
}
