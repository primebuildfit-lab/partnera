# 12 — Admin Console (Platform Operators)

> The Admin Console is how **we** (Partnera operators) run the entire network. It sits above all tenants and every engine. **Desktop-first, responsive second.** Everything the platform does should be operable from here.

## Audience

Platform Operators (super-admin, operations, finance, trust & safety, support) — **not** tenants. Access is role-gated and every sensitive action is audited.

## Sections

Grouped for navigation; each is a first-class area.

### Command & overview
- **Overview** — network health, KPIs (tenants, GMV attributed, commissions, payouts, fraud), alerts.
- **System Health** — engine status, queues, error rates, integrations health.
- **Logs** — searchable platform logs.
- **Audit History** — immutable trail of sensitive actions across the platform.

### Tenants & people
- **Businesses** — all tenants: status, plan, activity, drill-in.
- **Users** — platform-wide user directory.
- **Permissions** — platform roles & permission management.
- **Support** — tickets, impersonation (audited), assistance.
- **Moderation** — flagged content, disputes, abuse reports.

### Program operations (platform-level oversight)
- **Affiliate Programs** — across tenants (oversight, not day-to-day management).
- **Affiliates** — network-wide affiliate view (cross-tenant fraud patterns).
- **Invitations / Applications** — platform-level visibility.
- **Offers / Offer Builder** — inspect offers; manage platform-provided templates.
- **Campaigns** — oversight of campaigns network-wide.
- **Partnerships** — oversight, dispute escalation, moderation.

### Marketplace & extensions
- **Extensions** — registry, versions, scopes, kill-switch.
- **Marketplace** — listings, featuring, curation.
- **Approvals** — the review queue for extensions/templates/partnerships/high-risk items.

### Money
- **Commissions** — platform-wide ledger views, reconciliation.
- **Payments / Withdrawals** — payout batches, holds, rail status, reconciliation.
- **Licensing** — plans, entitlements, tenant licenses.

### Trust
- **Fraud** — cross-tenant fraud cases, risk dashboards, platform floors, escalations.
- **Security** — security posture, keys, incident tooling.

### Analytics & comms
- **Reports** — platform business intelligence.
- **Analytics** — deep metrics across engines.
- **Notifications / Emails** — templates, delivery health, broadcasts.

### Platform configuration
- **Integrations** — commerce-platform adapters, provider status.
- **API Keys** — platform & tenant key oversight.
- **Feature Flags** — capability gating & rollouts.
- **Configuration** — global platform settings, policies (fraud floors, payout rules, contributor policy).

## Cross-cutting expectations

- **Everything manageable from here** — no capability requires backend-only access for routine ops.
- **Audited** — sensitive actions (impersonation, payout override, kill-switch, permission change) leave a trail.
- **Scoped roles** — finance ≠ trust & safety ≠ support; least privilege for operators too.
- **Tenant-isolation respected** — cross-tenant views exist only through explicit, audited operator paths.

## Design priority
Desktop-first (dense, data-heavy operator workflows). Responsive support for on-call/mobile checks second. No framework or UI stack chosen here.
