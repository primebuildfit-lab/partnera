import { type BusinessId, type TenantId } from "@partnera/core";
import { type StorageConnectionId } from "./ids";

/**
 * Provider-independent content-storage connector layer (Part 17) — contracts and
 * a safe "not connected" default. Partnera never stores video binaries in the
 * relational DB; it references files held by the business's chosen provider. No
 * provider is connected in the pilot: the default state is honestly "disconnected"
 * and only metadata/mock references are used.
 */
export const STORAGE_PROVIDERS = ["none", "google_drive", "onedrive", "dropbox", "s3", "manual_link", "partnera_sync"] as const;
export type StorageProvider = (typeof STORAGE_PROVIDERS)[number];

export type StorageConnectionStatus = "not_connected" | "pending_auth" | "connected" | "error";

export interface StorageConnection {
  readonly id: StorageConnectionId;
  readonly tenantId: TenantId;
  readonly businessId: BusinessId;
  readonly provider: StorageProvider;
  readonly status: StorageConnectionStatus;
  /** Reference to credentials held by the secret store — never the secret. */
  readonly credentialRef: string | null;
  readonly updatedAt: Date;
}

/** The canonical per-program folder template (created on the provider later). */
export const FOLDER_TEMPLATE = [
  "incoming",
  "review",
  "waiting",
  "approved",
  "affiliate_library",
  "internal",
  "archive",
] as const;
export type FolderKind = (typeof FOLDER_TEMPLATE)[number];

/** A reference to a stored file (metadata only; the binary lives at the provider). */
export interface FileReference {
  readonly provider: StorageProvider;
  /** Opaque provider id or URL; for "manual_link"/"none" this may be a demo value. */
  readonly ref: string;
  readonly folder: FolderKind;
  readonly demo: boolean;
}

export function defaultStorageConnection(id: StorageConnectionId, tenantId: TenantId, businessId: BusinessId, now: Date): StorageConnection {
  return { id, tenantId, businessId, provider: "none", status: "not_connected", credentialRef: null, updatedAt: now };
}
