# Navigation — Creator Marketplace

> **Part 18 (navigation half).** Navigation structure per surface. Reuses the existing
> nav-registry pattern (`@partnera/platform`): each nav item is gated by a **permission
> key**, so navigation is data-driven and isolation-safe. Screens are specified in
> [UX_SPECIFICATIONS.md](UX_SPECIFICATIONS.md).

## App switcher

A user with multiple capabilities switches between: **Admin Console**, **Business
Dashboard**, **Creator Portal**, **Affiliate Portal**. Only apps the user has access to
appear. Each app is a separate scope; switching never carries privileges across.

## Admin Console (creator additions)

```
Overview · Businesses · Creators · Jobs · Submissions · Moderation · Disputes
· Payments · Fees · Analytics · Configuration · (existing: Health · Logs · Users · Audit)
```
Gates: `moderation.handle`, `dispute.handle`, `fee_config.manage`, `audit.view`, operator scope.

## Business Dashboard (new "Creators" section, beside existing "Affiliates")

```
Creator ▸ Dashboard · Program · Public Page · Opportunities · Applications
        · Submissions · Review · Payments · Content Library · Affiliate Unlocks
        · Analytics · Staff & Permissions
Affiliate ▸ (existing affiliate program nav — unchanged)
```
Gates: `creator_program.manage`, `content_opportunity.*`, `submission.*`, `payment.authorize`,
`content_asset.manage`, `rank_unlock.manage`, `analytics.creator.view`. Reviewers/contractors
see only their scoped subset.

## Creator Portal (new app)

```
Discover · Opportunities · My Jobs · Submission Studio · Revisions
· Earnings · Portfolio · Reputation · Notifications · Settings
```
Gates: creator self-scope (own profile/jobs/earnings only). No tenant nav.

## Affiliate Portal (new "Content" section, existing nav retained)

```
(existing: Performance · Links · Coupons · Commissions · Payouts · …)
Content ▸ Library · Rank Status · Unlocked · Locked · Campaign Kits · Downloads · Performance
```
Gates: `affiliate_content.view`, enrollment + rank scope. Existing affiliate nav is unchanged.

## Public / storefront (page-builder rendered)

```
Creator Program page · Opportunity directory · Opportunity detail · Application
· Content download portal (enrolled affiliates) · FAQ · Terms & disclosures
```
Rendered per [PAGE_BUILDER_ARCHITECTURE.md](PAGE_BUILDER_ARCHITECTURE.md) /
[STOREFRONT_SURFACES.md](STOREFRONT_SURFACES.md); shows only published, viewer-scoped data.

## Principles

- **Permission-first**: a nav item renders only if the viewer holds its key (deny-by-default).
- **No cross-app leakage**: each app resolves its own tenant/creator scope from the session.
- **Mobile**: sections collapse into the `<details>` menu; the app switcher stays reachable.
- **Deep links** honour permission + scope checks server-side, never trusting the URL.
