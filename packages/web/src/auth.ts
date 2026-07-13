import {
  type AffiliateId,
  type BusinessId,
  PermissionDeniedError,
  type RequestContext,
  type UserId,
} from "@partnera/core";
import { PermissionEngine, type PermissionKey, type Principal } from "@partnera/auth";
import { type UnitOfWork } from "@partnera/persistence";

/**
 * Authentication preparation (Part 7). No real provider is connected — this is
 * the session/permission/tenant plumbing the delivery layer needs, with the
 * OAuth/SSO/MFA seams declared so a later module drops a provider in without
 * reshaping anything. The dev provider below authenticates against seeded users
 * with **no** credential check and is for local exploration only.
 */

/** Which application surface a session is currently using. */
export type AppScope = "business" | "affiliate" | "admin" | "creator" | "internal";

/** A minimal, transport-agnostic session. A real provider issues/validates these. */
export interface WebSession {
  readonly id: string;
  readonly userId: UserId;
  readonly tenantId: BusinessId;
  readonly email: string;
  readonly displayName: string;
  readonly isPlatformOperator: boolean;
  readonly scope: AppScope;
  /**
   * The affiliate this user acts as, when using the Affiliate Portal. In a real
   * system the auth provider maps the identity → affiliate; here it is resolved
   * by an injected function (placeholder for that mapping).
   */
  readonly affiliateId: AffiliateId | null;
  readonly expiresAt: Date;
}

/**
 * The resolved request context for one page render: the authenticated
 * {@link RequestContext} the services require, plus a memoized permission set so
 * navigation and controls can be permission-gated in the UI. Permissions are
 * resolved from the user's tenant-scoped roles — never trusted from the client.
 */
export interface WebContext {
  readonly session: WebSession;
  readonly request: RequestContext;
  readonly permissions: ReadonlySet<PermissionKey>;
  can(permission: PermissionKey): boolean;
}

const engine = new PermissionEngine();

/** Build the per-request context (request context + effective permissions). */
export function buildWebContext(uow: UnitOfWork, session: WebSession, requestId: string): WebContext {
  const roles = uow.identity.resolveRoles(session.userId, session.tenantId);
  const principal: Principal = { userId: session.userId, roles };
  const permissions = engine.effectivePermissions(principal);
  const request: RequestContext = {
    tenantId: session.tenantId,
    actorUserId: session.userId,
    isPlatformOperator: session.isPlatformOperator,
    requestId,
  };
  return {
    session,
    request,
    permissions,
    can: (permission) => engine.can(principal, permission),
  };
}

/** Protected-route guard. Throws {@link PermissionDeniedError} when denied. */
export function protectRoute(ctx: WebContext, permission: PermissionKey): void {
  if (!ctx.can(permission)) {
    throw new PermissionDeniedError(`Route requires ${permission}`, { permission });
  }
}

// --- Session store (dev; a real provider persists/validates sessions) --------

export class InMemorySessionStore {
  private readonly sessions = new Map<string, WebSession>();

  put(session: WebSession): void {
    this.sessions.set(session.id, session);
  }
  get(id: string): WebSession | undefined {
    return this.sessions.get(id);
  }
  delete(id: string): void {
    this.sessions.delete(id);
  }
}

// --- Auth provider seam ------------------------------------------------------

export interface AuthResult {
  readonly ok: boolean;
  readonly session: WebSession | null;
  readonly error: string | null;
}

/**
 * The provider contract a real auth module implements. `authenticate` verifies
 * credentials and issues a session; `logout` revokes it. Future capabilities are
 * declared as optional seams so the delivery layer already knows their shape.
 */
export interface AuthProvider {
  readonly kind: string;
  authenticate(input: { email: string; scope: AppScope }): Promise<AuthResult>;
  logout(sessionId: string): Promise<void>;
  // Future (documented, not implemented):
  //   beginOAuth(provider): Promise<{ redirectUrl: string }>
  //   completeOAuth(code): Promise<AuthResult>
  //   beginSso(connectionId): Promise<{ redirectUrl: string }>
  //   verifyMfa(sessionId, code): Promise<AuthResult>
}

/**
 * Development provider: looks up a seeded user by email and issues a session with
 * **no** password/MFA check. Never ship this. It exists so the apps are navigable
 * before a real provider (D-104) is wired.
 */
export class DevAuthProvider implements AuthProvider {
  readonly kind = "dev-insecure";

  constructor(
    private readonly uow: UnitOfWork,
    private readonly store: InMemorySessionStore,
    private readonly tenantId: BusinessId,
    private readonly now: () => Date,
    /** Placeholder identity→affiliate mapping (a real provider supplies this). */
    private readonly affiliateOf: (userId: UserId) => AffiliateId | null = () => null,
  ) {}

  async authenticate(input: { email: string; scope: AppScope }): Promise<AuthResult> {
    const user = this.uow.identity.getUserByEmail(input.email);
    if (!user) return { ok: false, session: null, error: "No such user" };
    const roles = this.uow.identity.resolveRoles(user.id, this.tenantId);
    const isPlatformOperator = roles.some((r) => r.scopeLevel === "platform");
    const session: WebSession = {
      id: `sess_${user.id}_${input.scope}`,
      userId: user.id,
      tenantId: this.tenantId,
      email: user.email,
      displayName: user.displayName,
      isPlatformOperator,
      scope: input.scope,
      affiliateId: this.affiliateOf(user.id),
      expiresAt: new Date(this.now().getTime() + 1000 * 60 * 60 * 8),
    };
    this.store.put(session);
    return { ok: true, session, error: null };
  }

  async logout(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }
}
