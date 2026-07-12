import { type NotificationId, type TenantId, type UserId } from "@partnera/core";

/**
 * Notification domain. Channels, templates, per-user preferences, and a queued
 * delivery model with retries and history. Email / in-app / push are the launch
 * channels; SMS and webhook are declared for the future behind the same model.
 * See docs/02-architecture.md (Notification Engine).
 */
export type Channel = "email" | "in_app" | "push" | "sms" | "webhook";

export const LAUNCH_CHANNELS: readonly Channel[] = ["email", "in_app", "push"];
export const FUTURE_CHANNELS: readonly Channel[] = ["sms", "webhook"];

export interface NotificationTemplate {
  readonly key: string;
  readonly channel: Channel;
  readonly locale: string;
  readonly subject: string | null;
  /** Body with `{{placeholder}}` tokens filled from a notification's `data`. */
  readonly body: string;
}

export interface NotificationPreference {
  readonly userId: UserId;
  readonly channelOptIn: Readonly<Partial<Record<Channel, boolean>>>;
  /** Category-level opt-outs (e.g. "marketing"), independent of transactional. */
  readonly mutedCategories: readonly string[];
}

export type DeliveryStatus = "queued" | "sending" | "delivered" | "failed" | "dead_letter";

export interface QueuedNotification {
  readonly id: NotificationId;
  readonly tenantId: TenantId | null;
  readonly recipientUserId: UserId;
  readonly templateKey: string;
  readonly channel: Channel;
  readonly category: string;
  readonly data: Readonly<Record<string, string>>;
  readonly status: DeliveryStatus;
  readonly attempts: number;
  readonly scheduledAt: Date;
  readonly nextAttemptAt: Date | null;
}

export interface DeliveryRecord {
  readonly notificationId: NotificationId;
  readonly channel: Channel;
  readonly status: DeliveryStatus;
  readonly attempt: number;
  readonly error: string | null;
  readonly at: Date;
}

/** Channel adapter contract; concrete providers (SES, APNs…) are build-phase. */
export interface ChannelAdapter {
  readonly channel: Channel;
  send(notification: QueuedNotification, template: NotificationTemplate): Promise<DeliveryRecord>;
}

/** Render a template body against a notification's data (missing tokens blank). */
export function renderTemplate(template: NotificationTemplate, data: Record<string, string>): string {
  return template.body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => data[key] ?? "");
}

/** Respect user preferences before queueing. */
export function isDeliverable(
  preference: NotificationPreference | undefined,
  channel: Channel,
  category: string,
): boolean {
  if (!preference) return true;
  if (preference.channelOptIn[channel] === false) return false;
  if (preference.mutedCategories.includes(category)) return false;
  return true;
}
