# Shopify Scopes — Partnera (least privilege)

> **Part 3.** Only what the pilot truly needs. Broad write scopes are **not** requested.
> Source of truth: `@partnera/shopify` `scopes.ts`.

## Required (pilot)
| Scope | Why |
|---|---|
| `read_products` | Opportunities/content may reference products. |
| `read_orders` | Affiliate conversion attribution (via `orders/create`, `orders/paid`, `refunds/create`). |
| `read_customers` | Associate affiliate/creator identities minimally. |

## Optional (only when a feature is turned on — separate reauthorization)
| Scope | Gated feature |
|---|---|
| `write_discounts` | Affiliate offers that issue discount codes. |
| `read_themes` | Only if a theme extension needs it (app blocks do **not**). |

## Scope-upgrade handling
`missingRequiredScopes(granted)` / `scopesSatisfied(granted)` detect a shortfall; the install flow
triggers reauthorization when scopes change. No silent scope escalation.

## App Store review implications (future)
Each scope must be justified; compliance webhooks (`customers/data_request`, `customers/redact`,
`shop/redact`) are mandatory for review — implemented in [WEBHOOKS.md](WEBHOOKS.md). Keeping the
required set to three read scopes minimizes review friction.
