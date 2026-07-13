/**
 * @partnera/shopify — the Shopify **adapter** for Partnera.
 *
 * Shopify is a delivery/commerce adapter, never the source of truth: this package
 * holds the pure, framework-agnostic primitives for installing Partnera into a
 * Shopify store and operating it safely — shop normalization, request
 * authentication (webhook/app-proxy/OAuth HMAC), install lifecycle, durable
 * idempotent webhooks, merchant onboarding, sessions/tenant resolution, and
 * provider-independent storage/job/billing contracts. No network calls, no real
 * credentials, no secrets: verification takes an injected secret; tokens are only
 * ever referenced, never held here. The Partnera domain/application/persistence
 * layers are reused unchanged; nothing here becomes a second codebase.
 */
export * from "./ids";
export * from "./shop";
export * from "./hmac";
export * from "./scopes";
export * from "./env";
export * from "./install";
export * from "./webhooks";
export * from "./onboarding";
export * from "./session";
export * from "./storage";
export * from "./jobs";
export * from "./billing";
export * from "./api";
export * from "./oauth";
export * from "./session-token";
