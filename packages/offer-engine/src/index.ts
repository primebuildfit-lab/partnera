/**
 * @partnera/offer-engine — the configurable offer engine foundation.
 *
 * Blocks (data) + a deterministic evaluator that turns an offer and a conversion
 * into an explainable commission instruction. This is the *engine*, not any
 * particular business's offers. See docs/04-offer-engine.md.
 */
export * from "./blocks";
export * from "./offer";
export * from "./context";
export * from "./evaluator";
export * from "./validators";
export * from "./templates";
