/**
 * Domain error hierarchy.
 *
 * Every error carries a stable machine-readable `code` (for logging, i18n, and
 * API surfaces) plus optional structured `details`. Transport/HTTP mapping is a
 * concern of the delivery layer, not the domain — but `httpStatusHint` lets that
 * layer translate consistently without a giant switch statement.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  /** Advisory HTTP status for delivery layers; the domain never depends on it. */
  abstract readonly httpStatusHint: number;
  readonly details: Readonly<Record<string, unknown>>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = new.target.name;
    this.details = Object.freeze({ ...details });
    // Preserve prototype chain when targeting ES2022 downlevel scenarios.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON(): Record<string, unknown> {
    return { name: this.name, code: this.code, message: this.message, details: this.details };
  }
}

/** Input failed a business/schema rule. */
export class ValidationError extends DomainError {
  readonly code = "validation_error";
  readonly httpStatusHint = 422;
}

/** A referenced entity does not exist (or is not visible to the caller). */
export class NotFoundError extends DomainError {
  readonly code = "not_found";
  readonly httpStatusHint = 404;
}

/** The action conflicts with current state (e.g. duplicate, version mismatch). */
export class ConflictError extends DomainError {
  readonly code = "conflict";
  readonly httpStatusHint = 409;
}

/** The caller is authenticated but not permitted to perform the action. */
export class PermissionDeniedError extends DomainError {
  readonly code = "permission_denied";
  readonly httpStatusHint = 403;
}

/** The action is not allowed by the current lifecycle/state machine. */
export class IllegalStateError extends DomainError {
  readonly code = "illegal_state";
  readonly httpStatusHint = 409;
}

/**
 * A broken invariant — a programmer error, never expected in normal operation.
 * Distinct from {@link ValidationError}, which represents expected bad input.
 */
export class InvariantViolation extends DomainError {
  readonly code = "invariant_violation";
  readonly httpStatusHint = 500;
}
