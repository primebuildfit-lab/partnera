import { Money } from "@partnera/core";
import { describe, expect, it } from "vitest";
import { DeterministicMockReviewer, mayAutoApprove } from "./ai";
import { resolveAssetAccess, type AssetAccessContext } from "./rank";
import { computeReputation } from "./reputation";
import { scoreSubmission } from "./scoring";

describe("scoreSubmission", () => {
  const weights = { brief_compliance: 30, technical_quality: 20, brand_alignment: 20, creativity: 15, product_clarity: 10 };
  const cats = [
    { category: "brief_compliance" as const, score: 90 },
    { category: "technical_quality" as const, score: 80 },
    { category: "brand_alignment" as const, score: 85 },
    { category: "creativity" as const, score: 70 },
    { category: "product_clarity" as const, score: 90 },
  ];

  it("approves a high score with mandatory gates passing", () => {
    const r = scoreSubmission({ categories: cats, weights, mandatory: { legal_safety: true, file_requirements: true }, minApprovalScore: 70, rejectionThreshold: 50 });
    expect(r.ok && r.value.decision).toBe("approve");
  });

  it("rejects regardless of score when a mandatory gate fails", () => {
    const r = scoreSubmission({ categories: cats, weights, mandatory: { legal_safety: false, file_requirements: true }, minApprovalScore: 70, rejectionThreshold: 50 });
    expect(r.ok && r.value.decision).toBe("reject");
    expect(r.ok && r.value.mandatoryPassed).toBe(false);
    expect(r.ok && r.value.failedGates).toContain("legal_safety");
  });

  it("recommends revision in the middle band", () => {
    const mid = cats.map((c) => ({ ...c, score: 60 }));
    const r = scoreSubmission({ categories: mid, weights, mandatory: { legal_safety: true, file_requirements: true }, minApprovalScore: 70, rejectionThreshold: 50 });
    expect(r.ok && r.value.decision).toBe("revision");
  });
});

describe("resolveAssetAccess", () => {
  const okCtx: AssetAccessContext = {
    affiliateRank: "silver",
    enrolled: true,
    inGoodStanding: true,
    assetStatus: "published",
    licenseStatus: "active",
    licenseAllowsAffiliateDistribution: true,
  };

  it("grants when rank meets a matching rule", () => {
    expect(resolveAssetAccess(okCtx, [{ minRank: "bronze" }]).granted).toBe(true);
  });
  it("locks with the required rank when the affiliate is too low", () => {
    const d = resolveAssetAccess(okCtx, [{ minRank: "gold" }]);
    expect(d.granted).toBe(false);
    expect(!d.granted && d.reason).toBe("rank_too_low");
    expect(!d.granted && d.requiredRank).toBe("gold");
  });
  it("deny override wins over any grant", () => {
    const d = resolveAssetAccess(okCtx, [{ minRank: "bronze" }, { minRank: "bronze", denied: true }]);
    expect(d.granted).toBe(false);
    expect(!d.granted && d.reason).toBe("explicit_deny_override");
  });
  it("never leaks a draft or expired-license asset regardless of rank", () => {
    expect(resolveAssetAccess({ ...okCtx, assetStatus: "pending" }, [{ minRank: "bronze" }]).granted).toBe(false);
    expect(resolveAssetAccess({ ...okCtx, licenseStatus: "expired" }, [{ minRank: "bronze" }]).granted).toBe(false);
    expect(resolveAssetAccess({ ...okCtx, enrolled: false }, [{ minRank: "bronze" }]).granted).toBe(false);
  });
});

describe("computeReputation", () => {
  it("gives new creators a neutral standing", () => {
    const r = computeReputation({ jobsCompleted: 0, approved: 0, rejected: 0, revisionsRequested: 0, disputesLost: 0 });
    expect(r.tier).toBe("new");
    expect(r.score).toBe(50);
  });
  it("rewards a strong approval history", () => {
    const r = computeReputation({ jobsCompleted: 10, approved: 10, rejected: 0, revisionsRequested: 1, disputesLost: 0, avgBusinessRating: 4.8 });
    expect(r.score).toBeGreaterThanOrEqual(80);
  });
});

describe("AI mock reviewer", () => {
  const reviewer = new DeterministicMockReviewer();

  it("passes objective checks and never authorizes payment", () => {
    const run = reviewer.review({
      submissionVersionId: "v1",
      objective: { widthPx: 1080, heightPx: 1920, durationSec: 30, hasAudio: true, hasCta: true, language: "en" },
      requirement: { minWidthPx: 1080, minHeightPx: 1920, minDurationSec: 15, maxDurationSec: 60, requiresAudio: true, requiresCta: true, language: "en" },
    });
    expect(run.recommendation).toBe("approve");
    expect(run.authorizesPayment).toBe(false);
    expect(run.isMock).toBe(true);
  });

  it("abstains when a risk flag is present", () => {
    const run = reviewer.review({
      submissionVersionId: "v1",
      objective: { widthPx: 1080, heightPx: 1920 },
      requirement: { minWidthPx: 1080 },
      riskFlags: ["prohibited_claim"],
    });
    expect(run.recommendation).toBe("abstain");
  });

  it("mayAutoApprove is false outside bounded_automated mode and with flags", () => {
    const good = reviewer.review({ submissionVersionId: "v1", objective: { widthPx: 1080 }, requirement: { minWidthPx: 1080 } });
    const gross = Money.parse("40.00", "USD");
    const ceiling = Money.parse("50.00", "USD");
    expect(mayAutoApprove("human_only", good, gross, ceiling, true)).toBe(false);
    expect(mayAutoApprove("bounded_automated", good, gross, ceiling, true)).toBe(true);
    expect(mayAutoApprove("bounded_automated", good, Money.parse("60.00", "USD"), ceiling, true)).toBe(false);
    expect(mayAutoApprove("bounded_automated", good, gross, ceiling, false)).toBe(false);
  });
});
