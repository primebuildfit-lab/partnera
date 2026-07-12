# 13 — Business Dashboard (Tenants)

> The Business Dashboard is where each **business (tenant)** runs its affiliate program, offers, campaigns, partnerships, and payouts. Everything is **tenant-scoped** and **role-gated**. Desktop-first, responsive second.

## Audience

Business Owner/Admin and business staff (manager, finance, marketer, support), each seeing only what their role permits ([16-roles-permissions.md](16-roles-permissions.md)).

## Sections

### Overview
- **Overview** — program KPIs: clicks, conversions, revenue attributed, commissions owed/paid, top affiliates, alerts.

### Program & affiliates
- **Affiliate Program** — program settings, recruitment mode, terms, approval policy.
- **Affiliates** — roster, tiers/segments, status, performance.
- **Applications** — review & approve/reject join requests.
- **Invitations** — invite affiliates/partners.

### Offers & campaigns
- **Offers** — list & manage configured offers.
- **Offer Builder** — the building-block designer ([04-offer-engine.md](04-offer-engine.md)); create/edit/simulate offers.
- **Campaigns** — launches, seasonal, contests, exclusive.
- **Coupons** — create/assign affiliate coupons.
- **Links** — referral links & their performance.

### Catalog context
- **Products** — product catalog (from commerce integration) for offer scoping.
- **Collections** — collections/categories for offer scoping.

### Money
- **Payments** — payout batches, schedule, methods.
- **Pending Commissions** — awaiting approval/maturation.
- **Approvals** — commission/withdrawal approvals per policy.

### Partnerships & growth
- **Partnerships** — propose/manage/monitor B2B partnerships ([09-partnerships.md](09-partnerships.md)).

### Insight
- **Reports** — business & affiliate performance reports.
- **Analytics** — funnels, cohorts, offer/campaign performance, forecasts.

### Configuration
- **Integrations** — connect commerce platform(s) & tools (via adapters).
- **Settings** — program defaults, branding, policies.
- **Notifications** — alerts & email preferences/templates.
- **Security** — API keys, sessions, member access, 2FA policy.

## Cross-cutting expectations

- **Tenant isolation:** a business sees only its own data (except agreed partnership data).
- **Role-gated:** finance sees payouts; marketers see campaigns; support sees affiliates — per permissions.
- **Simulate before activate:** offers/campaigns can be dry-run against history before going live.
- **Audit:** money, offer, and approval actions are logged for the tenant.
- **Fraud surface:** review queue for the business's own suspicious activity, within platform floors.

## Design priority
Desktop-first for data-dense management; responsive for lighter monitoring. UI stack not chosen here.
