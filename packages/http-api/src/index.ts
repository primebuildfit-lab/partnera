/**
 * @partnera/http-api — the delivery layer (HTTP surface) over the application
 * services. Transport-agnostic and dependency-free: a NestJS/Express host adapts
 * its request into {@link HttpRequest} and calls {@link Router.handle}. All
 * authorization, tenancy, validation, and audit live in the application layer,
 * so this stays a thin, uniform mapping. See docs/23-persistence.md.
 */
export * from "./router";
export * from "./routes";
