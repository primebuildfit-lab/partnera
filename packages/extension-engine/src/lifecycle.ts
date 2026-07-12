import { IllegalStateError } from "@partnera/core";

/**
 * Extension approval lifecycle and engine-compatibility checking. Every
 * submission is human-reviewed before publish; the platform can deprecate or
 * kill-switch a published extension network-wide. See docs/10-extensions.md.
 */
export type ApprovalState =
  | "submitted"
  | "in_review"
  | "approved"
  | "rejected"
  | "published"
  | "deprecated";

const APPROVAL_TRANSITIONS: Readonly<Record<ApprovalState, readonly ApprovalState[]>> = {
  submitted: ["in_review", "rejected"],
  in_review: ["approved", "rejected"],
  approved: ["published", "rejected"],
  published: ["deprecated"],
  rejected: [],
  deprecated: [],
};

export function canTransitionApproval(from: ApprovalState, to: ApprovalState): boolean {
  return APPROVAL_TRANSITIONS[from].includes(to);
}

export function transitionApproval(from: ApprovalState, to: ApprovalState): ApprovalState {
  if (!canTransitionApproval(from, to)) {
    throw new IllegalStateError(`Illegal approval transition ${from} → ${to}`, { from, to });
  }
  return to;
}

interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

function parse(version: string): SemVer | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/**
 * Minimal compatibility check supporting `^x.y.z` (same major, >= min) and
 * `>=x.y.z`. A full range grammar is a build-phase concern; this covers the
 * cases the manifest needs today without pulling in a dependency.
 */
export function isEngineCompatible(engineVersion: string, range: string): boolean {
  const engine = parse(engineVersion);
  if (!engine) return false;

  if (range.startsWith("^")) {
    const min = parse(range.slice(1));
    if (!min) return false;
    if (engine.major !== min.major) return false;
    return gte(engine, min);
  }
  if (range.startsWith(">=")) {
    const min = parse(range.slice(2));
    if (!min) return false;
    return gte(engine, min);
  }
  const exact = parse(range);
  return exact !== null && gte(engine, exact) && gte(exact, engine);
}

function gte(a: SemVer, b: SemVer): boolean {
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch >= b.patch;
}
