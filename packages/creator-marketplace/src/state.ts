import { type Result, err, ok, IllegalStateError } from "@partnera/core";
import {
  type ApplicationStatus,
  type AssetStatus,
  type DisputeStatus,
  type LicenseStatus,
  type OpportunityStatus,
  type PaymentStatus,
  type SubmissionStatus,
} from "./vocab";

/**
 * Pure state machines for the module's lifecycles. Each map lists the legal
 * successor states for a given state; illegal transitions are rejected with an
 * {@link IllegalStateError} *before* any persistence write (the same discipline
 * the commission ledger's `assertAppendable` uses). Terminal states have no
 * successors. These functions are deterministic and dependency-free.
 */
export type TransitionMap<S extends string> = Readonly<Record<S, readonly S[]>>;

export function canTransition<S extends string>(map: TransitionMap<S>, from: S, to: S): boolean {
  return (map[from] ?? []).includes(to);
}

/** Guarded transition: returns the target state, or an IllegalStateError. */
export function transition<S extends string>(
  map: TransitionMap<S>,
  entity: string,
  from: S,
  to: S,
): Result<S, IllegalStateError> {
  if (from === to) return ok(to);
  if (!canTransition(map, from, to)) {
    return err(
      new IllegalStateError(`Illegal ${entity} transition: ${from} -> ${to}`, { from, to }),
    );
  }
  return ok(to);
}

export function isTerminal<S extends string>(map: TransitionMap<S>, state: S): boolean {
  return (map[state] ?? []).length === 0;
}

// --- Opportunity ---
export const OPPORTUNITY_TRANSITIONS: TransitionMap<OpportunityStatus> = {
  draft: ["scheduled", "open", "cancelled"],
  scheduled: ["open", "cancelled"],
  open: ["paused", "closed"],
  paused: ["open", "closed"],
  closed: ["archived"],
  cancelled: ["archived"],
  archived: [],
};

// --- Application / participation ---
export const APPLICATION_TRANSITIONS: TransitionMap<ApplicationStatus> = {
  eligible: ["applied", "invited", "blocked"],
  applied: ["accepted", "rejected", "withdrawn", "blocked"],
  invited: ["accepted", "withdrawn", "blocked"],
  accepted: ["blocked"],
  rejected: [],
  withdrawn: [],
  blocked: [],
};

// --- Submission ---
export const SUBMISSION_TRANSITIONS: TransitionMap<SubmissionStatus> = {
  draft: ["uploaded"],
  uploaded: ["validating"],
  validating: ["under_review", "rejected"],
  under_review: ["revision_requested", "approved", "rejected", "expired"],
  revision_requested: ["resubmitted", "expired"],
  resubmitted: ["validating"],
  approved: ["disputed", "archived"],
  rejected: ["disputed", "archived"],
  disputed: ["approved", "rejected"],
  expired: ["archived"],
  archived: [],
};

// --- Payment (per payable deliverable/milestone) ---
export const PAYMENT_TRANSITIONS: TransitionMap<PaymentStatus> = {
  not_eligible: ["pending_approval"],
  pending_approval: ["approved", "cancelled"],
  approved: ["scheduled", "cancelled", "disputed"],
  scheduled: ["processing", "disputed"],
  processing: ["paid", "failed"],
  paid: ["reversed", "disputed"],
  failed: ["scheduled", "cancelled"],
  cancelled: [],
  reversed: [],
  disputed: ["approved", "scheduled", "reversed"],
};

// --- Dispute ---
export const DISPUTE_TRANSITIONS: TransitionMap<DisputeStatus> = {
  open: ["evidence", "withdrawn"],
  evidence: ["under_moderation", "withdrawn"],
  under_moderation: ["resolved_creator", "resolved_business", "resolved_split", "escalated"],
  escalated: ["resolved_creator", "resolved_business", "resolved_split"],
  resolved_creator: [],
  resolved_business: [],
  resolved_split: [],
  withdrawn: [],
};

// --- Content asset ---
export const ASSET_TRANSITIONS: TransitionMap<AssetStatus> = {
  pending: ["published", "withdrawn"],
  published: ["restricted", "withdrawn", "expired"],
  restricted: ["published", "withdrawn"],
  expired: [],
  withdrawn: [],
};

// --- License ---
export const LICENSE_TRANSITIONS: TransitionMap<LicenseStatus> = {
  active: ["expiring", "revoked", "expired"],
  expiring: ["expired", "revoked"],
  expired: [],
  revoked: [],
};
