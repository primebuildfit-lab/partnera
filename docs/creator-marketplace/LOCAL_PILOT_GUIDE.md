# Local Pilot Guide — PrimeBuild Creator Operations

> How Brian runs the PrimeBuild creator-content pilot **locally**. Everything here is
> local and simulated — **no real money, no external providers, no deployment**. This
> complements the root [INSTALL.md](../../INSTALL.md).

## Start the app

```bash
pnpm install
pnpm --filter @partnera/web serve      # bundles + serves at http://localhost:4000
# or, on Windows, the launcher / desktop shortcut:  .\scripts\partnera.ps1 open
```

First run seeds the PrimeBuild pilot through the **real services** (money spine runs;
payouts SIMULATED). Data persists to `.partnera/data.json` and survives restart.

## Sign in (dev provider — no password; local only)

| Role | Email | Opens |
|---|---|---|
| Business owner | `owner@primebuild.test` | Business → **Creators** |
| Finance | `finance@primebuild.test` | authorizes/executes creator payments |
| Creator (Cora) | `cora@creators.test` | **Creator Portal** |
| Affiliate (Brian) | `brian@primebuild.test` | Affiliate → **Content Library** |
| Platform admin | `admin@partnera.test` | Admin Console |

## Fastest path

Sign in as owner → **Business → Creators**. A **first-run checklist** shows what's left to set
up (dismissible/reopenable); **Setup guide** walks the 10 configuration steps. The tiles show
what needs attention today (Awaiting review · Waiting on budget/capacity · Budget remaining ·
Awaiting publication). Nav labels are commercial: **Reviews**, **Queue**, **Payments**,
**Content Library**.

## The 15-step pilot (as owner unless noted)

1. **Configure PrimeBuild's category payments** — Business → Creators → **Program Setup**.
   Edit any category's payment inline (seeded $0 / $10 / $20 / $35 — *PrimeBuild's own*, editable).
   Note the banner: "Partnera does not determine creator compensation."
2. **Set the accepted-content limit** — Program Setup shows capacity; the seed sets a pilot cap.
3. **Set the budget** — Program Setup → Budget (seeded tight so a waiting-for-budget item appears);
   see committed / paid / remaining / **projected Partnera fee** / total cost.
4. **Publish an opportunity** — Creators → Opportunities → Publish (several are seeded).
5. **Creator submits** — sign in as Cora → Creator Portal → Discover → Apply → Accept terms
   (fee locks) → My Jobs → upload (demo metadata only).
6. **Run simulated AI review** — Creators → Review Workspace shows two advisory scores
   (technical + commercial) + a recommended category (mock, labelled).
7. **Select the category manually** — pick from your scheme in the Review Workspace.
8. **See payment and fee** — the workspace shows, per category, creator payment / Partnera fee /
   business total / creator net.
9. **Approve or queue** — confirm a category. If over budget/capacity it enters the **Waiting
   Queue** (honest status), never auto-rejected. A low-score category can be retained
   **internal only**.
10. **Authorize simulated payment** — finance signs in → Creators → **Payments**. The seed
    leaves one **approved** payable; open the **Authorize payment…** confirmation (which shows
    creator pay / Partnera fee / business total / creator net) and confirm. Separation of duties:
    the approver cannot authorize. No money moves.
11. **Execute simulated payout** — finance → **Pay now…** (confirm). Simulated — no real money.
12. **Publish content to library** — Creators → Content Library → Publish to library.
13. **Assign affiliate ranks** — a rank-unlock rule is seeded; approved content is rank-gated.
14. **View from the affiliate portal** — sign in as Brian → Affiliate → Content Library:
    unlocked vs locked by rank.
15. **Restart & confirm persistence** — stop and restart; the app loads existing data
    (config, budget, dispositions, payables all survive).

## Waiting queue (Part 4)

Creators → **Waiting Queue** lists items `waiting_for_budget` / `waiting_for_capacity` /
`internal_only` etc. Actions: **Promote to review**, **Keep internal**, **Archive**. Nothing is
promised payment while waiting; creators see honest statuses.

## Backup, restore & data status

- **Back up** before editing pilot data: `partnera backup` → `.partnera/backups/data-<ts>.json`.
- **Restore**: `partnera restore` (newest) or `partnera restore data-<ts>.json` (app stopped).
- **Data status**: sign in as admin → **Admin → Data status** (`/admin/data`) — storage mode,
  data-file location, last save, record counts, PrimeBuild pilot status, and a live integrity
  check. Full detail: [PRIMEBUILD_PILOT_DATA_STATUS.md](PRIMEBUILD_PILOT_DATA_STATUS.md).
- **Operational pilot checklist**: Business → Creators → **Pilot checklist** — 11 go-live items;
  progress is persisted and survives restart.
- The **platform-fee %** is now editable per program (Program Setup → Platform fee, 2–4%) and is
  a persisted record that drives every money display and the acceptance snapshot.

## What stays simulated / disconnected

Payouts (`SIMULATED-*`), AI review (deterministic mock), content storage (metadata only),
billing (provisional plans, no charges), promotional channels (disclosed, no paid media). Real
providers, Shopify install, production DB, and deployment are **external gates — not started**.
