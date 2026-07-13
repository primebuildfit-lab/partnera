import { type RequestContext } from "@partnera/core";
import { type Services } from "@partnera/application";
import { type Intent } from "@partnera/ui";
import { type WebContext } from "./auth";

/** A transient message shown after a workflow (POST-redirect-GET pattern). */
export interface Flash {
  readonly intent: Intent;
  readonly message: string;
}

/**
 * Everything a page render needs: the authenticated web context (permissions +
 * session), the derived {@link RequestContext} the services require, the service
 * container, the resolved path/params, and an optional flash message. Pages are
 * pure async functions of this — no ambient state, easily testable.
 */
export interface PageContext {
  readonly ctx: WebContext;
  readonly request: RequestContext;
  readonly services: Services;
  readonly path: string;
  readonly params: Readonly<Record<string, string>>;
  readonly flash?: Flash;
  /** Request cookies, so pages can honour UI preferences (e.g. dismissed checklist). */
  readonly cookies?: Readonly<Record<string, string>>;
  /** Persistence descriptor for the admin data-status view. */
  readonly persistence?: {
    readonly mode: "in-memory" | "local-file";
    readonly dataFile: string | null;
    readonly lastSaveAt: Date | null;
    readonly backupDir: string | null;
  };
}
