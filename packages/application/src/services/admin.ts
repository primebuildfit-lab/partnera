import {
  type AuditEntryId,
  type NotificationId,
  type RequestContext,
  type UserId,
  ValidationError,
} from "@partnera/core";
import { type AuditLogEntry } from "@partnera/platform";
import {
  type Channel,
  isDeliverable,
  type QueuedNotification,
} from "@partnera/notification-engine";
import { ServiceBase } from "../context";

/** Read/write tenant or platform configuration values. */
export class ConfigurationService extends ServiceBase {
  async get(ctx: RequestContext, key: string): Promise<unknown> {
    this.require(ctx, "settings.read");
    return this.uow.config.get(key, ctx.tenantId);
  }

  async set(ctx: RequestContext, key: string, value: unknown): Promise<void> {
    this.require(ctx, "settings.update");
    await this.uow.config.set(key, ctx.tenantId, value);
    await this.audit(ctx, "settings.update", "config", key, {});
  }
}

export interface EnqueueNotificationInput {
  readonly recipientUserId: UserId;
  readonly templateKey: string;
  readonly channel: Channel;
  readonly category: string;
  readonly data?: Readonly<Record<string, string>>;
}

/**
 * Notification queueing that respects per-user channel and category preferences
 * before enqueueing. Delivery itself is handled by the notification engine's
 * channel adapters (not wired here — providers are a build-phase concern).
 */
export class NotificationService extends ServiceBase {
  enqueue(ctx: RequestContext, input: EnqueueNotificationInput): QueuedNotification | null {
    this.require(ctx, "settings.update");
    const preference = this.uow.notifications.getPreference(input.recipientUserId);
    if (!isDeliverable(preference, input.channel, input.category)) return null;

    const notification: QueuedNotification = {
      id: this.ids.next<NotificationId>(),
      tenantId: ctx.tenantId,
      recipientUserId: input.recipientUserId,
      templateKey: input.templateKey,
      channel: input.channel,
      category: input.category,
      data: input.data ?? {},
      status: "queued",
      attempts: 0,
      scheduledAt: this.clock.now(),
      nextAttemptAt: this.clock.now(),
    };
    this.uow.notifications.enqueue(notification);
    return notification;
  }

  listForRecipient(ctx: RequestContext, recipientUserId: UserId): QueuedNotification[] {
    this.require(ctx, "settings.read");
    return this.uow.notifications.listForRecipient(recipientUserId);
  }
}

/** Read the append-only audit trail for the current tenant. */
export class AuditService extends ServiceBase {
  list(ctx: RequestContext): AuditLogEntry[] {
    this.require(ctx, "audit.read");
    return this.uow.audit.listForTenant(ctx.tenantId);
  }

  get(ctx: RequestContext, id: AuditEntryId): AuditLogEntry | undefined {
    this.require(ctx, "audit.read");
    const entry = this.uow.audit.get(id);
    if (!entry) return undefined;
    if (entry.tenantId !== ctx.tenantId && !ctx.isPlatformOperator) {
      throw new ValidationError("Audit entry belongs to a different tenant");
    }
    return entry;
  }
}
