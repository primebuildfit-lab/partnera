import {
  ConflictError,
  NotFoundError,
  type OfferId,
  type ProgramId,
  type TenantId,
} from "@partnera/core";
import { type OfferDefinition, type OfferStatus } from "@partnera/offer-engine";
import { type Collection } from "../relational/store";

/**
 * The mutable offer identity row. It carries a *pointer* to the active version;
 * the version bodies themselves live in an append-only table and are never
 * rewritten. Editing an offer appends a new version — historical commissions
 * always resolve the exact version that produced them (D-009, docs/06).
 */
export interface OfferRow {
  readonly id: OfferId;
  readonly tenantId: TenantId;
  readonly programId: ProgramId;
  readonly name: string;
  readonly status: OfferStatus;
  /** Highest version number that exists (the working/latest draft). */
  readonly latestVersion: number;
  /** The published version currently used for evaluation, or null if none. */
  readonly activeVersion: number | null;
  readonly stackingPriority: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** An immutable snapshot of one offer version (append-only). */
export interface OfferVersionRow {
  readonly offerId: OfferId;
  readonly tenantId: TenantId;
  readonly version: number;
  readonly definition: OfferDefinition;
  readonly createdAt: Date;
}

const versionPk = (offerId: OfferId, version: number): string => `${offerId}:${version}`;

export class OfferRepository {
  constructor(
    private readonly offers: Collection<OfferRow>,
    private readonly versions: Collection<OfferVersionRow>,
  ) {}

  /** Create a new offer at version 1 (draft). Returns the identity row. */
  createOffer(input: {
    id: OfferId;
    tenantId: TenantId;
    programId: ProgramId;
    name: string;
    definition: OfferDefinition;
    stackingPriority: number;
    now: Date;
  }): OfferRow {
    const definition: OfferDefinition = { ...input.definition, version: 1, status: "draft" };
    const row: OfferRow = {
      id: input.id,
      tenantId: input.tenantId,
      programId: input.programId,
      name: input.name,
      status: "draft",
      latestVersion: 1,
      activeVersion: null,
      stackingPriority: input.stackingPriority,
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.offers.insert(row);
    this.versions.insert({
      offerId: input.id,
      tenantId: input.tenantId,
      version: 1,
      definition,
      createdAt: input.now,
    });
    return row;
  }

  getOffer(tenantId: TenantId, offerId: OfferId): OfferRow | null {
    const row = this.offers.get(offerId);
    if (!row || row.tenantId !== tenantId) return null;
    return row;
  }

  getVersion(tenantId: TenantId, offerId: OfferId, version: number): OfferVersionRow | null {
    const row = this.versions.get(versionPk(offerId, version));
    if (!row || row.tenantId !== tenantId) return null;
    return row;
  }

  listOffers(tenantId: TenantId, filter?: { programId?: ProgramId }): OfferRow[] {
    return this.offers.find(
      (o) =>
        o.tenantId === tenantId &&
        (filter?.programId === undefined || o.programId === filter.programId),
    );
  }

  /**
   * Append a new version from an edited definition. The existing version rows are
   * never touched (append-only); the identity row's `latestVersion` pointer
   * advances under optimistic concurrency.
   */
  addVersion(
    tenantId: TenantId,
    offerId: OfferId,
    definition: OfferDefinition,
    now: Date,
  ): OfferVersionRow {
    const current = this.offers.getVersioned(offerId);
    if (!current || current.row.tenantId !== tenantId) {
      throw new NotFoundError("Offer not found", { offerId });
    }
    const nextVersion = current.row.latestVersion + 1;
    const versioned: OfferDefinition = { ...definition, version: nextVersion, status: "draft" };
    const versionRow: OfferVersionRow = {
      offerId,
      tenantId,
      version: nextVersion,
      definition: versioned,
      createdAt: now,
    };
    this.versions.insert(versionRow);
    this.offers.replace(
      { ...current.row, latestVersion: nextVersion, updatedAt: now },
      current.version,
    );
    return versionRow;
  }

  /**
   * Publish a specific version as the active one. Only moves the pointer and
   * flips status to `active`; version bodies are immutable, so an active version
   * can never be overwritten — only superseded by activating a different one.
   */
  activate(tenantId: TenantId, offerId: OfferId, version: number, now: Date): OfferRow {
    const current = this.offers.getVersioned(offerId);
    if (!current || current.row.tenantId !== tenantId) {
      throw new NotFoundError("Offer not found", { offerId });
    }
    if (!this.getVersion(tenantId, offerId, version)) {
      throw new ConflictError("Cannot activate a version that does not exist", { offerId, version });
    }
    const updated: OfferRow = {
      ...current.row,
      status: "active",
      activeVersion: version,
      updatedAt: now,
    };
    this.offers.replace(updated, current.version);
    return updated;
  }

  /** Set an offer's lifecycle status (e.g. archive). Optimistic-concurrency guarded. */
  setStatus(tenantId: TenantId, offerId: OfferId, status: OfferStatus, now: Date): OfferRow {
    const current = this.offers.getVersioned(offerId);
    if (!current || current.row.tenantId !== tenantId) {
      throw new NotFoundError("Offer not found", { offerId });
    }
    const updated: OfferRow = { ...current.row, status, updatedAt: now };
    this.offers.replace(updated, current.version);
    return updated;
  }

  /**
   * Resolve the currently-active offer definition for evaluation. Version bodies
   * are stored as immutable `draft` snapshots; the active-version read model
   * reflects the offer's published status so the evaluator sees it as `active`.
   */
  getActiveDefinition(tenantId: TenantId, offerId: OfferId): OfferDefinition | null {
    const offer = this.getOffer(tenantId, offerId);
    if (!offer || offer.activeVersion === null) return null;
    const version = this.getVersion(tenantId, offerId, offer.activeVersion);
    if (!version) return null;
    return { ...version.definition, status: "active", stackingPriority: offer.stackingPriority };
  }
}
