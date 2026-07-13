# UX Audit — Partnera Creator Operations (local)

> **Part 1.** Findings from operating the running app locally (bundled server, all four
> perspectives signed in, every creator route driven). Severity: **Critical** (blocks a
> normal user / misleads), **High** (significant friction), **Medium** (clarity), **Low**,
> **Enhancement**. Fixes landed in this phase are marked ✅; deferred items are in
> [UX_RELEASE_STATUS.md](UX_RELEASE_STATUS.md).

## Method
Bundled `@partnera/web`, seeded PrimeBuild pilot, signed in as owner / creator (Cora) /
affiliate (Brian) / admin, and drove every route, scanning rendered HTML for architecture
jargon, single-click money actions, weak empty states, and density.

## Findings

| # | Sev | Area | Finding | Fix |
|---|---|---|---|---|
| A1 | **Critical** | All pages (shell) | Session box shows **"Tenant member"** — internal multi-tenancy term on every screen. | ✅ Relabel to role-friendly ("Partnera staff" / "Team member"). |
| A2 | **Critical** | Creator → Earnings | Description exposed **"append-only creator-payment ledger"**. | ✅ Plain-language rewrite. |
| A3 | **High** | Business → Commissions/Balances | "Append-only ledger" / "Derived from the ledger — never stored as mutable numbers". | ✅ Commercial wording. |
| A4 | **High** | Admin → Health | Health check labelled **"Ledger integrity"**. | ✅ "Payments integrity". |
| A5 | **Critical** | Business → Creator Payments | **Single click authorizes/executes** a (simulated) payout — no confirmation; violates "no accidental single click authorizes payment". | ✅ `<details>` confirm step with the money breakdown + "Simulated — no money moved". |
| A6 | **High** | Business → Creator Payments | Money not itemised (only "Gross"); creator payment vs Partnera fee vs business total vs creator net not shown. | ✅ Per-payable money breakdown. |
| A7 | **High** | Business → Creators (home) | Dashboard mixes generic counts; no first-run guidance, no waiting-for-budget / waiting-for-capacity / remaining-budget / awaiting-publication focus (Part 2). | ✅ Focused tiles + dismissible first-run checklist. |
| A8 | **Medium** | Navigation | Developer-ish labels ("Creator Dashboard", "Review Queue", "Waiting Queue", "Configuration"). | ✅ Commercial labels (Overview, Reviews, Queue, Settings…). |
| A9 | **Medium** | Business setup | Program Setup is a single dense page; no guided wizard (Part 5). | ✅ Stepped **Setup** wizard page linking each step. |
| A10 | **Medium** | Empty states | Several bare empties ("No published assets", "No payables yet") lack the next action (Part 14). | ✅ Empty states with an explicit next step. |
| A11 | **Low** | Library (business) | No filters / grid; affiliate view already simpler. | Deferred (enhancement) — noted in release status. |
| A12 | **Low** | Publish to library | Single-click publish (changes distribution). | ✅ Confirm step (same pattern as payments). |
| A13 | **Enhancement** | Visual system | `Flash`/`PostButton` duplicated across pages; fine but could centralise. | Deferred (non-blocking). |

## Cross-cutting (verified acceptable)
- Accessibility baseline present: skip link, ARIA landmarks, `aria-current`, semantic headings,
  labelled fields, responsive sidebar (`<details>` menu on mobile). Kept and extended; confirm
  disclosures are keyboard-operable native elements.
- Tenant isolation, permission-gated nav, simulated-payment labels: intact.
- No stack traces in normal UI (error path renders a friendly page).

## Result
All Critical and High findings fixed this phase (A1–A7, A12). Selected Medium fixed (A8–A10).
Low/Enhancement deferred and recorded. Re-verified live across all four roles + restart.
