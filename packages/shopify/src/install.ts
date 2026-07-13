import { type BusinessId, type OrganizationId, type Result, type TenantId, err, IllegalStateError, ok } from "@partnera/core";
import { type ShopDomain } from "./shop";
import { type ShopifyInstallationId } from "./ids";

/**
 * The Shopify installation record — the mapping from a verified shop to a
 * Partnera tenant. Shopify is an adapter: this record links the two, but the
 * Partnera Business/Organization remain the source of truth. The offline access
 * token is stored encrypted at the persistence layer and is NEVER exposed to any
 * browser or included in a page; only its presence is surfaced.
 */
export type InstallationStatus = "pending" | "installed" | "uninstalled" | "reinstalled";

export interface ShopifyInstallation {
  readonly id: ShopifyInstallationId;
  readonly shop: ShopDomain;
  /** The Partnera tenant/business this shop maps to (resolved server-side). */
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly organizationId: OrganizationId;
  readonly status: InstallationStatus;
  readonly scopes: string;
  /** Reference/handle for the encrypted offline token — never the token itself. */
  readonly tokenRef: string | null;
  readonly installedAt: Date;
  readonly updatedAt: Date;
  readonly uninstalledAt: Date | null;
}

const INSTALL_TRANSITIONS: Readonly<Record<InstallationStatus, readonly InstallationStatus[]>> = {
  pending: ["installed", "uninstalled"],
  installed: ["uninstalled", "installed"], // re-install/scope-change stays installed
  uninstalled: ["reinstalled", "installed"],
  reinstalled: ["uninstalled", "installed"],
};

export function canTransitionInstall(from: InstallationStatus, to: InstallationStatus): boolean {
  return INSTALL_TRANSITIONS[from].includes(to);
}

export function transitionInstall(from: InstallationStatus, to: InstallationStatus): Result<InstallationStatus, IllegalStateError> {
  if (!canTransitionInstall(from, to)) {
    return err(new IllegalStateError(`Illegal installation transition: ${from} -> ${to}`, { from, to }));
  }
  return ok(to);
}
