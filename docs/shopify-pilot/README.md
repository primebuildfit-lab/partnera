# Partnera — Shopify Pilot

> Converting Partnera from a local product into a **real Shopify-connected app** installable
> into PrimeBuild via the same path future merchants will use — **Shopify as an adapter, not
> the source of truth**. This directory documents the adapter, the install/onboarding flow, the
> platform-admin panel, security, webhooks, and tenant migration.

## Honest status (read this first)

The **Shopify adapter is built and tested locally** (pure `@partnera/shopify`: HMAC, install
lifecycle, idempotent webhooks, onboarding, tenant provisioning) reusing the existing
domain/application/persistence layers — **no second codebase**. What is **NOT** done, because it
requires Brian's credentials/consent and crosses the stop lines, is the actual **external**
install: creating a real Shopify Partner app, provisioning hosted DB/hosting, deploying, and
installing into PrimeBuild's live store. Those are **external gates** listed in
[FINAL_CERTIFICATION.md](FINAL_CERTIFICATION.md).

| State | Meaning |
|---|---|
| ✅ live (local) | Implemented, tested, green in this repo |
| 🟡 staging-ready | Contracts + reference impl exist; needs a hosted env to run |
| 🧪 simulated | Deliberately mocked (money, AI, storage) |
| 🔒 external-gated | Requires Brian's login/credentials/consent (Shopify Partner, hosting, DB, DNS) |

## Documents

| Doc | Covers |
|---|---|
| [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) | Code-grounded gap audit (Part 1): every capability classified. |
| [SHOPIFY_APP_IDENTITY.md](SHOPIFY_APP_IDENTITY.md) | App identity, environments, `shopify.app.toml` plan (no secrets). |
| [SCOPES.md](SCOPES.md) | Least-privilege scopes; pilot vs optional. |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Local / staging / production separation + env validation. |
| [PRIMEBUILD_INSTALLATION.md](PRIMEBUILD_INSTALLATION.md) | The exact install runbook (Part 23) + what needs Brian. |
| [TENANT_MIGRATION.md](TENANT_MIGRATION.md) | Idempotent local-pilot → hosted PrimeBuild tenant import. |
| [PLATFORM_ADMIN.md](PLATFORM_ADMIN.md) | Brian's platform-admin panel + separate auth. |
| [WEBHOOKS.md](WEBHOOKS.md) | Topics, HMAC, idempotency, dead-letter, compliance. |
| [SECURITY.md](SECURITY.md) | Security review + negative tests. |
| [FINAL_CERTIFICATION.md](FINAL_CERTIFICATION.md) | Verdict + external gates. |

## Invariants preserved
Partnera is the platform name; Creator Marketplace is a module; Shopify is an adapter; domain-first;
tenant isolation from a **verified** shop (never browser input); append-only money; idempotency;
company-configurable payments/categories/budget/capacity; transparent fee; no card storage; real
AI/payments disconnected; **local mode stays available**.
