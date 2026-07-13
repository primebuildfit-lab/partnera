# PrimeBuild Pilot — Data Status

> **Day 1.13.** What of the PrimeBuild pilot is actually **persisted** in Partnera's local
> data model versus still produced by seed/UI, where it lives, how to back it up and restore
> it, and the integrity status. Local only — no external database, no cloud, no providers.

## Storage

- **Mode:** single local JSON file (no external DB). Written atomically after every mutation
  and on shutdown; loaded on start.
- **Location:** `.partnera/data.json` (override with `PARTNERA_DATA`).
- **Backups:** `.partnera/backups/data-<timestamp>.json` (via the launcher — see below).
- **Data version:** 1. **Admin view:** Admin Console → **Data status** (`/admin/data`) shows
  mode, file, last save, record counts, PrimeBuild pilot status, and a live integrity check —
  in plain language, no secrets or private creator content.

## What is persisted (a real record, survives restart)

| Area | Persisted collection(s) |
|---|---|
| PrimeBuild business, users, memberships, roles | `businesses`, `users`, `memberships`, `roles` |
| Creator Program + status | `creator_programs` |
| **Evaluation scheme** (categories, descriptions, payments, ordering, eligibility) | `evaluation_schemes` |
| **Acceptance capacity** | `program_capacities` |
| **Budget** (+ reserved) | `program_budgets` |
| **Platform-fee rate** (editable, validated 2–4%) | `program_fee_settings` ← *new; was hardcoded* |
| Trial state + provisional plans | `business_trials`, `business_plans` |
| Opportunities + deliverables | `content_opportunities`, `deliverable_requirements` |
| Creator profiles + per-business relationships | `creator_profiles`, `creator_relationships` |
| Applications + **fee snapshots** (immutable) | `creator_applications` |
| Submissions + **append-only versions** | `submissions`, `submission_versions` |
| Reviews (technical/commercial-derived + human decision) | `submission_reviews` |
| **Waiting queue + dispositions** (independent pay/quality/reuse) | `submission_dispositions` |
| Payments + **append-only money events** | `creator_payments`, `creator_ledger_events` |
| Content assets + licenses + rank access | `content_assets`, `content_licenses`, `rank_unlock_rules` |
| **Operational pilot checklist progress** | `pilot_checklists` ← *new; was UI/cookie* |
| Audit + notifications | `audit_log`, `notifications` |

All of the above round-trip through the durable snapshot (verified by test and by a live
edit → restart → restore cycle).

## What is still seeded / UI-only (intentionally)

- **First-run *setup* checklist** (business home) is **derived** from real state (program/scheme/
  budget/capacity present, opportunities open, etc.); its *dismissal* is a UI cookie
  (`pt_cm_checklist`). The **operational pilot checklist** (Part 6) *is* persisted.
- **Demo world contents** are produced by the seed **through the real services** on first run,
  then persisted — they are editable records afterwards, not constants. Re-running does not
  re-seed (load-or-seed).
- **AI scores** are computed on demand by the deterministic **mock** (advisory, never stored as
  authority); the resulting **human decision** and category are persisted.

## Editable by PrimeBuild

Category names, descriptions, payments, ordering, eligibility; acceptance capacity; budget;
**platform-fee %** (Program Setup → Platform fee); review categories/scheme; opportunities.
These belong to **PrimeBuild only** — the platform default scheme is a single generic "Approved"
category, and a fresh/foreign program never inherits PrimeBuild's $0/$10/$20/$35.

## Backup & restore

```bash
# Windows
.\scripts\partnera.ps1 backup            # copies data.json -> .partnera/backups/data-<ts>.json
.\scripts\partnera.ps1 restore           # restores the newest backup (stops the app first)
.\scripts\partnera.ps1 restore data-YYYYMMDD-HHMMSS.json   # restore a specific backup

# macOS/Linux
./scripts/partnera.sh backup
./scripts/partnera.sh restore [filename]
```

Restore replaces `.partnera/data.json` while the app is stopped; the next start loads it.
**Verified live:** back up → edit fee to 4% + budget to $999 + tick a checklist item → restart
(edits survived) → restore original backup (fee back to 3%, checklist back to 0/11).

## Integrity status

Deterministic, read-only check (Admin → Data status): no duplicate programs (per business+slug),
at most one scheme per program with non-empty unique-key categories, fee within 2–4%, no
cross-tenant dispositions. It **reports** issues and **never deletes** uncertain records.
Current pilot: **OK — 0 issues**.

## Remaining external gates (not started)

Real payment provider / billing, external AI, Shopify install, production database, public
deployment, legal/commercial launch. All money and AI remain **simulated** locally.
