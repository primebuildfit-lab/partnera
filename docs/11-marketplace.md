# 11 — Marketplace

> The marketplace is where approved offers, templates, and extensions become **discoverable and reusable** across tenants — turning one business's good idea into platform-wide value, and a future revenue stream.

## What's in the marketplace

- **Offer templates** (block compositions).
- **Affiliate/program templates.**
- **Extensions** (reporting, marketing, automation, widgets, integrations, analytics) — all approved per [10-extensions.md](10-extensions.md).
- **Campaign templates** (launch, seasonal, contest setups).
- **(Future) partnership discovery** — businesses finding partners ([09-partnerships.md](09-partnerships.md)).

## Core flows

- **Discover** — browse/search by type, use-case, platform, rating.
- **Install** — a tenant adopts a listing; the installation is scoped, versioned, and revocable.
- **Update** — new versions re-enter approval; tenants control upgrades.
- **Rate/review** — quality signals feed curation.
- **Contribute** — publish (via the extension approval workflow).

## Curation & quality

- Only **approved** items are listed.
- Ratings, adoption counts, and moderation shape ranking.
- Platform can feature, deprecate, or **kill-switch** listings on security/quality grounds.
- Clear disclosure of an extension's requested scopes before install.

## Monetization (design-level — see [17-monetization.md](17-monetization.md))

- **Marketplace commission** on paid listings.
- **Extension commissions** to contributors (through the auditable ledger).
- Free templates drive adoption; paid/premium items drive revenue.
- Partnera retains commercial rights to approved content per policy, enabling reuse for future customers.

## Reuse-for-future-customers

A key strategic function: approved offers/templates/extensions become **assets Partnera can offer new tenants out-of-the-box**, shortening time-to-value for the next thousand businesses — with contributor commissions honored per policy.

## Interfaces

- **Extension Engine** — provides approved, installable items.
- **Offer Engine** — consumes installed offer templates as configuration.
- **Commission/Payment** — contributor & marketplace-commission settlement.
- **Admin Console** — curation, featuring, moderation, payouts.
- **Business Dashboard / Affiliate Portal** — discovery & install surfaces.

## Invariants

1. **Only approved items** are discoverable.
2. **Installs are scoped, versioned, revocable.**
3. **Scope disclosure** before install.
4. **Contributor commissions** flow through the auditable ledger.

## Open decisions (see DECISIONS.md)
- Paid marketplace at launch or later.
- Marketplace commission rate.
- Revenue split & rights specifics with contributors.
- Whether partnership discovery ships with the first marketplace or later.
