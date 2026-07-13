# Security Review — Partnera Shopify Pilot

> **Part 20.** Security posture of the Shopify adapter. Critical/High findings block installation.

## Verified (implemented + tested)
| Control | Status |
|---|---|
| Tenant resolved from **verified** shop, never browser input | ✅ `resolveTenant` / webhook `tenantId` |
| Webhook HMAC (constant-time, secret-injected) | ✅ `verifyWebhookHmac` + tests (forged rejected) |
| App-proxy signature verification | ✅ `verifyAppProxySignature` + test |
| OAuth callback HMAC | ✅ `verifyOAuthHmac` + test |
| Cross-shop isolation (distinct tenants; no cross resolution) | ✅ install tests |
| Duplicate-install protection (idempotent) | ✅ unique `shop` index + `installOrResolve` |
| Webhook idempotency (no double-apply on retry) | ✅ unique idem key + test |
| No secrets/tokens in repo or sent to browser | ✅ only `tokenRef`; secrets via env |
| Environment validation refuses unsafe/mixed config | ✅ `validateEnvironment` + tests |
| Merchant RBAC (deny-by-default) | ✅ reused `@partnera/auth` PermissionEngine |
| Append-only money / reversals not edits | ✅ existing ledger invariants |
| Least-privilege scopes | ✅ 3 read scopes |

## Negative tests present
Forged webhook HMAC, wrong secret, tampered body; forged app-proxy/OAuth signature; unknown shop →
no tenant; unsafe env configs; illegal install transitions; duplicate install → one tenant;
creator/other-tenant cannot read/edit config (prior phases).

## To harden at the delivery layer (staging, 🔒/🟡)
- **Session-token** (App Bridge) verification on every embedded request (JWT `aud`/`dest`/`exp`).
- **CSRF/state** on OAuth begin/callback; **XSS** — SSR escaping already; audit any raw HTML.
- **Rate limiting** on app-proxy + webhook endpoints; **IDOR** — all reads already tenant-scoped.
- **Token encryption at rest** (`TOKEN_ENCRYPTION_KEY`); **PII** — honor `customers/redact`.
- **No client DB access**; no unsafe storage URLs (signed, time-limited when storage is activated).

## Result
No Critical/High findings in the **local adapter**. Delivery-layer hardening items are staging
tasks gated on the deployed environment; they are documented, not yet exercised against a host.
