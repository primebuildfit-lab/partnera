import { type AffiliateRank, type AssetStatus, type LicenseStatus, RANK_ORDER } from "./vocab";

/**
 * Rank-unlock resolution: deterministic and explainable. An affiliate can access
 * an asset only if every hard rule holds (published, licensed, enrolled, good
 * standing) AND a matching rank-unlock rule grants access with no deny override.
 * The affiliate can always be told *why* an asset is locked and what unlocks it.
 */
export interface AssetAccessContext {
  readonly affiliateRank: AffiliateRank;
  readonly enrolled: boolean;
  readonly inGoodStanding: boolean;
  readonly assetStatus: AssetStatus;
  readonly licenseStatus: LicenseStatus;
  readonly licenseAllowsAffiliateDistribution: boolean;
}

export interface RankUnlockRuleView {
  readonly minRank: AffiliateRank;
  /** Explicit per-affiliate overrides (deny wins over any grant). */
  readonly denied?: boolean;
  /** Extra conditions already evaluated by the caller (e.g. region/date). */
  readonly conditionsPass?: boolean;
}

export type AccessDecision =
  | { readonly granted: true }
  | { readonly granted: false; readonly reason: string; readonly requiredRank?: AffiliateRank };

/** Hard access rules that must hold regardless of rank ([CONTENT_ACCESS_SECURITY]). */
export function passesHardRules(ctx: AssetAccessContext): AccessDecision {
  if (!ctx.enrolled) return { granted: false, reason: "not_enrolled" };
  if (!ctx.inGoodStanding) return { granted: false, reason: "not_in_good_standing" };
  if (ctx.assetStatus !== "published") return { granted: false, reason: "asset_not_published" };
  if (ctx.licenseStatus !== "active" && ctx.licenseStatus !== "expiring") {
    return { granted: false, reason: "license_inactive" };
  }
  if (!ctx.licenseAllowsAffiliateDistribution) {
    return { granted: false, reason: "license_forbids_affiliate_distribution" };
  }
  return { granted: true };
}

/** Does an affiliate's rank meet a required minimum? */
export function rankMeets(affiliate: AffiliateRank, min: AffiliateRank): boolean {
  return RANK_ORDER[affiliate] >= RANK_ORDER[min];
}

/**
 * Resolve access for one asset given the hard-rule context and the set of
 * rank-unlock rules that match it. Deny overrides win; otherwise the most
 * permissive satisfied rule grants access. Returns the required rank when locked
 * purely by rank, so the UI can show "reach Gold to unlock".
 */
export function resolveAssetAccess(
  ctx: AssetAccessContext,
  rules: readonly RankUnlockRuleView[],
): AccessDecision {
  const hard = passesHardRules(ctx);
  if (!hard.granted) return hard;

  if (rules.some((r) => r.denied)) {
    return { granted: false, reason: "explicit_deny_override" };
  }
  if (rules.length === 0) {
    return { granted: false, reason: "no_matching_rule" };
  }

  let lowestRequired: AffiliateRank | undefined;
  for (const rule of rules) {
    if (rule.conditionsPass === false) continue;
    if (rankMeets(ctx.affiliateRank, rule.minRank)) {
      return { granted: true };
    }
    if (lowestRequired === undefined || RANK_ORDER[rule.minRank] < RANK_ORDER[lowestRequired]) {
      lowestRequired = rule.minRank;
    }
  }
  return { granted: false, reason: "rank_too_low", requiredRank: lowestRequired };
}
