# Shopify Pilot — Implementation Status (code-grounded audit)

> **Part 1.** Classified from the **code**, not documentation. Legend: ✅ live (local, tested) ·
> 🟡 staging-ready (contract + ref impl; needs hosted env) · 🧪 simulated · 🔒 external-gated ·
> ⬜ not started.

## Adapter & platform capabilities

| Capability | State | Where |
|---|---|---|
| Shop domain normalization/validation | ✅ | `@partnera/shopify` `shop.ts` |
| Webhook HMAC verification (constant-time) | ✅ | `hmac.ts` `verifyWebhookHmac` |
| App-proxy signature verification | ✅ | `hmac.ts` `verifyAppProxySignature` |
| OAuth callback HMAC verification | ✅ | `hmac.ts` `verifyOAuthHmac` |
| Least-privilege scopes + upgrade detection | ✅ | `scopes.ts` |
| Environment validation (refuses unsafe/mixed) | ✅ | `env.ts` `validateEnvironment` |
| Install lifecycle state machine | ✅ | `install.ts` |
| Idempotent tenant provisioning on install | ✅ | `application` `InstallationService` |
| Tenant resolution from verified shop | ✅ | `InstallationService.resolveTenant` |
| Uninstall / reinstall (data retained) | ✅ | `InstallationService.uninstall` + tests |
| Durable idempotent webhooks + dead-letter | ✅ | `webhooks.ts` + `WebhookService` |
| Merchant onboarding (persisted, purpose-scoped) | ✅ | `onboarding.ts` + `OnboardingService` |
| Offline/online session model | ✅ (model) | `session.ts` |
| Cross-shop isolation | ✅ (tested) | `shopify-install.test.ts` |
| Persistence collections (installations/sessions/webhooks/onboarding/storage) | ✅ | `ShopifyRepository` |
| Hosted relational DB (Postgres/Prisma) | 🟡🔒 | canonical `prisma/schema.prisma` exists; provisioning is external |
| OAuth token exchange (network) | 🔒 | needs real app secret + Shopify endpoint |
| Embedded admin UI (App Bridge, session-token) | ⬜🔒 | design in this dir; needs deployed app |
| Theme app extension (blocks) | ⬜🔒 | `SHOPIFY_APP_IDENTITY.md` plan; needs CLI + store |
| App-proxy JSON handlers | 🟡 | verification ✅; handlers to add at delivery |
| Background job queue | 🟡 | `jobs.ts` contract + ref; durable queue in staging |
| Storage connectors | 🧪 | `storage.ts` "not connected" default; providers external |
| Billing (Shopify) | 🧪🔒 | `billing.ts` test-mode contract; no charges |
| Platform Admin panel | ✅ (local) | existing Admin Console + `PLATFORM_ADMIN.md` |
| Platform-admin separate auth | 🟡 | roles via `@partnera/auth`; provider is D-104 |

## Existing (reused, unchanged)
Affiliate money spine, Creator Marketplace (categories/payments/capacity/budget/waiting queues/
review/simulated payments/content library/rank unlocks/fee/persistence/backup-restore), SSR web
apps, local launcher — all ✅ from prior phases (210 tests green).

## Money / AI / providers
Creator + affiliate payouts 🧪 simulated; AI review 🧪 mock; storage 🧪 not-connected; billing 🧪
test-mode. Real activation of each is 🔒 external-gated.

## Net
Everything **safe and local** for a Shopify pilot is implemented and tested. The remaining work is
**external**: real Partner app, hosting/DB, deploy, and the live install into PrimeBuild — see
[PRIMEBUILD_INSTALLATION.md](PRIMEBUILD_INSTALLATION.md).
