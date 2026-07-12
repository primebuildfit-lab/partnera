# 18 — Security Architecture

> Partnera holds money-adjacent data across many businesses and pays real people. Security and trust are existential, not optional. This documents the **security posture and controls** at design level.

## Threat landscape

- **Cross-tenant data leakage** (the cardinal sin of multi-tenant SaaS).
- **Commission/payout fraud & manipulation** (covered operationally in [08-fraud-engine.md](08-fraud-engine.md)).
- **Money-path abuse** (double payouts, balance tampering).
- **Untrusted extension code** ([10-extensions.md](10-extensions.md)).
- **Account takeover** (affiliates, business admins, operators).
- **API key leakage / abuse.**
- **PII/financial data exposure.**
- **Insider risk** (operators with broad access).

## Core controls

### Tenant isolation
- Every operational record is tenant-scoped; isolation enforced centrally at the data-access layer.
- No cross-tenant read/write except audited operator paths and agreed partnership sharing.
- Isolation is tested as an invariant, not assumed.

### Identity & access
- Strong authentication; **2FA** available and enforceable (mandatory for money/admin roles by policy).
- **RBAC least-privilege** across all surfaces, including operators ([16-roles-permissions.md](16-roles-permissions.md)).
- **Separation-of-duties** on money paths (approve ≠ execute).
- Scoped, revocable **API keys**; session/device management.

### Money integrity
- **Append-only ledger**; balances derived, never edited ([06-commission-engine.md](06-commission-engine.md)).
- **Idempotency** on all money-affecting events (orders, conversions, payouts) to prevent double-counting/double-paying.
- **At-most-once disbursement.**
- No raw payment credentials stored (tokenized via rail adapters).

### Extension safety
- **No arbitrary code execution** in core; declarative-first; sandboxed exception path; least-privilege scopes; validated outputs; network-wide kill-switch.

### Data protection
- Encryption in transit and at rest (mechanisms decided in build phase).
- **Minimal collection** — capture only what attribution/fraud/payouts require.
- PII/financial data access is role-gated and audited.
- Secrets/keys managed securely (never in code/config in the clear).

### Audit & observability
- **Immutable audit log** for sensitive actions: money moves, permission/role changes, impersonation, extension kill-switch, config changes, offer/partnership approvals.
- Tenant-scoped and platform-wide views.
- Security-relevant logs monitored; system-health surface in Admin Console.

### Application security (design principles)
- Input validation everywhere; treat all external input (webhooks, extensions, user input) as untrusted.
- Idempotency & replay protection on inbound webhooks.
- Rate limiting & abuse protection on public endpoints (links, apply, API).
- Secure defaults; defense in depth.

## Incident readiness (design-level)

- Kill-switches (extensions, integrations, payouts) to contain incidents.
- Clear escalation & audit trail for security events.
- Breach/notification obligations tracked in [19-legal-compliance.md](19-legal-compliance.md).

## Invariants

1. **No cross-tenant access** outside audited/agreed paths.
2. **Least privilege**, including for operators.
3. **Money paths are idempotent, append-only, separated-duty.**
4. **No untrusted code in core.**
5. **Sensitive actions are audited immutably.**
6. **Minimal data collection; strong protection of what's collected.**

## Open decisions (see DECISIONS.md)
- Auth stack, encryption specifics, secrets management (build phase).
- Which controls are mandatory per plan vs. universal.
- Pen-test / security-review cadence before launch.
- Sandbox technology for extensions.
