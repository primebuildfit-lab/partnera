/**
 * @partnera/application — permission-aware use-cases (the application/API core).
 *
 * Each service takes an authenticated {@link import("@partnera/core").RequestContext},
 * resolves the effective principal, enforces permissions (deny-by-default),
 * scopes every access to the context's tenant (never client input), and audits
 * sensitive actions. Services orchestrate the domain engines over the
 * persistence repositories — this is the layer an HTTP/NestJS delivery adapter
 * calls. See docs/23-persistence.md.
 */
export * from "./context";
export * from "./services";
