# Content Library — Creator Marketplace

> **Part 7 (library half).** The approved-content library: how approved deliverables
> become organized, licensed, reusable **Content Assets**. Rank-gated distribution is in
> [RANK_UNLOCKS.md](RANK_UNLOCKS.md); access enforcement in
> [CONTENT_ACCESS_SECURITY.md](CONTENT_ACCESS_SECURITY.md).

## 1. What enters the library

Only **approved** deliverables, and only per their **Content License**. A rejected,
drafted, disputed, or expired-license item is **never** an affiliate-visible asset. An
asset is derived from an approved `SubmissionVersion` and carries a pointer back to it for
provenance and dispute reference.

## 2. Organization dimensions

Every Content Asset is catalogued along these dimensions (all tenant-scoped):

`business · brand · campaign · product · creator · content_type · platform · language ·
audience · country · status · license · expiration · affiliate_rank · performance`

These support filtering, rank-unlock rules, analytics, and license enforcement. Assets can
be grouped into **collections / campaign kits** (e.g. "Summer Launch Kit") for bundled
affiliate distribution.

## 3. Content License (rights the business holds in the asset)

Carried from the deliverable's rights fields ([DELIVERABLE_MODEL.md](DELIVERABLE_MODEL.md#3-commercial--rights)):

- `scope` — owned channels / paid ads / affiliate distribution / organic only
- `exclusivity` — none / category / full
- `geographic_rights` — allowed regions
- `permitted_platforms` — where the asset may be used
- `license_duration` — start/end; drives `expiring`/`expired`
- `whitelisting` — ad-account/handle rights, if granted
- `attribution/credit` obligations, if any

The license **governs downstream affiliate use**: an affiliate can only use an asset in
ways the license permits (platforms, geography, duration). Defaults are conservative and
counsel-gated (D-320/D-335, OQ-20).

## 4. Asset lifecycle

`pending → published → (restricted) → withdrawn/expired` (see
[STATE_MACHINES.md](STATE_MACHINES.md#6-content-asset--license-library)). Publishing to the
library is a distinct business action after approval; a business can approve-and-pay a
deliverable **without** publishing it (e.g. a one-off ad), or publish later.

## 5. Access tiers (who sees what)

| Audience | Sees |
|---|---|
| Business staff (scoped) | Drafts of rules, pending assets, published, restricted, internal-only source (if permitted) |
| Affiliate (enrolled, by rank) | **Published** assets whose rank unlock they meet, license `active`/`expiring`, within permitted platforms/geo |
| Creator (author) | Their own submitted/approved items and where they've been published (transparency), never other creators' or the business's internal files |
| Partnera moderator | Access only via audited moderation/dispute basis |

Affiliates **never** access: drafts, rejected content, expired/revoked licenses, content
outside their business, assets above their rank, internal-only files, or creator-private
source material. Enforced structurally — see [CONTENT_ACCESS_SECURITY.md](CONTENT_ACCESS_SECURITY.md).

## 6. Reuse & performance

- Approved assets can be reused across campaigns within the same business and license.
- **Performance** signals (affiliate downloads, uses, and — where attribution is wired —
  attributed sales) are tracked per asset and per creator, feeding
  [ANALYTICS.md](ANALYTICS.md) and creator reputation. Attribution method is open (OQ-32),
  reusing the existing tracking spine.

## 7. Storage seam

Asset bytes live behind a provider-independent storage/CDN seam (D-319): upload,
scanning, transcoding, thumbnailing, **signed time-limited access URLs**, and retention.
No storage provider is chosen here. Access is always brokered by the application layer with
a permission + license + rank check — never a public or guessable URL.
