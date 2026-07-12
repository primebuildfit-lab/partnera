# 02 — Platform Architecture

> Conceptual architecture only. No frameworks, hosts, or infrastructure are chosen here — those are deferred to the build phase (see [../ROADMAP.md](../ROADMAP.md) and [../DECISIONS.md](../DECISIONS.md)).

## Architectural principles

- **Modular engines** behind explicit contracts. Each engine owns its domain and exposes a stable interface; internals can change freely.
- **Multi-tenant core.** Every record is tenant-scoped. Isolation is enforced at the data-access layer, not left to callers.
- **Event-driven backbone.** Engines communicate through domain events (e.g. `conversion.recorded`, `commission.approved`, `payout.completed`) so they stay decoupled and independently scalable.
- **Append-only where money lives.** The commission and payment ledgers are immutable event logs; state is derived.
- **Adapters at the edges.** Commerce platforms, payment rails, email/SMS providers, and fraud data sources sit behind adapter contracts. The core never depends on a specific vendor.
- **Configuration as data.** Offers, rules, workflows, and feature flags are stored configuration interpreted by engines — not compiled logic.

## The tenancy core (foundation)

Underneath all engines sits **Identity & Tenancy**:

- **User** — a person (may belong to multiple businesses/contexts).
- **Business (Tenant)** — an isolated customer of Partnera.
- **Organization** — optional grouping (agencies, multi-brand groups) owning one or more businesses.
- **Membership** — links a user to a business/org with a **Role**.
- **Role → Permissions** — RBAC governing every action.

Detailed model: [16-roles-permissions.md](16-roles-permissions.md).

## The engines

Each engine is described in its own doc; here is the map and the contracts between them.

| Engine | Responsibility | Key inputs | Key outputs / events |
|---|---|---|---|
| **Offer Engine** | Define & evaluate configurable offers from building blocks. | Offer config, order/event context | "This event yields commission X under rule Y" |
| **Tracking Engine** | Capture clicks/coupons/sessions; attribute conversions. | Link/coupon/session signals, conversion events | `conversion.recorded` with attribution |
| **Commission Engine** | Turn attributed conversions into ledger entries via offer rules. | Attribution + offer evaluation | `commission.created/approved/reversed` |
| **Payment Engine** | Balances, withdrawals, payout batches, rails. | Approved commissions, payout requests | `payout.requested/completed/failed` |
| **Fraud Engine** | Score risk, flag, route to review. | Signals from tracking, orders, accounts | Risk scores, `fraud.flagged`, holds |
| **Notification Engine** | Deliver emails/SMS/in-app/webhooks. | Domain events, templates, preferences | Delivered messages |
| **Extension Engine** | Register, sandbox & run approved extensions via declarative contracts. | Extension manifests, hooks | Extension outputs (data only) |
| **Analytics Engine** | Aggregate events into reports & dashboards. | Event stream | Metrics, reports, forecasts |
| **Integration Engine** | Adapters to commerce platforms & external systems. | Platform webhooks/APIs | Normalized internal events |
| **Marketplace Engine** | List, discover, install approved offers/templates/extensions; contributor commissions. | Approved catalog items | Installs, contributor earnings |

The **Admin Console**, **Business Dashboard**, and **Affiliate Portal** are presentation surfaces over these engines — not engines themselves.

## How a conversion flows (reference path)

```
Affiliate shares link/coupon
        │
        ▼
[Tracking Engine] click/coupon captured  ──►  session/attribution stored
        │
   (customer buys — order arrives via Integration Engine adapter)
        │
        ▼
[Integration Engine] normalizes order  ──►  emits `order.created`
        │
        ▼
[Tracking Engine] attributes order to affiliate/campaign  ──►  `conversion.recorded`
        │
        ├────────────► [Fraud Engine] scores risk  ──► may hold/flag
        │
        ▼
[Offer Engine] evaluates applicable offer rules for this conversion
        │
        ▼
[Commission Engine] writes ledger entry (pending)  ──► `commission.created`
        │
   (approval window / business or auto approval; fraud clears)
        │
        ▼
[Commission Engine] `commission.approved`  ──► balance updated
        │
        ▼
[Payment Engine] included in payout batch  ──► `payout.completed`
        │
        ▼
[Notification Engine] notifies affiliate & business; [Analytics Engine] records
```

Every step emits events; nothing is a hidden side effect. Money-affecting steps are ledger-appends, never in-place edits.

## Multi-tenancy model (conceptual)

- **Isolation invariant:** no query returns cross-tenant data unless performed by a platform operator through an explicit, audited path.
- **Scoping key:** every domain entity carries a tenant reference; the data-access layer injects and enforces it.
- **Shared vs. tenant data:** marketplace catalog, extension registry, and platform config are shared; everything operational (affiliates, offers, commissions, payouts) is tenant-scoped.
- **Physical strategy is deferred** (shared schema vs. schema-per-tenant vs. hybrid) — decided in the build phase. The *logical* contract above holds regardless. See DECISION log.

## Extensibility architecture

- Extensions declare **capabilities** and **hooks** in a manifest; the Extension Engine invokes them through a constrained contract that returns **data, not executable behavior in our runtime**.
- Trusted execution boundary: untrusted logic (if ever run) executes in an isolated sandbox with no access to core data beyond its declared scope. Default posture: **declarative configuration and templates, not code.**
- See [10-extensions.md](10-extensions.md) for the security model.

## Cross-cutting concerns

- **Audit history:** every state change to money, permissions, offers, and approvals is recorded immutably. See [18-security.md](18-security.md).
- **Feature flags:** capabilities gated per plan/tenant/rollout.
- **Idempotency:** all inbound events (orders, webhooks, payment callbacks) processed idempotently to prevent double-counting commissions.
- **Observability:** structured logs, metrics, and system-health surface in Admin Console.

## What is deliberately deferred

Framework, language, database engine, hosting, queue/eventing technology, and physical tenancy strategy are **not** decided here. They are recorded as **open build-phase decisions** in [../DECISIONS.md](../DECISIONS.md). This document constrains only the *logical* architecture.
