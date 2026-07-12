import { type NotificationId, type TenantId, type UserId } from "@partnera/core";
import {
  type DeliveryRecord,
  type NotificationPreference,
  type NotificationTemplate,
  type QueuedNotification,
} from "@partnera/notification-engine";
import { type Collection } from "../relational/store";

/**
 * Notification persistence: the delivery queue (mutable status + attempts),
 * an append-only delivery-attempt log, per-user preferences, and templates.
 * Retry/backoff and dead-lettering are engine concerns; this stores their state.
 */
export class NotificationRepository {
  constructor(
    private readonly queue: Collection<QueuedNotification>,
    private readonly deliveries: Collection<DeliveryRecord & { readonly id: string }>,
    private readonly preferences: Collection<NotificationPreference>,
    private readonly templates: Collection<NotificationTemplate>,
  ) {}

  enqueue(notification: QueuedNotification): void {
    this.queue.insert(notification);
  }

  updateStatus(next: QueuedNotification): void {
    const current = this.queue.getVersioned(next.id);
    if (current) this.queue.replace(next, current.version);
    else this.queue.insert(next);
  }

  get(tenantId: TenantId | null, id: NotificationId): QueuedNotification | undefined {
    const row = this.queue.get(id);
    if (!row) return undefined;
    return row.tenantId === tenantId ? row : undefined;
  }

  listForRecipient(recipientUserId: UserId): QueuedNotification[] {
    return this.queue.find((n) => n.recipientUserId === recipientUserId);
  }

  recordDelivery(record: DeliveryRecord & { id: string }): void {
    this.deliveries.insertIdempotent(record);
  }

  listDeliveries(notificationId: NotificationId): DeliveryRecord[] {
    return this.deliveries.find((d) => d.notificationId === notificationId);
  }

  setPreference(pref: NotificationPreference): void {
    this.preferences.upsert(pref);
  }

  getPreference(userId: UserId): NotificationPreference | undefined {
    return this.preferences.get(userId);
  }

  upsertTemplate(template: NotificationTemplate): void {
    this.templates.upsert(template);
  }

  getTemplate(key: string): NotificationTemplate | undefined {
    return this.templates.get(key);
  }
}
