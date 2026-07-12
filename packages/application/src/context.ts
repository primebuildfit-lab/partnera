import {
  type AuditEntryId,
  type Clock,
  type EventBus,
  type IdGenerator,
  NotFoundError,
  type PermissionDeniedError,
  type RequestContext,
} from "@partnera/core";
import { type PermissionKey, PermissionEngine, type Principal } from "@partnera/auth";
import { type AttributionResolver, DefaultAttributionResolver } from "@partnera/tracking-engine";
import { OfferEvaluator } from "@partnera/offer-engine";
import { makeAuditEntry } from "@partnera/platform";
import { type UnitOfWork } from "@partnera/persistence";

/**
 * The injected dependencies shared by every application service. Time, ids, and
 * the event bus are injected (never read ambiently) so the whole application
 * layer stays deterministic and testable, exactly like the engines.
 */
export interface AppDeps {
  readonly uow: UnitOfWork;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly events: EventBus;
  readonly permissions?: PermissionEngine;
  readonly attribution?: AttributionResolver;
  readonly evaluator?: OfferEvaluator;
}

/**
 * Base class for application services. Centralizes the security spine that Part 9
 * requires and every use-case must go through:
 *
 *  - **Principal resolution** from the authenticated {@link RequestContext} — the
 *    tenant and actor come from the context, never from request input.
 *  - **Permission checks** via the deny-by-default {@link PermissionEngine}.
 *  - **Audit** of sensitive actions to the append-only audit log.
 *
 * `tenantId` is always read from `ctx`; service inputs deliberately never carry a
 * tenant id, so a client can neither widen scope nor forge ownership.
 */
export abstract class ServiceBase {
  protected readonly uow: UnitOfWork;
  protected readonly clock: Clock;
  protected readonly ids: IdGenerator;
  protected readonly events: EventBus;
  protected readonly permissions: PermissionEngine;
  protected readonly attribution: AttributionResolver;
  protected readonly evaluator: OfferEvaluator;

  constructor(deps: AppDeps) {
    this.uow = deps.uow;
    this.clock = deps.clock;
    this.ids = deps.ids;
    this.events = deps.events;
    this.permissions = deps.permissions ?? new PermissionEngine();
    this.attribution = deps.attribution ?? new DefaultAttributionResolver();
    this.evaluator = deps.evaluator ?? new OfferEvaluator();
  }

  /** Resolve the effective principal (user + tenant-scoped roles) for a context. */
  protected principal(ctx: RequestContext): Principal {
    const user = this.uow.identity.getUser(ctx.actorUserId);
    if (!user) throw new NotFoundError("Acting user not found", { userId: ctx.actorUserId });
    const roles = this.uow.identity.resolveRoles(ctx.actorUserId, ctx.tenantId);
    return { userId: ctx.actorUserId, roles };
  }

  /** Enforce a permission for the context's principal. Throws {@link PermissionDeniedError}. */
  protected require(ctx: RequestContext, permission: PermissionKey): void {
    // Never throws for a well-formed permission; propagates PermissionDeniedError.
    this.permissions.require(this.principal(ctx), permission);
  }

  /** Append an entry to the immutable audit log. */
  protected async audit(
    ctx: RequestContext,
    action: string,
    resourceType: string,
    resourceId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const entry = makeAuditEntry(
      {
        id: this.ids.next<AuditEntryId>(),
        tenantId: ctx.tenantId,
        actorUserId: ctx.actorUserId,
        action,
        resourceType,
        resourceId,
        metadata,
        byPlatformOperator: ctx.isPlatformOperator,
      },
      this.clock.now(),
    );
    await this.uow.audit.record(entry);
  }
}

/** Convenience re-export so delivery code depends only on the application package. */
export type { PermissionDeniedError };
