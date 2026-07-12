/**
 * @partnera/fraud-engine — signals, configurable risk scoring, and review cases.
 *
 * Money is held and routed to review, never silently deleted. Scores are
 * explainable; platform hard floors protect the whole network. Future AI scoring
 * plugs in behind the same signal → score → action contract.
 * See docs/08-fraud-engine.md.
 */
export * from "./signals";
export * from "./scoring";
export * from "./cases";
