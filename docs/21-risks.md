# 21 — Risk Register & Self-Review

> Output of a deliberate self-review pass over the whole design set. Each item: the risk, why it matters, and the mitigation/decision that addresses it (or flags it as open). Severity: 🔴 high · 🟠 medium · 🟡 watch.

## A. Contradictions found & reconciled

| # | Issue | Resolution |
|---|---|---|
| A1 | Payments doc assumes payouts happen; partnerships doc assumes business-to-business settlement — both depend on custodial status, which is **provisionally non-custodial**. | Reconciled: partnership settlement inherits D-050 (non-custodial) as the default; netting/direct-transfer mechanics are an explicit open decision (D-107-adjacent). Flagged, not silently assumed. |
| A2 | "Affiliate" appears as both a person and an entity distinct from **User**. | Reconciled in [03-data-model.md](03-data-model.md): **User** is the person; **Affiliate** is a program-participation profile linked to a User via Enrollment. One person = one User. |
| A3 | Cross-tenant isolation ("no cross-tenant data") vs. partnerships (sharing across businesses). | Reconciled: partnerships are the **one sanctioned, consented, minimal** cross-tenant path; isolation invariant explicitly carves this out ([16](16-roles-permissions.md), [09](09-partnerships.md)). |
| A4 | "Approvals" surfaces in Admin, Business dashboard, and as a concept. | Not a contradiction — different scopes (platform-level vs. tenant-level). Confirmed consistent. |

## B. Missing functionality identified

| # | Gap | Severity | Mitigation |
|---|---|---|---|
| B1 | **No data import / migration design.** Businesses (incl. PrimeBuild) may arrive with existing affiliates, links, and historical commissions from other platforms (Refersion, UpPromote, etc.). | 🟠 | Add "Onboarding & Migration" to a future doc/phase; treat historical-commission import carefully (ledger integrity). Tracked as roadmap item (Phase 1/2). |
| B2 | **Notification, Analytics, and Integration engines lack dedicated deep-dive docs** (covered only in architecture). | 🟡 | Acceptable at design stage; flagged for expansion when they enter a build phase. Their contracts are defined in [02-architecture.md](02-architecture.md). |
| B3 | **Localization / multi-language / multi-currency UX** not addressed for a global platform. | 🟠 | Multi-currency invariant exists in [06](06-commission-engine.md); i18n/l10n added as an explicit future concern (Phase 5, D-112). |
| B4 | **Accessibility (a11y)** not addressed. | 🟡 | Add as a build-phase UX standard for all three surfaces. |
| B5 | **SLA / uptime / disaster-recovery** expectations for a money platform undocumented. | 🟠 | Flag for build phase; money platforms need explicit RPO/RTO and incident SLAs. |
| B6 | **Coupon issuance mechanics vary per commerce platform** — attribution assumes coupons can be created/observed. | 🟠 | Integration adapter contract must state coupon capabilities per platform; platforms lacking them fall back to link/session attribution. Noted in [05](05-tracking-engine.md)/[02](02-architecture.md). |

## C. Business risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| C1 | **PrimeBuild gravity** — pressure to build PrimeBuild-specific features contaminates the platform. | 🔴 | D-002 (platform-first) is the standing guardrail; every request framed as "how would any business express this?" |
| C2 | **Chargeback-after-payout loss** — affiliate paid, order later refunded/charged-back, affiliate never earns again → unrecoverable loss (worse if custodial). | 🟠 | Clawback windows, maturation before "available," net-forward policy ([06](06-commission-engine.md)); non-custodial default limits platform exposure. |
| C3 | **Two-sided cold start** — value needs businesses *and* affiliates. | 🟠 | PrimeBuild seeds tenant side; marketplace/partnership network effects designed for later phases. |
| C4 | **Marketplace/extension liability & quality** could damage trust. | 🟠 | Mandatory approval, kill-switch, scope disclosure, contributor agreement ([10](10-extensions.md)). |

## D. Security risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| D1 | **Cross-tenant leakage.** | 🔴 | Central isolation enforcement, tested as invariant ([18](18-security.md)). |
| D2 | **Untrusted extension code.** | 🔴 | No arbitrary execution; declarative-first + sandbox + least privilege ([10](10-extensions.md)). |
| D3 | **Money-path tampering / double payout.** | 🔴 | Append-only ledger, idempotency, at-most-once disbursement, separation-of-duties ([06](06-commission-engine.md),[07](07-payments-payouts.md)). |
| D4 | **Operator insider risk.** | 🟠 | Least privilege for operators, audited impersonation, separated ops roles ([12](12-admin-console.md),[16](16-roles-permissions.md)). |
| D5 | **API key / account takeover.** | 🟠 | Scoped revocable keys, 2FA on money/admin roles, session management ([18](18-security.md)). |

## E. Scalability risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| E1 | **Deriving balances from a growing event log** gets expensive at scale. | 🟠 | Design allows balance **snapshots/materialized views** derived from the immutable log (build-phase optimization; invariant "balances derive from events" preserved). |
| E2 | **Attribution/tracking volume** (clicks) at thousands of tenants. | 🟠 | Event-driven backbone + adapters designed to scale independently; retention limits on raw signals ([05](05-tracking-engine.md)). |
| E3 | **Physical tenancy strategy** (shared vs. per-tenant) affects scale & isolation. | 🟠 | Deferred (D-102) but logical contract holds; decision made with scale data in build phase. |

## F. Legal & compliance risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| F1 | **Custodial money movement → money-transmission/e-money regulation.** | 🔴 | Provisional **non-custodial** default (D-050); explicit counsel-gated decision (D-106) before any custodial build ([19](19-legal-compliance.md)). |
| F2 | **Privacy (GDPR/CCPA)** for tracking data; controller/processor ambiguity. | 🔴 | Data minimization, consent-aware tracking, coupon fallback, data-subject rights, DPAs; controller/processor stance is open (D-113). |
| F3 | **Tax reporting** obligations for affiliate earnings. | 🟠 | KYC/tax gating before payout; open who reports (D-105/D-108 area). |
| F4 | **Automated fraud decisions** affecting payouts may implicate automated-decision rules. | 🟠 | Human-review path + explainability retained ([08](08-fraud-engine.md)). |
| F5 | **Affiliate-marketing disclosure laws.** | 🟡 | Provide disclosure guidance/tools to affiliates ([19](19-legal-compliance.md)). |

## G. Fraud risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| G1 | **Multi-level/level commissions enable referral rings.** | 🟠 | Bound level depth; ring/graph detection; platform fraud floors ([08](08-fraud-engine.md)); depth-bounding is an open offer-engine decision. |
| G2 | **Coupon leakage / public abuse.** | 🟠 | Coupon-abuse signals, caps/limits blocks on offers, review queue. |
| G3 | **Self-purchase & duplicate accounts.** | 🟠 | Identity/device/payment cross-referencing within privacy limits; risk scoring. |
| G4 | **Refund farming.** | 🟠 | Clawback + maturation + rising risk score on refund patterns. |

## H. Future migration risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| H1 | **Deferred stack/db/host decisions** could constrain later choices. | 🟡 | Logical architecture is technology-agnostic; contracts (not implementations) are fixed, keeping options open. |
| H2 | **Importing historical money data** risks ledger integrity. | 🟠 | Treat imports as explicit, marked ledger events with provenance; never as editable balances (ties to B1). |
| H3 | **Adding commerce platforms later** must not require core changes. | 🟡 | Adapter contract isolates platform specifics ([02](02-architecture.md)); validated by keeping the pilot platform behind the same adapter as everyone else. |

## I. Duplicate ideas / consolidation

- "Approvals," "Reports/Analytics," and "Security/Settings" recur across surfaces — confirmed intentional (scoped per surface), not redundant.
- Contributor, partnership, and affiliate money all reuse **one ledger spine** — deliberate consolidation, not duplication (avoids parallel money systems).

## J. Incomplete sections (accepted for design phase)

- Deep specs for Notification/Analytics/Integration engines (B2).
- Onboarding/migration (B1).
- i18n/a11y/SLA (B3–B5).

These are **knowingly** left at contract-level for Phase 0 and scheduled for their build phases — not oversights.

---

## Self-review verdict

The design is **internally consistent** after reconciling A1–A4, with the biggest **open, must-decide-before-build** items being: **custodial vs. non-custodial (F1/D-106)**, **privacy controller/processor stance (F2/D-113)**, and the **standard build-stack decisions (D-100–D-104)**. No blocking contradiction remains; identified gaps are scheduled rather than ignored.
