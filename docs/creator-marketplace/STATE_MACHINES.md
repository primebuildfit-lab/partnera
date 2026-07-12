# State Machines — Creator Marketplace

> **Part 4 (state half).** Every state and legal transition for the module's lifecycles.
> Terminal states are marked ⬛. Illegal transitions must be rejected structurally
> (an append-guard analogous to `assertAppendable`), not by convention. All transitions
> emit domain events ([API_AND_EVENTS.md](API_AND_EVENTS.md)) and are audited.

Principles (inherited): deterministic (inject `Clock`); idempotent transitions on
money-affecting steps; separation of duties on approve/authorize/execute; append-only —
"undo" is a compensating transition, never a mutation of history.

---

## 1. Opportunity

States: `draft` · `scheduled` · `open` · `paused` · `closed` · `cancelled` ⬛ · `archived` ⬛

| From | To | Guard |
|---|---|---|
| draft | scheduled | valid requirements + budget + review config; start time set |
| draft | open | valid + publish now |
| draft | cancelled | — |
| scheduled | open | start time reached |
| scheduled | cancelled | before start |
| open | paused | business action; existing jobs continue |
| paused | open | resume |
| open | closed | deadline reached or budget exhausted or manual |
| paused | closed | manual |
| closed | archived | after all jobs resolved |
| cancelled | archived | after cleanup |

Rules: cannot re-open a `closed`/`cancelled` opportunity (create a new one). `cancelled`
requires resolving in-flight jobs (withdraw/settle). Budget exhaustion auto-`closed`.

---

## 2. Application / participation (creator ↔ opportunity)

States: `eligible` · `applied` · `invited` · `accepted` · `rejected` ⬛ · `withdrawn` ⬛ · `blocked` ⬛

| From | To | Guard |
|---|---|---|
| eligible | applied | creator applies; opportunity open |
| eligible | invited | business invites |
| applied | accepted | business accepts **or** open-auto-accept |
| applied | rejected | business declines |
| applied | withdrawn | creator withdraws |
| invited | accepted | creator accepts terms → **fee snapshot locks**, Job opens |
| invited | withdrawn | creator declines / expires |
| eligible/applied/invited/accepted | blocked | trust-safety action (fraud/ban) |

`accepted` is the only state that opens a **Creator Job**. `blocked` overrides all and is
terminal for that relationship (subject to appeal).

---

## 3. Submission

States: `draft` · `uploaded` · `validating` · `under_review` · `revision_requested` ·
`resubmitted` · `approved` ⬛ · `rejected` ⬛ · `disputed` · `expired` ⬛ · `archived` ⬛

| From | To | Guard |
|---|---|---|
| draft | uploaded | files attached; assigned to business/campaign/opportunity/deliverable |
| uploaded | validating | automated safety checks start |
| validating | under_review | safety pass |
| validating | rejected | safety hard-fail (malware/CSAM/format) |
| under_review | revision_requested | reviewer requests changes; allowance remains |
| under_review | approved | decision approve (creates payable + optionally library asset) |
| under_review | rejected | decision reject |
| revision_requested | resubmitted | creator uploads a new **version** |
| resubmitted | validating | re-run safety on new version |
| under_review/revision_requested | expired | deadline passed with no valid submission |
| approved/rejected | disputed | dispute opened within window |
| disputed | approved | dispute resolved in creator's favour |
| disputed | rejected | dispute upheld |
| rejected/approved/expired | archived | retention/cleanup |

Versioning: each `resubmitted` creates a new `SubmissionVersion`; the submission's current
version pointer advances. History is append-only. `approved` is idempotent — a second
approve is a no-op, not a double-pay.

---

## 4. Payment (per payable deliverable/milestone)

States: `not_eligible` · `pending_approval` · `approved` · `scheduled` · `processing` ·
`paid` ⬛ · `failed` · `cancelled` ⬛ · `reversed` ⬛ · `disputed`

| From | To | Guard |
|---|---|---|
| not_eligible | pending_approval | submission enters review |
| pending_approval | approved | **content approved** (D-305) |
| pending_approval | cancelled | job cancelled/withdrawn before approval |
| approved | scheduled | payment authorized (SoD); payout timing chosen |
| approved | cancelled | pre-payout cancellation (rare; audited) |
| scheduled | processing | payout run starts (provider) |
| processing | paid | provider confirms disbursement |
| processing | failed | provider failure |
| failed | scheduled | retry |
| failed | cancelled | give up (audited) |
| paid | reversed | refund/chargeback/dispute resolution → compensating events |
| approved/scheduled/paid | disputed | dispute opened |
| disputed | approved/scheduled | resolved to pay |
| disputed | reversed | resolved to reverse |

Money invariants: no state before `approved` moves money; `platform_fee.recognized` and
`creator net` are computed at authorization from the **locked snapshot**; `reversed`
includes **platform-fee reversal**; every transition is an **append** to the ledger.

---

## 5. Dispute

States: `open` · `evidence` · `under_moderation` · `resolved_creator` ⬛ ·
`resolved_business` ⬛ · `resolved_split` ⬛ · `withdrawn` ⬛ · `escalated`

| From | To | Guard |
|---|---|---|
| open | evidence | both sides invited to submit evidence within window |
| evidence | under_moderation | window closed / both submitted |
| under_moderation | resolved_* | moderator decision (recused if conflicted) |
| under_moderation | escalated | policy/legal/law-enforcement threshold |
| open/evidence | withdrawn | initiator withdraws |
| escalated | resolved_* | after escalation handling |

Resolutions drive §4 payment transitions via compensating events; all evidence and
decisions are retained for audit ([TRUST_SAFETY_AND_DISPUTES.md](TRUST_SAFETY_AND_DISPUTES.md)).

---

## 6. Content Asset / License (library)

Asset: `pending` · `published` · `restricted` · `expired` ⬛ · `withdrawn` ⬛
License: `active` · `expiring` · `expired` ⬛ · `revoked` ⬛

| From | To | Guard |
|---|---|---|
| asset.pending | published | approved + license active + business publishes to library |
| published | restricted | business narrows access / hold |
| restricted | published | re-open |
| published/restricted | withdrawn | business removes (affiliates lose access) |
| license.active | expiring | approaching end date (notify) |
| expiring | expired | end date reached → asset auto-locks for affiliates |
| active/expiring | revoked | dispute/violation → immediate lock |

An asset is affiliate-visible **only** while `published` **and** license `active|expiring`
**and** the affiliate meets the rank unlock ([RANK_UNLOCKS.md](RANK_UNLOCKS.md)).
