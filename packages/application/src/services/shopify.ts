import {
  type BusinessId,
  type MembershipId,
  type OrganizationId,
  type RoleId,
  type TenantId,
  type UserId,
  asId,
} from "@partnera/core";
import {
  type OnboardingId,
  type OnboardingPurpose,
  type OnboardingState,
  type ResolvedShopTenant,
  type ShopDomain,
  type ShopifyInstallation,
  type ShopifyInstallationId,
  type WebhookEvent,
  type WebhookEventId,
  type WebhookTopic,
  WEBHOOK_MAX_ATTEMPTS,
  applicableSteps,
  canActivate,
  defaultStorageConnection,
  shopName,
  transitionInstall,
  webhookIdempotencyKey,
} from "@partnera/shopify";
import { type StorageConnectionId } from "@partnera/shopify";
import { type AppDeps } from "../context";

export interface InstallInput {
  /** The VERIFIED shop (HMAC-checked upstream) — never a browser-supplied value. */
  readonly shop: ShopDomain;
  readonly scopes: string;
  readonly tokenRef: string;
  readonly ownerEmail: string;
  readonly ownerName: string;
}

/**
 * Installation lifecycle + tenant provisioning (Parts 5/6). Called from the
 * verified Shopify OAuth callback (HMAC checked before this runs). Idempotent:
 * installing the same shop twice resolves to the same tenant. Creates a generic
 * Organization → Business → owner membership → onboarding → storage default — no
 * PrimeBuild-specific globals; PrimeBuild is just the first shop through this path.
 */
export class InstallationService {
  constructor(private readonly deps: AppDeps) {}
  private get uow() {
    return this.deps.uow;
  }

  installOrResolve(input: InstallInput): ResolvedShopTenant {
    const now = this.deps.clock.now();
    const existing = this.uow.shopify.getInstallationByShop(input.shop);
    if (existing) {
      const nextStatus = existing.status === "uninstalled" ? "reinstalled" : "installed";
      const t = transitionInstall(existing.status, nextStatus);
      const updated: ShopifyInstallation = {
        ...existing,
        status: t.ok ? t.value : existing.status,
        scopes: input.scopes,
        tokenRef: input.tokenRef,
        uninstalledAt: null,
        updatedAt: now,
      };
      this.uow.shopify.updateInstallation(updated);
      this.uow.shopify.upsertOfflineSession({ id: asId(`sess_${input.shop}`), shop: input.shop, kind: "offline", tokenRef: input.tokenRef, scopes: input.scopes, createdAt: now });
      return { shop: input.shop, tenantId: existing.tenantId, businessId: existing.businessId };
    }

    // Fresh install → provision a tenant.
    const organizationId = this.deps.ids.next<OrganizationId>();
    const businessId = this.deps.ids.next<BusinessId>();
    const tenantId = businessId as unknown as TenantId;
    const name = shopName(input.shop);

    this.uow.identity.createOrganization({ id: organizationId, name, createdAt: now });
    this.uow.identity.createBusiness({ id: businessId, organizationId, name, status: "active", planKey: "pilot", createdAt: now });

    // Owner user (reuse by email if present) + owner membership.
    let owner = this.uow.identity.getUserByEmail(input.ownerEmail);
    if (!owner) {
      const userId = this.deps.ids.next<UserId>();
      this.uow.identity.createUser({ id: userId, email: input.ownerEmail, displayName: input.ownerName, status: "active", authSubject: null, createdAt: now });
      owner = this.uow.identity.getUser(userId)!;
    }
    this.uow.identity.createMembership({
      id: this.deps.ids.next<MembershipId>(),
      userId: owner.id,
      scope: { kind: "business", businessId },
      roleIds: [asId<RoleId>("role_sys_business_owner")],
      status: "active",
      createdAt: now,
    });

    const install: ShopifyInstallation = {
      id: this.deps.ids.next<ShopifyInstallationId>(),
      shop: input.shop,
      tenantId,
      businessId,
      organizationId,
      status: "installed",
      scopes: input.scopes,
      tokenRef: input.tokenRef,
      installedAt: now,
      updatedAt: now,
      uninstalledAt: null,
    };
    this.uow.shopify.createInstallation(install);
    this.uow.shopify.upsertOfflineSession({ id: asId(`sess_${input.shop}`), shop: input.shop, kind: "offline", tokenRef: input.tokenRef, scopes: input.scopes, createdAt: now });
    this.uow.shopify.upsertOnboarding({ id: this.deps.ids.next<OnboardingId>(), tenantId, businessId, purpose: null, completed: {}, activated: false, updatedAt: now });
    this.uow.shopify.upsertStorage(defaultStorageConnection(this.deps.ids.next<StorageConnectionId>(), tenantId, businessId, now));

    return { shop: input.shop, tenantId, businessId };
  }

  /** Resolve a verified shop to its tenant, or null if not installed. */
  resolveTenant(shop: ShopDomain): ResolvedShopTenant | null {
    const i = this.uow.shopify.getInstallationByShop(shop);
    if (!i || i.status === "uninstalled") return null;
    return { shop, tenantId: i.tenantId, businessId: i.businessId };
  }

  /** Handle app/uninstalled: mark uninstalled (data retained; reinstall restores). */
  uninstall(shop: ShopDomain): void {
    const i = this.uow.shopify.getInstallationByShop(shop);
    if (!i) return;
    const now = this.deps.clock.now();
    this.uow.shopify.updateInstallation({ ...i, status: "uninstalled", tokenRef: null, uninstalledAt: now, updatedAt: now });
  }

  listInstallations(): ShopifyInstallation[] {
    return this.uow.shopify.listInstallations();
  }
}

/**
 * Durable, idempotent webhook intake (Part 14). HMAC is verified by the delivery
 * adapter; this records the event once per (shop, topic, webhookId), advances its
 * status, and parks it in dead-letter after repeated failure. Cross-shop effects
 * are impossible — the tenant is resolved from the verified shop only.
 */
export class WebhookService {
  constructor(private readonly deps: AppDeps) {}
  private get uow() {
    return this.deps.uow;
  }

  /** Record a received webhook. Returns {isNew:false} for a duplicate delivery. */
  record(shop: ShopDomain, topic: WebhookTopic, webhookId: string): { isNew: boolean; event: WebhookEvent } {
    const now = this.deps.clock.now();
    const key = webhookIdempotencyKey(shop, topic, webhookId);
    const tenant = this.uow.shopify.getInstallationByShop(shop)?.tenantId ?? null;
    const event: WebhookEvent = {
      id: this.deps.ids.next<WebhookEventId>(),
      shop,
      tenantId: tenant,
      topic,
      webhookId,
      status: "received",
      attempts: 0,
      receivedAt: now,
      processedAt: null,
      lastError: null,
    };
    const isNew = this.uow.shopify.recordWebhook(event, key);
    if (!isNew) {
      const existing = this.uow.shopify.listWebhooks().find((w) => `${w.shop}::${w.topic}::${w.webhookId}` === key)!;
      return { isNew: false, event: existing };
    }
    return { isNew: true, event };
  }

  markProcessed(id: WebhookEventId): void {
    const w = this.uow.shopify.getWebhook(id);
    if (!w) return;
    this.uow.shopify.updateWebhook({ ...w, status: "processed", attempts: w.attempts + 1, processedAt: this.deps.clock.now() });
  }

  markFailed(id: WebhookEventId, error: string): void {
    const w = this.uow.shopify.getWebhook(id);
    if (!w) return;
    const attempts = w.attempts + 1;
    const status = attempts >= WEBHOOK_MAX_ATTEMPTS ? "dead_letter" : "failed";
    this.uow.shopify.updateWebhook({ ...w, status, attempts, lastError: error });
  }

  deadLetterCount(): number {
    return this.uow.shopify.deadLetterCount();
  }
}

/** Persisted merchant onboarding (Part 9). Progress survives restart. */
export class OnboardingService {
  constructor(private readonly deps: AppDeps) {}
  private get uow() {
    return this.deps.uow;
  }

  get(tenantId: TenantId): OnboardingState | null {
    return this.uow.shopify.getOnboarding(tenantId) ?? null;
  }

  setPurpose(tenantId: TenantId, purpose: OnboardingPurpose): OnboardingState {
    const state = this.require(tenantId);
    const updated = { ...state, purpose, updatedAt: this.deps.clock.now() };
    this.uow.shopify.upsertOnboarding(updated);
    return updated;
  }

  completeStep(tenantId: TenantId, step: string, done = true): OnboardingState {
    const state = this.require(tenantId);
    const updated = { ...state, completed: { ...state.completed, [step]: done }, updatedAt: this.deps.clock.now() };
    this.uow.shopify.upsertOnboarding(updated);
    return updated;
  }

  activate(tenantId: TenantId): OnboardingState {
    const state = this.require(tenantId);
    const ok = canActivate(state);
    if (!ok.ok) throw ok.error;
    const updated = { ...state, activated: true, completed: { ...state.completed, review_activate: true }, updatedAt: this.deps.clock.now() };
    this.uow.shopify.upsertOnboarding(updated);
    return updated;
  }

  applicableSteps(tenantId: TenantId): string[] {
    return applicableSteps(this.get(tenantId)?.purpose ?? null);
  }

  private require(tenantId: TenantId): OnboardingState {
    const s = this.uow.shopify.getOnboarding(tenantId);
    if (!s) throw new Error("Onboarding state not found for tenant");
    return s;
  }
}
