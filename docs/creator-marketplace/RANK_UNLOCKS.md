# Rank Unlocks — Creator Marketplace

> **Part 7 (rank half).** How businesses gate approved content to affiliates by rank.
> Config-driven (D-003/D-308): rank unlock rules are **data**, reusable across campaigns.

## 1. Concept

A **Rank Unlock Rule** binds a **set of assets** (by filter or explicit list) to a
**minimum affiliate rank** plus optional **conditions**. An affiliate who meets the rule
gains access to those assets (subject to license + platform/geo + expiration). Ranks reuse
the existing affiliate tiering where possible (OQ-40); content-specific ranks are a fallback.

## 2. Example ladder (illustrative, business-configurable)

| Rank | Typical unlocks |
|---|---|
| **Bronze** | Generic images, approved logos, basic captions |
| **Silver** | Short videos, product-specific assets, promotional templates |
| **Gold** | Premium UGC, campaign kits, early-access content |
| **Elite** | Exclusive creator content, unreleased campaigns, high-performing assets, custom collaborations |

Ranks, their names, and what each unlocks are entirely the business's choice; the ladder
above is a starter, not a fixed model.

## 3. Rule shape

`RankUnlockRule`:
- `businessId` (tenant)
- `assetSelector` — filter (by campaign/product/type/collection/tag) **or** explicit asset ids
- `minRank` — the rank at/above which access is granted
- `conditions?` — e.g. active enrollment, good standing, region match, date window,
  performance threshold, agreement accepted
- `overrides?` — explicit grant/deny for specific affiliates (audited)
- `priority` — resolution order when rules overlap
- `status` — draft / active / paused

Rules are **reusable and composable**: one rule can cover many assets; one asset can be
covered by several rules (most-permissive-wins unless an explicit deny override applies).

## 4. Resolution algorithm (deterministic)

For an affiliate + asset:
1. Asset must be `published`, license `active|expiring`, not `expired|revoked|withdrawn`.
2. Affiliate must be enrolled in the business and in good standing.
3. Collect matching rules; apply explicit **deny** overrides first (deny wins).
4. Grant if any remaining matching rule's `minRank ≤ affiliate rank` **and** all
   `conditions` pass.
5. Otherwise the asset is **locked**, shown with the **required rank** so the affiliate
   understands how to unlock it.

Deterministic and explainable: the affiliate can always see *why* an asset is locked and
what would unlock it.

## 5. Affiliate experience

- **Unlocked** assets: downloadable/usable, with usage rules, permitted platforms, and
  expiration shown.
- **Locked** assets: visible as locked with the rank/condition required (or hidden if the
  business marks the whole tier private) — motivates progression.
- Rank changes re-resolve access immediately (gain or lose), always audited.

## 6. Guardrails

- Rank unlocks **never** expose drafts, rejected, internal-only, expired, or cross-tenant
  content — rank is an **additional** gate on top of the hard access rules
  ([CONTENT_ACCESS_SECURITY.md](CONTENT_ACCESS_SECURITY.md)), never a bypass.
- A license that forbids affiliate distribution overrides any rank unlock (license wins).
- Downgrading a rank or expiring a license **immediately** revokes access; already-signed
  URLs are short-lived and re-checked (D-319).
