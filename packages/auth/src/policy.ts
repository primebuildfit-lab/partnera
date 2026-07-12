import { PermissionDeniedError, type UserId } from "@partnera/core";
import { grantMatches, type PermissionKey } from "./permissions";
import { type Role } from "./roles";

/**
 * A resolved principal in a given context: the user plus the roles that apply
 * here (already scoped to the current tenant by the caller). The policy engine
 * only sees the effective roles — it never reaches for ambient state.
 */
export interface Principal {
  readonly userId: UserId;
  readonly roles: readonly Role[];
}

/**
 * The permission engine. Pure and stateless: given a principal and a permission,
 * decide allow/deny by matching the union of the principal's role grants.
 * Deny-by-default — nothing is permitted unless a role explicitly grants it.
 */
export class PermissionEngine {
  can(principal: Principal, permission: PermissionKey): boolean {
    for (const role of principal.roles) {
      for (const grant of role.permissions) {
        if (grantMatches(grant, permission)) return true;
      }
    }
    return false;
  }

  /** True only if every requested permission is granted. */
  canAll(principal: Principal, permissions: readonly PermissionKey[]): boolean {
    return permissions.every((p) => this.can(principal, p));
  }

  /** True if any of the requested permissions is granted. */
  canAny(principal: Principal, permissions: readonly PermissionKey[]): boolean {
    return permissions.some((p) => this.can(principal, p));
  }

  /** Enforce a permission; throws {@link PermissionDeniedError} when denied. */
  require(principal: Principal, permission: PermissionKey): void {
    if (!this.can(principal, permission)) {
      throw new PermissionDeniedError(`Missing permission: ${permission}`, {
        userId: principal.userId,
        permission,
      });
    }
  }

  /** The flattened, de-duplicated set of permissions this principal holds. */
  effectivePermissions(principal: Principal): Set<PermissionKey> {
    const set = new Set<PermissionKey>();
    for (const role of principal.roles) {
      for (const grant of role.permissions) set.add(grant);
    }
    return set;
  }
}
