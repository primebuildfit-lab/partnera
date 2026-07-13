import { type TenantId } from "@partnera/core";
import { type ShopDomain } from "./shop";
import { type WebhookEventId } from "./ids";

/**
 * Durable Shopify webhook handling. Every webhook is: (1) HMAC-verified
 * (see hmac.ts), (2) recorded idempotently by a stable key so Shopify's retries
 * never double-apply, (3) processed, and (4) on repeated failure, parked in a
 * dead-letter state for an operator — never silently dropped, never retried
 * forever. Cross-shop effects are impossible: the tenant is resolved from the
 * verified shop only.
 */
export const WEBHOOK_TOPICS = [
  "app/uninstalled",
  "shop/update",
  "customers/data_request",
  "customers/redact",
  "shop/redact",
  "orders/create",
  "orders/paid",
  "orders/cancelled",
  "refunds/create",
  "products/update",
  "products/delete",
] as const;
export type WebhookTopic = (typeof WEBHOOK_TOPICS)[number];

export type WebhookStatus = "received" | "processing" | "processed" | "failed" | "dead_letter";

export interface WebhookEvent {
  readonly id: WebhookEventId;
  readonly shop: ShopDomain;
  readonly tenantId: TenantId | null; // null until the shop resolves to a tenant
  readonly topic: WebhookTopic;
  /** Shopify's X-Shopify-Webhook-Id — the idempotency anchor. */
  readonly webhookId: string;
  readonly status: WebhookStatus;
  readonly attempts: number;
  readonly receivedAt: Date;
  readonly processedAt: Date | null;
  readonly lastError: string | null;
}

/** Stable idempotency key: one logical delivery per (shop, topic, webhookId). */
export function webhookIdempotencyKey(shop: ShopDomain, topic: WebhookTopic, webhookId: string): string {
  return `${shop}::${topic}::${webhookId}`;
}

/** Max processing attempts before a webhook is parked in dead-letter. */
export const WEBHOOK_MAX_ATTEMPTS = 5;

/** Is a topic one of the mandatory GDPR/compliance webhooks? */
export function isComplianceTopic(topic: WebhookTopic): boolean {
  return topic === "customers/data_request" || topic === "customers/redact" || topic === "shop/redact";
}

export function isKnownTopic(topic: string): topic is WebhookTopic {
  return (WEBHOOK_TOPICS as readonly string[]).includes(topic);
}
