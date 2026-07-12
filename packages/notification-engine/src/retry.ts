import { type DeliveryStatus, type QueuedNotification } from "./notifications";

/**
 * Retry policy for delivery. Exponential backoff with a ceiling; after
 * `maxAttempts` the notification is dead-lettered for inspection rather than
 * lost. Pure and deterministic (jitter is injected, not random-by-default) so it
 * is testable.
 */
export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 1000,
  maxDelayMs: 60 * 60 * 1000,
};

/** Backoff delay before attempt N (1-based): base * 2^(N-1), capped. */
export function backoffMs(attempt: number, policy: RetryPolicy): number {
  const exp = policy.baseDelayMs * 2 ** Math.max(0, attempt - 1);
  return Math.min(exp, policy.maxDelayMs);
}

/**
 * Compute the next state of a notification after a failed send: either scheduled
 * for a retry with a backoff delay, or dead-lettered once attempts are exhausted.
 */
export function planRetry(
  notification: QueuedNotification,
  policy: RetryPolicy,
  now: Date,
): QueuedNotification {
  const attempts = notification.attempts + 1;
  if (attempts >= policy.maxAttempts) {
    const dead: DeliveryStatus = "dead_letter";
    return { ...notification, attempts, status: dead, nextAttemptAt: null };
  }
  const delay = backoffMs(attempts, policy);
  return {
    ...notification,
    attempts,
    status: "failed",
    nextAttemptAt: new Date(now.getTime() + delay),
  };
}
