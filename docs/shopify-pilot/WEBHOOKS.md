# Webhooks — Partnera Shopify Pilot

> **Part 14.** Durable, HMAC-verified, idempotent webhook handling. Source: `@partnera/shopify`
> `webhooks.ts` + `WebhookService`.

## Topics (subscribe only to what's needed)
`app/uninstalled`, `shop/update`, `orders/create`, `orders/paid`, `orders/cancelled`,
`refunds/create`, `products/update`, `products/delete`, and the **mandatory compliance** topics
`customers/data_request`, `customers/redact`, `shop/redact`.

## Processing contract
1. **HMAC verify** the raw body with the app secret (`verifyWebhookHmac`) — reject on failure
   before any parsing.
2. **Idempotency**: record once per `webhookIdempotencyKey(shop, topic, webhookId)`; a retried
   delivery returns `{isNew:false}` and is not re-applied.
3. **Tenant** resolved from the **verified shop** only (`WebhookEvent.tenantId`) — no cross-shop
   effects possible.
4. **Retries → dead-letter**: after `WEBHOOK_MAX_ATTEMPTS` (5) failures the event is parked in
   `dead_letter` for an operator (visible in Platform Admin) — never silently dropped, never
   retried forever.
5. Heavy work runs as a **background job** (`jobs.ts`), not in the webhook request.

## Per-topic effect (pilot)
| Topic | Effect |
|---|---|
| `app/uninstalled` | `InstallationService.uninstall(shop)` — mark uninstalled, drop token ref; data retained for reinstall. |
| `orders/create`/`paid` | Enqueue affiliate attribution (simulated money only). |
| `orders/cancelled`/`refunds/create` | Enqueue clawback/reversal (append-only). |
| `products/update`/`delete` | Flag opportunities/content referencing the product. |
| `customers/*` / `shop/redact` | Compliance: honor data-request/redaction on the tenant's records. |

## Tests
`verifyWebhookHmac` genuine/forged; idempotent dedupe by key; dead-letter after 5 failures
(`shopify-install.test.ts`, `shopify.test.ts`).
