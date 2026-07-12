import { type ExtensionId, type TenantId, type UserId } from "@partnera/core";
import { type ApprovalState, type ExtensionManifest } from "@partnera/extension-engine";
import { type Collection } from "../relational/store";

/**
 * A submitted extension and its approval state. The manifest is validated by the
 * engine (allow-listed scopes/hooks, engine-compat) before submission; this
 * stores the record and its lifecycle. Extensions are a shared, platform-curated
 * catalog, so `tenantId` is the submitter's tenant (null for platform-authored).
 */
export interface ExtensionRow {
  readonly id: ExtensionId;
  readonly tenantId: TenantId | null;
  readonly submittedByUserId: UserId;
  readonly manifest: ExtensionManifest;
  readonly state: ApprovalState;
  readonly submittedAt: Date;
  readonly updatedAt: Date;
}

export class ExtensionRepository {
  constructor(private readonly extensions: Collection<ExtensionRow>) {}

  submit(row: ExtensionRow): void {
    this.extensions.insert(row);
  }

  get(id: ExtensionId): ExtensionRow | undefined {
    return this.extensions.get(id);
  }

  getByKeyVersion(key: string, version: string): ExtensionRow | undefined {
    return this.extensions.findByUnique("key_version", `${key}@${version}`);
  }

  list(filter?: { state?: ApprovalState }): ExtensionRow[] {
    return this.extensions.find((e) => filter?.state === undefined || e.state === filter.state);
  }

  save(next: ExtensionRow): void {
    const current = this.extensions.getVersioned(next.id);
    if (current) this.extensions.replace(next, current.version);
    else this.extensions.insert(next);
  }
}
