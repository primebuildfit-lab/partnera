import { type TenantId } from "@partnera/core";
import {
  type OnboardingState,
  type ShopDomain,
  type ShopifyInstallation,
  type ShopifyOfflineSession,
  type StorageConnection,
  type WebhookEvent,
} from "@partnera/shopify";
import { type Collection } from "../relational/store";

/**
 * Persistence for the Shopify adapter. Installations map a verified shop → a
 * Partnera tenant; webhook events are append-only and deduped by idempotency key;
 * onboarding + storage-connection state are mutable per business. The offline
 * token itself is never stored here in plain form — only a reference.
 *
 * Tenant isolation: reads are by shop (from a verified session) or by the
 * `TenantId` from the authenticated context; a browser-supplied shop can never
 * widen scope because callers pass the *verified* shop.
 */
export class ShopifyRepository {
  constructor(
    private readonly installations: Collection<ShopifyInstallation>,
    private readonly sessions: Collection<ShopifyOfflineSession>,
    private readonly webhooks: Collection<WebhookEvent>,
    private readonly onboarding: Collection<OnboardingState>,
    private readonly storage: Collection<StorageConnection>,
  ) {}

  // --- Installations (one per shop) ---
  getInstallationByShop(shop: ShopDomain): ShopifyInstallation | undefined {
    return this.installations.findByUnique("shop", shop);
  }
  getInstallationByTenant(tenantId: TenantId): ShopifyInstallation | undefined {
    return this.installations.find((i) => i.tenantId === tenantId)[0];
  }
  createInstallation(install: ShopifyInstallation): void {
    this.installations.insert(install);
  }
  updateInstallation(install: ShopifyInstallation): void {
    this.installations.upsert(install);
  }
  listInstallations(): ShopifyInstallation[] {
    return this.installations.values();
  }

  // --- Offline sessions (one per shop) ---
  upsertOfflineSession(session: ShopifyOfflineSession): void {
    this.sessions.upsert(session);
  }
  getOfflineSession(shop: ShopDomain): ShopifyOfflineSession | undefined {
    return this.sessions.get(shop);
  }

  // --- Webhook events (append-only, idempotent by key) ---
  /** Returns false if a webhook with this idempotency key was already recorded. */
  recordWebhook(event: WebhookEvent, idempotencyKey: string): boolean {
    if (this.webhooks.findByUnique("idem", idempotencyKey) !== undefined) return false;
    this.webhooks.insert(event);
    return true;
  }
  getWebhook(id: string): WebhookEvent | undefined {
    return this.webhooks.get(id);
  }
  updateWebhook(event: WebhookEvent): void {
    // Append-only stream conceptually; status is a derived working row we allow to advance.
    this.webhooks.upsert(event);
  }
  listWebhooks(): WebhookEvent[] {
    return this.webhooks.values();
  }
  deadLetterCount(): number {
    return this.webhooks.find((w) => w.status === "dead_letter").length;
  }

  // --- Onboarding (per business) ---
  upsertOnboarding(state: OnboardingState): void {
    this.onboarding.upsert(state);
  }
  getOnboarding(tenantId: TenantId): OnboardingState | undefined {
    return this.onboarding.find((o) => o.tenantId === tenantId)[0];
  }

  // --- Storage connection (per business) ---
  upsertStorage(conn: StorageConnection): void {
    this.storage.upsert(conn);
  }
  getStorage(tenantId: TenantId): StorageConnection | undefined {
    return this.storage.find((s) => s.tenantId === tenantId)[0];
  }

  counts(): Record<string, number> {
    return {
      shopify_installations: this.installations.count(),
      shopify_sessions: this.sessions.count(),
      webhook_events: this.webhooks.count(),
      onboarding_states: this.onboarding.count(),
      storage_connections: this.storage.count(),
    };
  }
}
