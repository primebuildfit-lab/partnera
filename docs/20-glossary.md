# 20 — Glossary

Shared terminology for Partnera. When docs disagree with this list, this list wins (or the doc is a bug).

| Term | Meaning |
|---|---|
| **Partnera** | The platform itself; the standalone multi-tenant SaaS. |
| **Tenant / Business** | A customer of Partnera; the isolation boundary for all operational data. |
| **PrimeBuild** | The **first tenant** only. Not special in the design. |
| **Organization** | Optional grouping of businesses (agency, multi-brand). |
| **User** | A single person with one global identity; may hold many memberships. |
| **Membership** | Link between a User and a Business/Org, carrying a Role. |
| **Role / Permission** | RBAC constructs governing what a member can do. |
| **Affiliate** | An individual who promotes a business for rewards. |
| **Partner** | A **business** collaborating with another business. |
| **Affiliate Program** | A business's configured program affiliates join. |
| **Enrollment** | An affiliate's membership in a specific program. |
| **Application / Invitation** | Requests/offers to join a program. |
| **Offer** | A configured commercial rule set built from Blocks; determines commissions. |
| **Block** | A composable building unit of an offer (scope/condition/calculation/reward/schedule/limit). |
| **Offer Engine** | Evaluates offers against events to produce commission instructions. |
| **Campaign** | A time-bounded promotional context. |
| **Partnership** | A B2B relationship between businesses with agreed terms/splits. |
| **Referral Link** | A trackable link attributing conversions to an affiliate. |
| **Coupon** | A discount code used for attribution (works cookieless). |
| **Click / Session** | Tracked touch points feeding attribution and fraud. |
| **Conversion** | An attributed value event (usually an order) credited to an affiliate/campaign. |
| **Attribution** | The determination of who gets credit for a conversion, and why (the "basis"). |
| **Commission** | Money owed for a conversion, recorded in the ledger. |
| **Ledger** | Append-only record of all money events; balances are derived from it. |
| **Balance** | Derived money state: pending / available / locked / paid / reversed. |
| **Clawback / Reversal** | Adjustment when an order is refunded/returned/fraudulent. |
| **Withdrawal / Payout** | Affiliate cashing out available balance; disbursement via a rail. |
| **Payout Batch** | A grouped disbursement run. |
| **Rail** | A payout mechanism behind an adapter (bank, PayPal, gift-card, store-credit…). |
| **Risk Signal / Score** | Fraud observations and their aggregate. |
| **Review Queue** | Where flagged items await human decision. |
| **Extension** | A contributed, approved, sandboxed/declarative capability. |
| **Manifest** | An extension's declaration of type, hooks, and scopes. |
| **Contributor** | A developer/business submitting extensions; earns commissions per policy. |
| **Marketplace** | Where approved offers/templates/extensions are discovered & installed. |
| **Adapter** | An integration boundary to a commerce platform or external system. |
| **Integration Engine** | Normalizes external platform events into internal ones. |
| **Feature Flag** | Capability gate (plan/tenant/rollout). |
| **Entitlement** | What a plan grants (features + limits). |
| **Audit Log** | Immutable record of sensitive actions. |
| **Custodial vs. non-custodial** | Whether Partnera holds/moves funds (major legal fork). |
| **Isolation invariant** | The rule that no data crosses tenants except via audited/agreed paths. |
