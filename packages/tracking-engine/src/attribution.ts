import { type AffiliateId, type CampaignId } from "@partnera/core";

/**
 * Attribution answers: "who gets credit for this conversion, and why?" Each
 * touch produces a claim; a resolver picks the winner under a configurable model
 * and window. Coupon attribution is first-class so the system degrades
 * gracefully in cookieless contexts. See docs/05-tracking-engine.md.
 */
export type AttributionBasis = "link" | "coupon" | "session";

export type AttributionModel = "last_touch" | "first_touch";

export interface AttributionClaim {
  readonly basis: AttributionBasis;
  readonly affiliateId: AffiliateId;
  readonly campaignId: CampaignId | null;
  readonly touchedAt: Date;
}

export interface AttributionResult {
  readonly affiliateId: AffiliateId;
  readonly campaignId: CampaignId | null;
  readonly basis: AttributionBasis;
  /** Which claim won and why, for auditability of disputed commissions. */
  readonly reason: string;
}

export interface AttributionPolicy {
  readonly model: AttributionModel;
  /** Validity window: claims older than this before the conversion are ignored. */
  readonly windowDays: number;
  /** Tie-breaking precedence when multiple valid claims share the winning time. */
  readonly precedence: readonly AttributionBasis[];
}

export const DEFAULT_ATTRIBUTION_POLICY: AttributionPolicy = {
  model: "last_touch",
  windowDays: 30,
  precedence: ["coupon", "link", "session"],
};

export interface AttributionResolver {
  resolve(
    claims: readonly AttributionClaim[],
    conversionAt: Date,
    policy: AttributionPolicy,
  ): AttributionResult | null;
}

/**
 * Reference resolver implementing last-touch / first-touch with a validity
 * window and deterministic precedence tie-breaking. Pure and side-effect free.
 */
export class DefaultAttributionResolver implements AttributionResolver {
  resolve(
    claims: readonly AttributionClaim[],
    conversionAt: Date,
    policy: AttributionPolicy,
  ): AttributionResult | null {
    const windowMs = policy.windowDays * 24 * 60 * 60 * 1000;
    const earliest = conversionAt.getTime() - windowMs;
    const valid = claims.filter(
      (c) => c.touchedAt.getTime() >= earliest && c.touchedAt.getTime() <= conversionAt.getTime(),
    );
    if (valid.length === 0) return null;

    const pick = policy.model === "last_touch" ? latest : earliestOf;
    let winner = valid[0]!;
    for (const claim of valid.slice(1)) {
      if (pick(claim, winner) === claim) {
        winner = claim;
      } else if (claim.touchedAt.getTime() === winner.touchedAt.getTime()) {
        // Same timestamp → break by configured precedence.
        if (rank(claim.basis, policy.precedence) < rank(winner.basis, policy.precedence)) {
          winner = claim;
        }
      }
    }

    return {
      affiliateId: winner.affiliateId,
      campaignId: winner.campaignId,
      basis: winner.basis,
      reason: `${policy.model}:${winner.basis}`,
    };
  }
}

function latest(a: AttributionClaim, b: AttributionClaim): AttributionClaim {
  return a.touchedAt.getTime() >= b.touchedAt.getTime() ? a : b;
}

function earliestOf(a: AttributionClaim, b: AttributionClaim): AttributionClaim {
  return a.touchedAt.getTime() <= b.touchedAt.getTime() ? a : b;
}

function rank(basis: AttributionBasis, precedence: readonly AttributionBasis[]): number {
  const idx = precedence.indexOf(basis);
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
}
