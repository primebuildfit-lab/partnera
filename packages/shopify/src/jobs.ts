import { type TenantId } from "@partnera/core";
import { type JobId } from "./ids";

/**
 * Durable background-job contract (Part 18). A hosted app cannot do everything in
 * the web request: webhook processing, attribution, notifications, and (later) AI
 * evaluation and payout orchestration run as jobs with retries, idempotency,
 * per-tenant fairness, and a dead-letter state. This defines the contract + a
 * reference in-memory queue; production uses a durable queue behind the same port.
 */
export const JOB_KINDS = [
  "webhook.process",
  "attribution.resolve",
  "notification.deliver",
  "opportunity.transition",
  "content.process_metadata",
  "storage.sync",
  // Activated later (external-gated):
  "ai.evaluate",
  "payment.orchestrate",
  "email.deliver",
] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "dead_letter";

export interface Job {
  readonly id: JobId;
  readonly tenantId: TenantId | null;
  readonly kind: JobKind;
  /** Idempotency key: enqueuing the same key twice is a no-op. */
  readonly idempotencyKey: string;
  readonly status: JobStatus;
  readonly attempts: number;
  readonly maxAttempts: number;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly enqueuedAt: Date;
  readonly updatedAt: Date;
  readonly lastError: string | null;
}

export const JOB_MAX_ATTEMPTS = 5;

/** Port for a durable job queue. The in-memory implementation is the reference. */
export interface JobQueue {
  enqueue(job: Job): Promise<boolean>; // false if the idempotency key already exists
  claim(): Promise<Job | null>;
  complete(id: JobId): Promise<void>;
  fail(id: JobId, error: string): Promise<void>;
  list(tenantId?: TenantId): Promise<readonly Job[]>;
}
