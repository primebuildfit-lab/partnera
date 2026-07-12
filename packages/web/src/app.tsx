import { DomainError, type ProgramId, asId } from "@partnera/core";
import { Alert, Card } from "@partnera/ui";
import { type AppScope, buildWebContext, type WebContext } from "./auth";
import { type DemoWorld } from "./demo";
import { type Flash, type PageContext } from "./page";
import { renderDocument } from "./render";
import { AppShell } from "./shell";
import { PageHeader } from "./components";
import { renderBusiness } from "./pages/business";
import { renderAffiliate } from "./pages/affiliate";
import { renderAdmin } from "./pages/admin";
import { loginPage } from "./pages/login";
import { ICON_PNG_BASE64 } from "./brand-icon";

/** The installable PWA manifest — gives the app its own window, name, and icon. */
const MANIFEST = JSON.stringify({
  name: "Partnera",
  short_name: "Partnera",
  description: "Affiliate, referral & partnership platform",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#f5f6f8",
  theme_color: "#4f46e5",
  icons: [
    { src: "/icon-512.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
});

function staticAsset(path: string): WebResponse | null {
  if (path === "/manifest.webmanifest") {
    return { status: 200, headers: { "content-type": "application/manifest+json; charset=utf-8" }, body: MANIFEST };
  }
  if (path === "/icon-512.png" || path === "/favicon.ico" || path === "/favicon.png" || path === "/apple-touch-icon.png") {
    return {
      status: 200,
      headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" },
      body: "",
      bodyBase64: ICON_PNG_BASE64,
    };
  }
  return null;
}

export interface WebRequest {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly cookies: Readonly<Record<string, string>>;
  readonly form: Readonly<Record<string, string>>;
}
export interface WebResponse {
  readonly status: number;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  /** When set, the host writes these decoded bytes instead of `body` (for images). */
  readonly bodyBase64?: string;
}

const html = (status: number, body: string): WebResponse => ({
  status,
  headers: { "content-type": "text/html; charset=utf-8" },
  body,
});
const redirect = (location: string, cookie?: string): WebResponse => ({
  status: 303,
  headers: cookie ? { location, "set-cookie": cookie } : { location },
  body: "",
});

const SESSION_COOKIE = "pt_session";
let requestSeq = 0;

/** The single entry point: turn a request into a response over the demo world. */
export async function handle(world: DemoWorld, req: WebRequest): Promise<WebResponse> {
  // Public static assets (icon, manifest) — no session required.
  const asset = staticAsset(req.path);
  if (asset) return asset;

  const sessionId = req.cookies[SESSION_COOKIE];
  const session = sessionId ? world.sessionStore.get(sessionId) : undefined;

  // Public routes.
  if (req.path === "/login" && req.method === "GET") {
    return html(200, renderDocument(loginPage(world, req.query.get("error") ?? undefined), { title: "Sign in" }));
  }
  if (req.path === "/login" && req.method === "POST") {
    return login(world, req);
  }
  if (req.path === "/logout") {
    if (sessionId) await world.authProvider.logout(sessionId);
    return redirect("/login", `${SESSION_COOKIE}=; Path=/; Max-Age=0`);
  }

  // Everything else requires a session.
  if (!session) return redirect("/login");
  if (req.path === "/" || req.path === "") return redirect(`/${session.scope}`);

  const ctx = buildWebContext(world.uow, session, `req_${++requestSeq}`);
  const scope = scopeFromPath(req.path);

  // Workflow mutations (POST) execute through services, then redirect (PRG).
  if (req.method === "POST") {
    return workflow(world, ctx, req);
  }

  const pc: PageContext = {
    ctx,
    request: ctx.request,
    services: world.services,
    path: req.path,
    params: {},
    flash: flashFrom(req.query),
  };

  try {
    const content = await renderScope(scope, pc);
    return html(
      200,
      renderDocument(
        <AppShell ctx={ctx} scope={scope} currentPath={req.path}>
          {content}
        </AppShell>,
        { title: titleFor(scope) },
      ),
    );
  } catch (error) {
    return errorResponse(ctx, scope, req.path, error);
  }
}

async function renderScope(scope: AppScope, pc: PageContext) {
  switch (scope) {
    case "business":
      return renderBusiness(pc);
    case "affiliate":
      return renderAffiliate(pc);
    case "admin":
      return renderAdmin(pc);
  }
}

async function login(world: DemoWorld, req: WebRequest): Promise<WebResponse> {
  const email = req.form.email ?? "";
  const scope = (req.form.scope as AppScope) ?? "business";
  const result = await world.authProvider.authenticate({ email, scope });
  if (!result.ok || !result.session) {
    return redirect(`/login?error=${encodeURIComponent(result.error ?? "Sign in failed")}`);
  }
  return redirect(`/${scope}`, `${SESSION_COOKIE}=${result.session.id}; Path=/; HttpOnly; SameSite=Lax`);
}

/** Execute a workflow through the application services and redirect with a flash. */
async function workflow(world: DemoWorld, ctx: WebContext, req: WebRequest): Promise<WebResponse> {
  const { services } = world;
  const request = ctx.request;
  const parts = req.path.split("/").filter(Boolean); // e.g. ["business","offers",":id","activate"]
  try {
    // Business workflows
    if (req.path === "/business/offers") {
      const value = Number(req.form.value ?? "0");
      const calc =
        req.form.calc === "fixed"
          ? ({ kind: "fixed", amount: { currency: "USD", minorUnits: String(value) } } as const)
          : ({ kind: "percentage", basisPoints: value } as const);
      services.offers.createOffer(request, {
        programId: asId<ProgramId>("prog_pb_main"),
        name: req.form.name ?? "Untitled offer",
        scope: [{ kind: "all" }],
        conditions: [{ kind: "attribution", via: ["coupon", "link", "session"] }],
        calculation: calc,
        reward: { kind: "cash" },
        schedule: { kind: "always" },
        limits: [],
      });
      return back("/business/offers", "success", "Draft offer created.");
    }
    if (parts[0] === "business" && parts[1] === "offers" && parts[3] === "activate") {
      await services.offers.activate(request, asId(parts[2]!), Number(req.form.version ?? "1"));
      return back(`/business/offers/${parts[2]}`, "success", "Offer activated.");
    }
    if (parts[0] === "business" && parts[1] === "offers" && parts[3] === "duplicate") {
      await services.offers.duplicate(request, asId(parts[2]!));
      return back("/business/offers", "success", "Offer duplicated.");
    }
    if (parts[0] === "business" && parts[1] === "offers" && parts[3] === "archive") {
      await services.offers.archive(request, asId(parts[2]!));
      return back("/business/offers", "success", "Offer archived.");
    }
    if (parts[0] === "business" && parts[1] === "commissions" && parts[3] === "approve") {
      await services.ledger.approve(request, asId(parts[2]!));
      return back("/business/commissions", "success", "Commission approved.");
    }
    if (parts[0] === "business" && parts[1] === "commissions" && parts[3] === "reject") {
      await services.ledger.reject(request, asId(parts[2]!), "Rejected from dashboard");
      return back("/business/commissions", "success", "Commission rejected.");
    }
    if (parts[0] === "business" && parts[1] === "fraud" && parts[3] === "review") {
      await services.fraud.review(request, asId(parts[2]!), {
        outcome: (req.form.outcome as "cleared" | "confirmed_fraud" | "suspended") ?? "cleared",
        note: req.form.note ?? "",
      });
      return back("/business/fraud", "success", "Fraud case resolved.");
    }
    if (req.path === "/business/configuration") {
      await services.configuration.set(request, req.form.key ?? "", parseConfigValue(req.form.value ?? ""));
      return back("/business/configuration", "success", "Configuration saved.");
    }
    return back(`/${scopeFromPath(req.path)}`, "warning", "Unknown action.");
  } catch (error) {
    const message = error instanceof DomainError ? error.message : "Action failed.";
    return back(referrerFor(req.path), "danger", message);
  }
}

function back(path: string, intent: Flash["intent"], message: string): WebResponse {
  const q = `flash=${encodeURIComponent(message)}&intent=${intent}`;
  return redirect(`${path}?${q}`);
}

function referrerFor(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts[0] === "business" && parts[1]) return `/business/${parts[1]}`;
  return `/${scopeFromPath(path)}`;
}

function flashFrom(query: URLSearchParams): Flash | undefined {
  const message = query.get("flash");
  if (!message) return undefined;
  const intent = (query.get("intent") as Flash["intent"]) ?? "info";
  return { intent, message };
}

function parseConfigValue(raw: string): unknown {
  const n = Number(raw);
  return Number.isFinite(n) && raw.trim() !== "" ? n : raw;
}

function scopeFromPath(path: string): AppScope {
  if (path.startsWith("/affiliate")) return "affiliate";
  if (path.startsWith("/admin")) return "admin";
  return "business";
}

function titleFor(scope: AppScope): string {
  return scope === "business" ? "Business Dashboard" : scope === "affiliate" ? "Affiliate Portal" : "Admin Console";
}

function errorResponse(ctx: WebContext, scope: AppScope, path: string, error: unknown): WebResponse {
  const status = error instanceof DomainError ? error.httpStatusHint : 500;
  const message = error instanceof DomainError ? error.message : "Something went wrong.";
  const intent = status === 403 ? "warning" : "danger";
  const content = (
    <>
      <PageHeader title={status === 403 ? "Not permitted" : "Error"} />
      <Card>
        <Alert intent={intent} title={`${status}`}>
          {message}
        </Alert>
      </Card>
    </>
  );
  return {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
    body: renderDocument(
      <AppShell ctx={ctx} scope={scope} currentPath={path}>
        {content}
      </AppShell>,
      { title: "Error" },
    ),
  };
}
