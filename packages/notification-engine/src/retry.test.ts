import { asId, type NotificationId, type UserId } from "@partnera/core";
import { describe, expect, it } from "vitest";
import { isDeliverable, type QueuedNotification, renderTemplate } from "./notifications";
import { backoffMs, DEFAULT_RETRY_POLICY, planRetry } from "./retry";

describe("notification retry", () => {
  it("computes capped exponential backoff", () => {
    expect(backoffMs(1, DEFAULT_RETRY_POLICY)).toBe(1000);
    expect(backoffMs(2, DEFAULT_RETRY_POLICY)).toBe(2000);
    expect(backoffMs(3, DEFAULT_RETRY_POLICY)).toBe(4000);
    expect(backoffMs(100, DEFAULT_RETRY_POLICY)).toBe(DEFAULT_RETRY_POLICY.maxDelayMs);
  });

  it("schedules a retry then dead-letters after max attempts", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const base: QueuedNotification = {
      id: asId<NotificationId>("n1"),
      tenantId: null,
      recipientUserId: asId<UserId>("u1"),
      templateKey: "payout.completed",
      channel: "email",
      category: "transactional",
      data: {},
      status: "failed",
      attempts: 0,
      scheduledAt: now,
      nextAttemptAt: null,
    };
    const retried = planRetry(base, DEFAULT_RETRY_POLICY, now);
    expect(retried.status).toBe("failed");
    expect(retried.nextAttemptAt).not.toBeNull();

    const exhausted = planRetry({ ...base, attempts: 4 }, DEFAULT_RETRY_POLICY, now);
    expect(exhausted.status).toBe("dead_letter");
    expect(exhausted.nextAttemptAt).toBeNull();
  });
});

describe("notification helpers", () => {
  it("renders template tokens from data", () => {
    const body = renderTemplate(
      { key: "k", channel: "email", locale: "en", subject: null, body: "Hi {{name}}, ${{amount}}" },
      { name: "Sam", amount: "12.00" },
    );
    expect(body).toBe("Hi Sam, $12.00");
  });

  it("respects channel opt-out and muted categories", () => {
    const userId = asId<UserId>("u2");
    expect(
      isDeliverable({ userId, channelOptIn: { email: false }, mutedCategories: [] }, "email", "marketing"),
    ).toBe(false);
    expect(
      isDeliverable({ userId, channelOptIn: {}, mutedCategories: ["marketing"] }, "email", "marketing"),
    ).toBe(false);
    expect(isDeliverable(undefined, "email", "transactional")).toBe(true);
  });
});
