/**
 * @partnera/core — the platform kernel.
 *
 * Framework-agnostic primitives every engine and app depends on: money,
 * results, errors, ids, tenancy, events, time, and pagination. Nothing here
 * knows about HTTP, databases, or any specific business rule.
 */
export * from "./branded";
export * from "./result";
export * from "./errors";
export * from "./guard";
export * from "./currency";
export * from "./money";
export * from "./ids";
export * from "./tenant";
export * from "./clock";
export * from "./events";
export * from "./pagination";
