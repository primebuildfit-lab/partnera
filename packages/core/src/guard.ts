import { InvariantViolation } from "./errors";

/**
 * Assert a condition that must hold. Throws {@link InvariantViolation} if not.
 * For *expected* bad input, return a `ValidationError` Result instead of guarding.
 */
export function invariant(
  condition: unknown,
  message: string,
  details?: Record<string, unknown>,
): asserts condition {
  if (!condition) {
    throw new InvariantViolation(message, details);
  }
}

/**
 * Exhaustiveness helper for discriminated unions. Reaching this at runtime means
 * a variant was added without handling — the compiler flags it at build time.
 */
export function assertNever(value: never, context = "value"): never {
  throw new InvariantViolation(`Unhandled ${context}: ${JSON.stringify(value)}`);
}
