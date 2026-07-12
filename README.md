# Partnera

**A configurable B2B Affiliate, Partnership & Referral Platform.**

Partnera is a standalone, multi-tenant SaaS platform that lets any business build, run, and scale its own affiliate program, referral system, and business-to-business partnerships — without writing code and without being locked into a single ecommerce platform.

> **Status:** Product design phase. No production code, databases, APIs, or infrastructure exist yet. This repository currently contains **design documentation only**.

---

## What Partnera is

- A **configurable affiliate engine**, not a rigid affiliate app.
- A **platform** first, a product for any one business second.
- A system meant to serve **thousands of businesses** across **multiple ecommerce platforms** over many years.

## What Partnera is *not*

- ❌ Not a Shopify app.
- ❌ Not a PrimeBuild module or feature.
- ❌ Not an affiliate plugin.
- ❌ Not tied to any single ecommerce platform, framework, or host.

## Relationship to PrimeBuild

PrimeBuild is the **first customer** of Partnera — nothing more. Every design decision optimizes for the **platform** and its future tenants, never for PrimeBuild specifically. PrimeBuild is treated as "Tenant #1," a validation case, not a design constraint.

---

## The three surfaces

| Surface | Who uses it | Purpose |
|---|---|---|
| **Admin Console** | Partnera operators (us) | Operate the whole platform: tenants, approvals, marketplace, billing, fraud, health. |
| **Business Dashboard** | Each business (tenant) | Run their affiliate program, offers, campaigns, partnerships, payouts. |
| **Affiliate Portal** | Affiliates / partners | Join programs, get links & coupons, track earnings, request payouts. |

## The engines

Partnera is built from independent, composable engines:

Offer · Tracking · Commission · Payment · Fraud · Notification · Extension · Analytics · Integration · Marketplace — coordinated by an **Identity & Tenancy** core.

See [docs/02-architecture.md](docs/02-architecture.md).

---

## Documentation map

| # | Document | What it covers |
|---|---|---|
| — | [DECISIONS.md](DECISIONS.md) | Log of every major product/architecture decision (ADR-style). |
| — | [BUILD_STATUS.md](BUILD_STATUS.md) | Current phase, what exists, what's next. |
| — | [ROADMAP.md](ROADMAP.md) | Phased plan from design → first build → scale. |
| 00 | [docs/00-vision.md](docs/00-vision.md) | Vision, philosophy, principles, north-star. |
| 01 | [docs/01-product.md](docs/01-product.md) | Full product scope, user types, feature surface. |
| 02 | [docs/02-architecture.md](docs/02-architecture.md) | Platform architecture, engines, modularity, multi-tenancy. |
| 03 | [docs/03-data-model.md](docs/03-data-model.md) | Conceptual domain model & core entities (no DB). |
| 04 | [docs/04-offer-engine.md](docs/04-offer-engine.md) | The configurable offer engine & building blocks. |
| 05 | [docs/05-tracking-engine.md](docs/05-tracking-engine.md) | Attribution & tracking design. |
| 06 | [docs/06-commission-engine.md](docs/06-commission-engine.md) | Commission calculation, states, ledger. |
| 07 | [docs/07-payments-payouts.md](docs/07-payments-payouts.md) | Balances, withdrawals, payout rails. |
| 08 | [docs/08-fraud-engine.md](docs/08-fraud-engine.md) | Fraud prevention, risk scoring, review. |
| 09 | [docs/09-partnerships.md](docs/09-partnerships.md) | Business-to-business partnership models. |
| 10 | [docs/10-extensions.md](docs/10-extensions.md) | Third-party extension ecosystem & security. |
| 11 | [docs/11-marketplace.md](docs/11-marketplace.md) | Marketplace for offers/templates/extensions. |
| 12 | [docs/12-admin-console.md](docs/12-admin-console.md) | Admin console specification. |
| 13 | [docs/13-business-dashboard.md](docs/13-business-dashboard.md) | Business dashboard specification. |
| 14 | [docs/14-affiliate-portal.md](docs/14-affiliate-portal.md) | Affiliate portal specification. |
| 15 | [docs/15-user-flows.md](docs/15-user-flows.md) | End-to-end user journeys. |
| 16 | [docs/16-roles-permissions.md](docs/16-roles-permissions.md) | Identity, tenancy, roles, permissions. |
| 17 | [docs/17-monetization.md](docs/17-monetization.md) | Business model & pricing design. |
| 18 | [docs/18-security.md](docs/18-security.md) | Security architecture & controls. |
| 19 | [docs/19-legal-compliance.md](docs/19-legal-compliance.md) | Legal, tax, privacy, compliance. |
| 20 | [docs/20-glossary.md](docs/20-glossary.md) | Shared terminology. |
| 21 | [docs/21-risks.md](docs/21-risks.md) | Risk register from the self-review. |
| 22 | [docs/22-engineering.md](docs/22-engineering.md) | Engineering foundation: stack, monorepo layout, package graph, conventions. |

Engineering references: [TESTING.md](TESTING.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [DECISIONS.md](DECISIONS.md) · [BUILD_STATUS.md](BUILD_STATUS.md).

---

## Development

```bash
pnpm install
pnpm verify   # typecheck + lint + build + test
```

The codebase is a TypeScript monorepo (pnpm + Turborepo) of framework-agnostic
domain engine packages plus a design system. See
[docs/22-engineering.md](docs/22-engineering.md) and [BUILD_STATUS.md](BUILD_STATUS.md).

---

## Design constraints (original design phase)

Do **not**, in this phase: write application code · scaffold · create databases · create APIs · connect Shopify · choose frameworks · choose hosting · provision infrastructure. This phase is **product design only**. Implementation waits for review.
