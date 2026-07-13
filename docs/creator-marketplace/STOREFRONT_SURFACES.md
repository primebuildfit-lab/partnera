# Storefront Surfaces — Creator Marketplace

> **Part 3 (surfaces half).** The presentation channels the page builder
> ([PAGE_BUILDER_ARCHITECTURE.md](PAGE_BUILDER_ARCHITECTURE.md)) renders into. Every channel
> is an **adapter** over the same renderer core and the same permission-gated domain data.
> **Partnera owns the domain data; Shopify (and any storefront) is a channel** (D-314).

## 1. Channels

| Channel | What it is | Status |
|---|---|---|
| **Partnera standalone (hosted pages)** | SSR pages served by `@partnera/web` at Partnera-owned URLs. | Primary; design target now. |
| **Shopify embedded app** | Admin-embedded management UI for business owners. | Future adapter. |
| **Shopify app blocks (theme sections)** | Merchant adds program blocks into their storefront theme. | Future adapter. |
| **Storefront widgets** | Embeddable widgets (script/iframe) for any site. | Future adapter. |
| **Hosted public pages** | Partnera-hosted public program/opportunity/library pages. | Design target now. |

## 2. Shared contract

All channels consume the **same** renderer core + `QueryService`. A channel:
1. receives a `Page` document (blocks + theme + bindings),
2. resolves bindings through the permission-gated query layer (viewer-scoped),
3. renders with the business's theme,
4. routes actions (apply, submit, download) back to the application layer.

No channel gets privileged data access; the application layer is the single authority. This
guarantees a Shopify block and a hosted page show identical, correctly-scoped data.

## 3. Surface responsibilities

- **Public / affiliate-facing** surfaces render only published, permitted content; the
  affiliate library block enforces rank + license ([RANK_UNLOCKS.md](RANK_UNLOCKS.md)).
- **Management** surfaces (embedded app) require an authenticated business session and
  permission checks — identical to the Business Dashboard.
- **Creator-facing** surfaces (application form, submission instructions) validate + rate-limit
  and never trust the embedding page for identity/tenant.

## 4. Why not Shopify-first

Making Shopify the core would (a) couple the domain to one commerce platform (violates
D-007/D-314), (b) fragment the source of truth, and (c) block non-Shopify businesses.
Instead, Shopify is **one presentation + commerce adapter**; the domain, money, review, and
library all live in Partnera. See [SHOPIFY_INTEGRATION.md](SHOPIFY_INTEGRATION.md).

## 5. Progressive enhancement & accessibility

Channels follow the existing SSR/progressive-enhancement + accessibility approach (D-215):
pages work without JS, are responsive, and meet the platform's a11y baseline. Widgets
degrade gracefully when embedded in constrained hosts.
