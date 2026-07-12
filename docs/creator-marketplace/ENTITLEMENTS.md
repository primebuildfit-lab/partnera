# Entitlements — Creator Marketplace

> **Part 10 (entitlement half).** A configurable plan-entitlement matrix with **provisional
> labels**. Entitlements reuse the existing **Feature Flag / entitlement** system
> (`@partnera/platform`) — capabilities gate cleanly per plan/tenant; upgrading flips flags,
> no code change. **Prices are not locked** (OQ-41); labels are placeholders.

## 1. Principle

The **transaction model is always on** ([MONETIZATION.md](MONETIZATION.md)); plans only add
**limits and premium capabilities**. Every row below is a **feature flag / limit** enforced
by the platform, not a hardcoded branch.

## 2. Provisional plan tiers (labels only)

`Starter` · `Growth` · `Pro` · `Enterprise` — names and prices provisional.

## 3. Business entitlement matrix (provisional)

| Capability (flag) | Starter | Growth | Pro | Enterprise |
|---|---|---|---|---|
| Active creator campaigns (limit) | low | medium | high | custom |
| Active opportunities (limit) | low | medium | high | custom |
| Staff reviewers (seats) | 1 | few | many | custom |
| Approval modes | human-only | + AI-recommend | + AI-objective, bounded-auto | all |
| AI-assisted review | — | add-on | ✓ | ✓ |
| Page builder | basic | standard | advanced | advanced + custom |
| Custom branding / domain | — | logo/colours | full | full + white-label groundwork |
| Private creator pools | — | — | ✓ | ✓ |
| Advanced content-library controls | basic | standard | advanced | advanced |
| Automation (rules/workflows) | — | limited | ✓ | ✓ |
| Analytics depth | basic | standard | advanced | advanced + export |
| API access | — | read | read/write | full + higher limits |
| Shopify storefront widgets | — | — | ✓ | ✓ |
| Priority moderation | — | — | ✓ | ✓ + SLA |
| **Reduced transaction fee** | — | slight | more | negotiated (≥ global floor) |
| Content storage / file-size limits | low | medium | high | custom |
| Enterprise agreement / SLA | — | — | — | ✓ |

All limits are numbers set in config; the table shows relative intent, not final values.

## 4. Creator entitlements

| Capability | Free (default) | Creator-Premium (optional, later) |
|---|---|---|
| Discover companies & opportunities | ✓ | ✓ |
| Apply / submit / revise | ✓ | ✓ |
| **Get paid** | ✓ | ✓ |
| Portfolio | standard | enhanced |
| Discovery priority | standard | boosted |
| Analytics | basic | advanced |

**Locked:** earning capabilities (discover/apply/submit/get paid) are **always free**
(D-312). Creator-Premium is additive and optional; it never gates earning.

## 5. Enforcement

- Entitlements resolve through the existing feature-flag engine (plan/tenant/rollout, stable
  hashing). A capability check is a `flag.isEnabled(context)` call, not a role hardcode.
- The **reduced-fee** entitlement adjusts the per-business fee **within the global range**;
  it can never drop below the platform floor or hide the fee.
- Downgrades disable premium capabilities but never retroactively alter accepted job
  snapshots or ledger history.

## 6. Open

Final tier names, limits, prices, reduced-fee floors, and whether Creator-Premium ships at
all are open (OQ-05, OQ-41). Nothing here authorizes building billing.
