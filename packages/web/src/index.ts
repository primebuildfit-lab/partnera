/**
 * @partnera/web — the delivery/presentation layer: three server-rendered React
 * apps (Business Dashboard, Affiliate Portal, Admin Console) over the existing
 * application services. Thin presentation only — the domain remains the single
 * source of truth. See docs/24-delivery-ux.md.
 */
export * from "./auth";
export * from "./nav";
export * from "./format";
export * from "./render";
export * from "./components";
export * from "./shell";
export * from "./page";
export * from "./demo";
export { handle, type WebRequest, type WebResponse } from "./app";
