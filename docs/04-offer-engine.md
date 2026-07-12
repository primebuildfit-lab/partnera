# 04 — Offer Engine

> The offer engine is the heart of Partnera. Everything else composes around it. Its job: let a business express *its own* commission logic as **configuration**, and evaluate that configuration deterministically against real events.

## Design goal

Do **not** build an affiliate system with a fixed list of commission types. Build an **engine** whose configurations *produce* those types — and types nobody has imagined yet. A business should reach the "Design Your Own Offer" experience and still stay inside the engine.

## The building-block model

An **Offer** is composed of ordered, typed **Blocks**. Conceptually every offer is:

```
Offer
├── Scope        — WHAT it applies to
├── Conditions   — WHEN it applies (eligibility & triggers)
├── Calculation  — HOW MUCH is earned
├── Reward       — IN WHAT FORM it's paid
├── Schedule     — WHEN it's active & when it recurs
└── Limits       — caps, budgets, per-affiliate limits
```

Each section is filled with configurable blocks. The engine evaluates them in a defined order and produces a **commission instruction** (amount + form + timing + reason).

### 1. Scope blocks — *what*
- All orders
- Specific product(s) / SKU set
- Collection
- Category
- Brand
- Price range / order value threshold
- New vs. returning customer
- First order vs. repeat
- Marketplace / channel

### 2. Condition blocks — *when / eligibility*
- Attributed via referral link
- Attributed via coupon
- Attributed via session
- Affiliate tier / segment
- Campaign membership
- Minimum order value
- Customer type (new/returning)
- Geography
- Date/time window
- Quantity thresholds
- Exclusivity (invite-only, partner-only)

### 3. Calculation blocks — *how much*
- **Percentage** of order / eligible line items
- **Fixed** amount per conversion
- **Per-product / per-unit** amount
- **Tiered** by volume (e.g. 5% up to X, 8% above)
- **Level** commissions (multi-level / referral of referrers)
- **Recurring** (each billing cycle of a subscription)
- **Bonus** on hitting a target (count/revenue milestone)
- **Contest** rank-based rewards
- **Formula** (composed of the above; the "Design Your Own" primitive)

### 4. Reward blocks — *in what form*
- Cash (percentage or fixed)
- Reward points
- Gift card
- Store credit
- Hybrid (e.g. cash + points)
- Non-cash bonus (physical/perk — recorded, fulfilled externally)

### 5. Schedule blocks — *when active*
- Always on
- Time-limited campaign window
- Recurring intervals (for subscription commissions)
- Holiday / seasonal windows
- Launch windows

### 6. Limit blocks — *guardrails*
- Max payout per conversion
- Max payout per affiliate (period)
- Total offer budget cap
- Cooldown / frequency caps
- Clawback window (return/refund reversal period)

## Offer-type catalog (all expressible as block compositions)

The brief's offer list maps onto blocks — none require bespoke code:

| Requested offer type | Expressed as |
|---|---|
| Percentage commission | Calc: Percentage |
| Fixed commission | Calc: Fixed |
| Commission by product / collection / category / brand | Scope + Calc |
| Coupon-based | Condition: coupon attribution |
| Referral link | Condition: link attribution |
| Recurring / subscription | Schedule: recurring + Calc |
| Tiered | Calc: Tiered |
| Level commissions | Calc: Level |
| Performance bonuses | Calc: Bonus on target |
| Time-limited / holiday / launch campaigns | Schedule + Campaign context |
| Exclusive / invite-only | Condition: exclusivity |
| Business collaboration | Partnership context + shared reward |
| Marketplace campaigns | Campaign + marketplace scope |
| Referral contests | Calc: contest rank + leaderboard |
| Cash bonuses | Reward: cash + Calc: bonus |
| Reward points / gift cards / store credit | Reward blocks |
| Hybrid rewards | Multiple reward blocks |
| **Design Your Own Offer** | Formula calc + arbitrary block composition |

## Evaluation model

1. An event arrives (attributed Conversion) with full context (order, affiliate, tier, campaign, attribution basis).
2. The engine gathers **candidate offers** for the tenant/program that could apply.
3. For each candidate, evaluate Scope → Conditions. Non-matching offers drop out.
4. Apply a **conflict/stacking policy** (configurable): highest value wins, or explicit priority, or stack allowed. This is itself configuration.
5. Run Calculation → Reward on the winning offer(s) → produce commission instruction(s).
6. Apply Limits (caps/budgets) → clamp or reject.
7. Emit instruction to the **Commission Engine** with a full **reason trail** (which offer, which blocks, why).

### Determinism & auditability
Given the same event and the same offer config version, evaluation is **deterministic**. Every produced commission stores the offer version and the block path that generated it, so any payout can be explained and reproduced. Offer edits are **versioned** — historical commissions always reference the version in force at the time.

## "Design Your Own Offer" (guardrails)

The formula/custom path is powerful and therefore constrained:
- Composed only from **approved primitive blocks** — never free-form code.
- Validated at save time (no division-by-zero, no unbounded payouts without a cap, currency consistency).
- Simulatable: businesses can **dry-run** an offer against historical orders before activating.
- Budget/limit blocks strongly encouraged (and can be platform-enforced) to prevent runaway payouts.

## Interfaces to other engines

- **Tracking** provides the attributed conversion + basis.
- **Commission** consumes the instruction and writes the ledger.
- **Fraud** can veto/hold before an instruction becomes an approved commission.
- **Marketplace/Extensions** can supply **OfferTemplates** (pre-built block compositions), which are just data.
- **Analytics** reads offer performance to inform the business.

## Open decisions (see DECISIONS.md)
- Default stacking policy (winner-takes-all vs. explicit priority vs. stack).
- How multi-level/level commissions bound depth to prevent abuse.
- Whether clawback windows are global defaults or per-offer only.
