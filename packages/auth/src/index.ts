/**
 * @partnera/auth — identity, tenancy, and the configurable RBAC engine.
 *
 * Contains the domain shapes for users/businesses/memberships/sessions and the
 * permission engine. It deliberately does NOT implement login, token issuance,
 * or an auth provider — those are delivery-layer concerns for a later module.
 */
export * from "./identity";
export * from "./session";
export * from "./permissions";
export * from "./roles";
export * from "./policy";
