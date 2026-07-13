# Platform Admin — Partnera

> **Parts 7 & 21.** Brian's **global** Partnera operator panel — separate from any merchant's
> Shopify dashboard, with its own authentication (not Shopify merchant permissions).

## Authentication & roles (Part 21)
Platform roles come from `@partnera/auth` (deny-by-default, data-driven): `platform_admin`
(`*`), plus intended `moderator`, `finance/audit`, `support`, `read_only_operator`. **Not** every
Shopify store owner is a platform admin — platform membership is `scope: { kind: "platform" }`,
granted only to Partnera operators. The real login provider is D-104 (build-phase); for the pilot
Brian is provisioned as platform owner via a platform membership. **Every privileged action is
audited** (existing append-only audit log).

## Panel (reuses the existing Admin Console; extended)
- **Overview** — businesses, installed shops, active affiliate/creator programs, creators,
  affiliates, opportunities, submissions, reviews, waiting queues, simulated volume, projected
  fees, disputes, risk, system health.
- **Businesses** — profile, tenant id, Shopify shop, install status, plan/trial, modules, fee
  rate, storage-connector state, limits, staff, suspensions, audit.
- **People** — creators, affiliates, dual-role, memberships, status, reputation, restrictions.
- **Programs** — affiliate + creator programs, category schemes, budgets, capacity, activity.
- **Money** — creator obligations, affiliate commissions, platform fees, simulated payouts,
  provider status (disconnected), reversals, disputes, exposure.
- **Moderation** — flagged content metadata, reports, disputes, violations, suspensions, appeals.
- **System** — **Data status** (already built: `/admin/data` — storage, counts, integrity,
  backups), webhook health (incl. dead-letter count), Shopify installations, failed jobs,
  migration status, deployment version, audit.

Brian never needs direct database access to operate the platform. **Merchants never see Platform
Admin** — it is platform-scoped and permission-gated.

## Status
The Admin Console + Data status view are ✅ live locally. The Shopify-specific reads
(installations, webhook health, dead-letter, projected fees across tenants) surface the
`ShopifyRepository`/`WebhookService` data; wiring the remaining operator screens is a
delivery task on top of the tested services.
