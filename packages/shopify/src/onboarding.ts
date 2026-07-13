import { type BusinessId, type Result, type TenantId, err, IllegalStateError, ok } from "@partnera/core";
import { type OnboardingId } from "./ids";

/**
 * Merchant onboarding state (Part 9), persisted so a merchant can leave and
 * resume. Ordered steps with per-step completion; the wizard reads/writes this
 * record rather than holding progress in the browser.
 */
export const ONBOARDING_STEPS = [
  "purpose", // affiliate / creator / both / internal / later
  "business_identity",
  "affiliate_setup",
  "creator_setup",
  "evaluation_categories",
  "budget_capacity",
  "content_storage",
  "team_permissions",
  "plan_trial",
  "review_activate",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingPurpose = "affiliate" | "creator" | "both" | "internal" | "later";

export interface OnboardingState {
  readonly id: OnboardingId;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly purpose: OnboardingPurpose | null;
  readonly completed: Readonly<Record<string, boolean>>;
  readonly activated: boolean;
  readonly updatedAt: Date;
}

/** Steps that don't apply given the chosen purpose (skipped, still valid to finish). */
export function applicableSteps(purpose: OnboardingPurpose | null): OnboardingStep[] {
  return ONBOARDING_STEPS.filter((s) => {
    if (s === "affiliate_setup") return purpose === "affiliate" || purpose === "both";
    if (s === "creator_setup" || s === "evaluation_categories" || s === "budget_capacity") {
      return purpose === "creator" || purpose === "both" || purpose === "internal";
    }
    return true;
  });
}

/** Fraction complete (0–1) over the applicable steps for the chosen purpose. */
export function onboardingProgress(state: OnboardingState): number {
  const steps = applicableSteps(state.purpose);
  if (steps.length === 0) return 0;
  const done = steps.filter((s) => state.completed[s]).length;
  return Math.round((done / steps.length) * 100) / 100;
}

/** May the merchant activate? Every applicable step (except review) must be done. */
export function canActivate(state: OnboardingState): Result<true, IllegalStateError> {
  const required = applicableSteps(state.purpose).filter((s) => s !== "review_activate");
  const missing = required.filter((s) => !state.completed[s]);
  if (state.purpose === null) return err(new IllegalStateError("Choose a purpose before activating", {}));
  if (missing.length > 0) return err(new IllegalStateError(`Onboarding incomplete: ${missing.join(", ")}`, { missing }));
  return ok(true);
}
