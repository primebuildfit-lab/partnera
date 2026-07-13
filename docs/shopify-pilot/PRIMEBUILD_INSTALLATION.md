# PrimeBuild Installation Runbook

> **Part 23.** Install Partnera into PrimeBuild via the same path future merchants use. Steps are
> marked ✅ (done in repo, local/tested), 🟡 (ready, needs hosted env), or 🔒 (**requires Brian** —
> credentials/consent; I will not do these autonomously). **Use a development clone first**, then
> repeat in PrimeBuild with Brian's approval.

## Prerequisites (🔒 Brian)
Shopify **Partner** account + a Partnera app (dev + staging), a **hosted Postgres**, a **host** for
`@partnera/web` at a public HTTPS URL, and secrets (API key/secret, DATABASE_URL, token-encryption
key). Partnera provides schema/migrations/adapter/services/docs.

## Steps
1. 🟡 Deploy staging Partnera (`DEPLOYMENT.md`); env validator must pass (`mode=staging`,
   `persistence=database`, money simulated).
2. 🔒 Set the app's application URL + redirect URLs to the deployed host (`SHOPIFY_APP_IDENTITY.md`).
3. 🟡 Run DB migrations (canonical Prisma model + Shopify tables); run the tenant-isolation suite
   against the real DB **before** installing.
4. 🔒 Install from the Shopify Admin / Partner install link (a **dev store clone** first).
5. 🔒 Approve the 3 required read scopes.
6. ✅ Offline session stored (`upsertOfflineSession`) — logic tested; runs on the real callback.
7. ✅ Tenant created idempotently (`installOrResolve`) — tested (one tenant per shop).
8. ✅ Brian owner membership created (business_owner system role) — tested.
9. ✅/🟡 Complete onboarding (`OnboardingService`) — persisted; UI wiring at delivery.
10. ✅ Select Affiliate + Creator modules (onboarding purpose = both).
11. ✅/🟡 Import PrimeBuild pilot data (`TENANT_MIGRATION.md`) — idempotent, tested locally.
12. 🟡 Verify business dashboard (embedded) · 13. 🟡 creator portal · 14. 🟡 affiliate portal.
15. 🔒 Install minimal storefront app block **only if approved** (do not auto-publish the theme).
16. ✅/🟡 Verify webhooks (HMAC + idempotency + dead-letter tested; live delivery on the host).
17. 🟡 Verify uninstall/reinstall in a **test** context — logic ✅ tested (data retained).
18. ✅ Restart/recovery — file mode verified previously; hosted DB is durable by construction.
19. ✅/🟡 Platform Admin sees PrimeBuild (`ShopifyRepository`/services expose it).
20. **Do not publish Partnera publicly.**

## What is blocked and needs one precise action from Brian
- Create the Shopify Partner app(s) and share client id/secret for staging.
- Provision the hosted Postgres + a host, and authorize a deploy.
- Approve installing into a **dev clone** of PrimeBuild first, then PrimeBuild.

Until those are done, the install is **code-complete and tested locally** but **not performed**.
