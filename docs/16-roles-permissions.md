# 16 — Identity, Tenancy, Roles & Permissions

> The foundation every engine rests on. Get isolation and permissions right and the rest is safe; get them wrong and no other correctness matters.

## Identity model

- **User** — a single person with one global identity/login. A user may participate in many contexts.
- **Membership** — connects a User to a Business (or Organization) with a **Role**. One user → many memberships.
- **Context switching** — a user acts "as" one business at a time; permissions apply within that context.

> A person who is an affiliate for three businesses and staff at a fourth is **one User** with four memberships — not four accounts.

## Tenancy model

- **Organization** (optional) — top grouping (agency / multi-brand). Owns Businesses.
- **Business (Tenant)** — the isolation boundary. Every operational record belongs to exactly one business.
- **Isolation invariant:** no read/write crosses tenants except (a) explicit, audited platform-operator paths, and (b) agreed **partnership** data-sharing. Enforced at the data-access layer, not left to callers.

## Role tiers

| Tier | Examples | Scope |
|---|---|---|
| **Platform roles** | Super-admin, Ops, Finance, Trust & Safety, Support | The whole network (Admin Console). |
| **Organization roles** | Org owner, Org admin | Across owned businesses. |
| **Business roles** | Owner, Admin, Manager, Finance, Marketer, Support | One tenant (Business Dashboard). |
| **Affiliate role** | Affiliate / Partner rep | Their own portal data, scoped to programs. |
| **Contributor role** | Extension developer | Developer/marketplace surface. |

## Permission model (RBAC, configurable)

- **Permissions** are granular capabilities: `offers.create`, `offers.simulate`, `affiliates.approve`, `payouts.approve`, `payouts.execute`, `fraud.review`, `partnerships.manage`, `settings.edit`, `apikeys.manage`, etc.
- **Roles** are named permission sets. System roles ship sensible defaults; businesses may create **custom roles** (configuration over code — consistent with the platform philosophy).
- **Least privilege** everywhere, including platform operators.
- **Sensitive permissions** (payout execution, permission changes, impersonation, kill-switch) are separated and audited.

## Separation-of-duties (money safety)

- The person who **approves** commissions/withdrawals should be separable from the one who **executes** payouts (configurable, recommended default).
- Offer creation vs. offer activation can be split.
- These are configurable but the platform recommends/enforces sane defaults on money paths.

## Impersonation & support access

- Support/operators may act on a tenant's behalf **only** through an explicit, time-boxed, **audited** impersonation path. Never silent.

## Authentication (design-level)

- Strong auth for all surfaces; **2FA** available/enforceable, especially for money and admin roles.
- API access via scoped **API keys** (per tenant/integration), revocable, audited.
- Session management, device/session visibility in Security settings.
- Specific auth providers/mechanisms are a build-phase decision.

## Audit

- Every permission change, role assignment, impersonation, and money action writes to the **immutable audit log** ([18-security.md](18-security.md)), scoped to tenant and visible to platform operators.

## Invariants

1. **One person = one User**, many memberships.
2. **Every operational record is tenant-scoped**; isolation enforced centrally.
3. **RBAC governs every action**; least privilege by default.
4. **Money paths support separation-of-duties.**
5. **Cross-tenant access is explicit, audited, and rare** (operator path or agreed partnership).

## Open decisions (see DECISIONS.md)
- Auth stack/provider (build phase).
- Which money-path separations are enforced vs. recommended.
- Custom-role limits per plan.
- Physical tenant-isolation strategy (schema-per-tenant vs. shared) — build phase.
