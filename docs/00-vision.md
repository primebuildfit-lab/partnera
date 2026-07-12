# 00 — Vision & Philosophy

## North star

> **Any business, on any commerce platform, can design and run its own affiliate, referral, and partnership programs — configured, not coded — and grow on Partnera for years without outgrowing it.**

Partnera wins when a business can express *its own* commercial rules inside our engine instead of asking us to build a feature. The measure of success is not "does PrimeBuild work" — it is "how many businesses with rules we never anticipated can adopt Partnera without us touching code."

## The core bet

Affiliate and partnership economics are wildly heterogeneous. Every business pays differently: percentages, flat fees, tiers, recurring, per-product, per-collection, bonuses, points, credit, hybrids. Existing tools hardcode a handful of these and force businesses to bend. **Partnera's bet is that the *offer* is a configurable object, not a code path.** If we get the offer engine and the commission ledger right, the rest of the platform composes around them.

## Guiding principles

1. **Platform-first, always.** No feature is designed "for PrimeBuild." PrimeBuild is Tenant #1 — a validation case. If a decision helps PrimeBuild but hurts the thousandth tenant, the thousandth tenant wins.
2. **Configuration over code.** Business rules live in data (configurable offers, rules, workflows), not in `if` branches. New commercial behavior should be a new configuration, not a new deploy.
3. **Modular engines.** Each capability (offers, tracking, commission, payments, fraud, notifications, extensions, analytics, integrations, marketplace) is an independent module with a clear contract. Engines can evolve, scale, and (later) be replaced independently.
4. **Multi-tenant from line one.** Every entity is scoped to a tenant. Tenant isolation is a hard invariant, never an afterthought.
5. **Platform-agnostic commerce.** Shopify is *an* integration, not *the* integration. The core never assumes Shopify. Integrations are adapters behind a stable internal contract.
6. **Money is sacred.** Commissions, balances, and payouts are an append-only, auditable ledger. Correctness and traceability beat convenience everywhere money moves.
7. **Trust is the product.** Fraud prevention, audit history, and clear payout rules are not add-ons — a network of businesses and affiliates only works if the numbers are trustworthy.
8. **Safe extensibility.** Third parties extend the platform through declarative, sandboxed contracts. **Never arbitrary code execution.**
9. **Design for scale, build for now.** Documents plan for thousands of tenants; the first build is deliberately small. We separate "designed to allow" from "built now."
10. **Explicit decisions.** Every meaningful choice is recorded in [DECISIONS.md](../DECISIONS.md) with rationale, so future-us understands why.

## Anti-goals

- ❌ A rigid, opinionated affiliate app.
- ❌ A Shopify-only tool.
- ❌ A PrimeBuild internal system.
- ❌ A plugin marketplace that runs untrusted code in our runtime.
- ❌ Hardcoded commission math that requires engineering for each new tenant rule.

## What "done" looks like for the platform (long-term)

- A business self-serves: signs up, configures an affiliate program with rules unique to it, recruits affiliates, and pays them — with Partnera never writing custom code for them.
- Two businesses form a partnership (revenue share / cross-promo) governed entirely by configuration.
- A third-party developer publishes an approved offer template or integration; other tenants reuse it; the contributor earns a defined commission; Partnera retains commercial rights per policy.
- Operators run the whole network from one Admin Console: tenants, approvals, marketplace, fraud, payouts, health.

## How PrimeBuild fits

PrimeBuild onboards as the first tenant to pressure-test the offer engine, tracking, commissions, and payouts against a real business. Its needs inform priority order — **never** the shape of the abstractions. If PrimeBuild needs something, we ask: "How would *any* business express this?" and build that.
