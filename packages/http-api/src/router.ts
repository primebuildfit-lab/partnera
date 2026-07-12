import { DomainError, InvariantViolation, type RequestContext } from "@partnera/core";

/**
 * A transport-agnostic HTTP surface. This is the *delivery* layer: it maps
 * routes to application use-cases and translates {@link DomainError}s to status
 * codes. It intentionally has **no** web-framework dependency — a NestJS or
 * Express host adapts its own request objects into {@link HttpRequest} and calls
 * `Router.handle`. That keeps Domain / Persistence / Application / Delivery
 * cleanly separated (the NestJS wrapper is the remaining, mechanical deploy step).
 *
 * Security note: `ctx` is built by the host's authentication middleware from the
 * verified session/token — never from the request body or query. The tenant and
 * actor a handler sees are therefore always trustworthy; client-supplied ids in
 * the body are treated as data only.
 */
export interface HttpRequest {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
  readonly params: Readonly<Record<string, string>>;
  readonly ctx: RequestContext;
}

export interface HttpResponse {
  readonly status: number;
  readonly body: unknown;
}

export type RouteHandler = (req: HttpRequest) => Promise<HttpResponse> | HttpResponse;

interface Route {
  readonly method: string;
  readonly segments: readonly string[];
  readonly handler: RouteHandler;
}

/** Map a thrown error to an HTTP response using the domain's status hints. */
export function toErrorResponse(error: unknown): HttpResponse {
  if (error instanceof DomainError) {
    return {
      status: error.httpStatusHint,
      body: { error: error.code, message: error.message, details: error.details },
    };
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  return { status: 500, body: { error: "internal_error", message } };
}

export class Router {
  private readonly routes: Route[] = [];

  route(method: string, pattern: string, handler: RouteHandler): this {
    this.routes.push({
      method: method.toUpperCase(),
      segments: pattern.split("/").filter((s) => s.length > 0),
      handler,
    });
    return this;
  }

  private match(method: string, path: string): { route: Route; params: Record<string, string> } | null {
    const parts = path.split("?")[0]!.split("/").filter((s) => s.length > 0);
    for (const route of this.routes) {
      if (route.method !== method.toUpperCase()) continue;
      if (route.segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < route.segments.length; i++) {
        const seg = route.segments[i]!;
        const part = parts[i]!;
        if (seg.startsWith(":")) params[seg.slice(1)] = decodeURIComponent(part);
        else if (seg !== part) {
          ok = false;
          break;
        }
      }
      if (ok) return { route, params };
    }
    return null;
  }

  /** Dispatch a request, catching domain errors and mapping them to responses. */
  async handle(input: Omit<HttpRequest, "params">): Promise<HttpResponse> {
    const matched = this.match(input.method, input.path);
    if (!matched) return { status: 404, body: { error: "not_found", message: "No such route" } };
    try {
      return await matched.route.handler({ ...input, params: matched.params });
    } catch (error) {
      if (error instanceof InvariantViolation) return toErrorResponse(error);
      return toErrorResponse(error);
    }
  }
}
