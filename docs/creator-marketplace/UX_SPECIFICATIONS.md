# UX Specifications — Creator Marketplace

> **Part 18 (screens half).** Screen specifications for all four perspectives. Navigation is
> in [NAVIGATION.md](NAVIGATION.md). Reuses the existing responsive/accessible SSR shell
> (`@partnera/web`, D-215): sidebar on desktop, `<details>` menu on mobile, app switcher,
> skip link, ARIA landmarks, `aria-current`. Every screen is permission-gated.

## Per-screen contract (applies to all screens)

Each screen defines: **user**, **purpose**, **information hierarchy**, **primary action**,
**secondary action(s)**, **empty state**, **loading state**, **error state**, **permission
state** (what a viewer without the permission sees), **mobile** and **desktop** behaviour,
**accessibility**. Global defaults below; per-screen tables list only the notable specifics.

**Global states**
- *Loading*: skeletons for data regions; never block the whole shell; SSR renders content
  without JS.
- *Error*: inline, actionable, non-destructive; `DomainError`-mapped messages; retry where safe.
- *Permission*: gated nav items are hidden; a directly-navigated forbidden route shows a
  clear "no access" panel, never partial data.
- *Empty*: purpose-specific `EmptyState` with the primary call-to-action.
- *Accessibility*: landmarks, focus management, keyboard-operable controls, labelled forms,
  sufficient contrast in light/dark, `aria-current` on active nav — the platform baseline.
- *Mobile*: single-column, collapsible nav, touch targets; data-dense tables scroll in their
  own container. *Desktop*: multi-column, sidebar, denser tables.

---

## Platform Admin

| Screen | Purpose | Info hierarchy | Primary / secondary |
|---|---|---|---|
| Marketplace overview | Network health at a glance | KPIs (GMV, fees, approval/dispute/fraud rates, liquidity) → trends → alerts | Drill into a metric / configure |
| Businesses | Manage tenants running creator programs | List → status/verification → detail | Restrict/verify / view audit |
| Creators | Manage creators network-wide | List → standing/verification/reputation → detail | Suspend/verify / view (audited) |
| Jobs | Cross-tenant job monitoring (audited) | Filters → job → submission trail | Open moderation / export |
| Submissions | Moderation queue | Queue → safety flags → detail | Handle / escalate |
| Moderation | Cases | Queue → case → evidence | Resolve / escalate |
| Disputes | Dispute resolution | Queue → dispute → evidence/history | Resolve (recused if conflicted) |
| Payments | Money oversight | Streams (payable/fee/payout/reversal) → item | Investigate / export |
| Fees | Global fee guardrails | Range + per-plan floors → history (versioned) | Update range (audited) |
| Analytics | Network analytics | Funnels + categories | Filter / export |
| Configuration | Global rules/entitlements | Flags, defaults, verification thresholds | Change (audited) |

## Business Owner

| Screen | Purpose | Info hierarchy | Primary / secondary |
|---|---|---|---|
| Creator dashboard | Program overview | Spend vs budget, submissions, approval/revision rates, best creators/assets | Create opportunity / review queue |
| Public-page builder | Brand the program page | Theme + blocks + preview | Publish / preview (signed) |
| Creator program | Configure program | Eligibility, defaults, branding | Save / activate |
| Opportunities | Manage opportunities | List → status/budget → detail | Publish / pause·close |
| Applications | Review applicants | List → creator profile/reputation | Accept·invite / reject |
| Submissions | Incoming work | Queue → version → files | Open review |
| Review workspace | Decide on a submission | Media + requirement checklist + scores + AI flags | Approve / request revision·reject |
| Payments | Authorize/track pay | Payables → fee + net → payout status | Authorize (SoD) / view receipt |
| Content library | Organize approved assets | Filters/dimensions → asset → license | Publish to library / withdraw |
| Affiliate unlock rules | Rank-gate assets | Rules → asset selector → min rank | Save rule / preview affiliate view |
| Analytics | Program performance | KPIs + attributed sales | Filter / export |
| Staff & permissions | Delegate | Members → roles/limits | Assign role / set caps |

**Review workspace specifics**: primary = Approve (guarded by SoD/limit); secondary = Request
revision, Reject. Shows the **versioned requirement spec** side-by-side with the media; AI
flags are advisory and labelled; approving reveals the **fee + net** that will post. Empty =
"no submissions to review". Permission = reviewers without approve see recommend-only.

## Creator

| Screen | Purpose | Info hierarchy | Primary / secondary |
|---|---|---|---|
| Discover companies | Find businesses to work with | Search/filter → company cards | Open company page |
| Company page | Understand a program | Hero + requirements + opportunities + payment | View opportunity |
| Opportunity listing | Browse opportunities | Filters (format/platform/budget/rights/deadline) → cards | Open detail |
| Opportunity detail | Decide to participate | Requirements, **payment + fee + net**, rights, deadline | Apply / accept terms |
| Application | Apply/accept | Terms + fee snapshot preview | Accept (locks snapshot) / cancel |
| Submission studio | Deliver work | Upload + assign business/campaign/deliverable + attestations | Submit / save draft |
| Revisions | Address feedback | Reviewer notes + prior version | Resubmit new version |
| Earnings | Track money | Gross/fees/net + payout history | View receipt / payout settings (external) |
| Portfolio | Showcase | Items + formats/platforms | Add item |
| Reputation | Standing | Score + explanation + ratings | — |
| Notifications | Updates | Critical vs optional | Manage prefs |
| Settings | Profile/payout | Skills, formats, payout provider link (external) | Save |

**Opportunity detail specifics**: the **fee + net must be shown before Accept**; Accept is
the state-changing action that locks the fee snapshot and opens a job. Empty listing = "no
matching opportunities". Error on accept (e.g. opportunity closed) = clear, non-destructive.

## Affiliate

| Screen | Purpose | Info hierarchy | Primary / secondary |
|---|---|---|---|
| Company content library | Use approved content | Filters → unlocked vs locked → asset | Download·use / view usage rules |
| Rank status | Understand access | Current rank + next-tier unlocks | View requirements |
| Unlocked assets | Grab usable content | Grid → asset → license/platforms/expiry | Download (signed) |
| Locked assets | See what's ahead | Grid with required rank per asset | View how to unlock |
| Campaign kits | Bundled assets | Kit → contents | Download kit |
| Downloads | History | List → asset → usage rules | Re-download (re-checked) |
| Content performance | What converts | Per-asset clicks/conversions/sales | Filter |

**Library specifics**: locked assets show the **required rank** (or are hidden if the tier is
private); every download mints a **short-lived signed URL** after a live rank+license check;
expired/revoked assets disappear immediately. Empty = "no content unlocked yet — reach
[rank] to unlock".

## Cross-cutting

- Dual creator/affiliate users switch via the app switcher; each app enforces its own scope.
- Money figures always show **gross / fee / net** transparently; the fee is never hidden.
- Outward-facing/irreversible actions (publish page, approve, authorize/execute payment,
  withdraw asset) require explicit confirmation and appropriate permission, and are audited.
