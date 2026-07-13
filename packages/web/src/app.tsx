import { DomainError, type ProgramId, asId } from "@partnera/core";
import { type CreatorProgramId } from "@partnera/creator-marketplace";
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
import { renderCreator } from "./pages/creator";
import { renderInternal, internalAccessDenied } from "./pages/internal";
import { loginPage } from "./pages/login";
import { ICON_PNG_BASE64 } from "./brand-icon";
import { healthReport, readyReport } from "./observability";

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
const jsonResponse = (status: number, body: unknown): WebResponse => ({
  status,
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
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

  // Health / readiness — public, no secrets, for the productive host + probes.
  if (req.path === "/health" || req.path === "/healthz") {
    return jsonResponse(200, healthReport(world));
  }
  if (req.path === "/ready" || req.path === "/readyz") {
    const r = readyReport(world);
    return jsonResponse(r.ready ? 200 : 503, r);
  }

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
    cookies: req.cookies,
    persistence: world.persistence,
  };

  try {
    // Partnera Internal OS — total separation (§2): own layout, own guard.
    // Deny-by-default: ONLY platform operators; business/creator/affiliate rejected.
    if (scope === "internal") {
      if (!ctx.session.isPlatformOperator) {
        return html(403, renderDocument(internalAccessDenied(), { title: "Access denied" }));
      }
      const content = await renderInternal(pc);
      return html(200, renderDocument(content, { title: "Partnera Internal OS" }));
    }
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
    case "creator":
      return renderCreator(pc);
    case "internal":
      return renderInternal(pc); // (also guarded + rendered separately in handle)
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

    // --- Creator Marketplace: business/staff workflows ---
    if (parts[0] === "business" && parts[1] === "creators") {
      const kind = parts[2]; // opportunities | submissions | payments
      const id = parts[3] ?? "";
      const action = parts[4] ?? "";
      if (kind === "opportunities" && action === "publish") {
        await services.creator.publishOpportunity(request, asId(id));
        return back("/business/creators/opportunities", "success", "Opportunity published.");
      }
      if (kind === "submissions" && (action === "approve" || action === "reject" || action === "revision")) {
        const decision = action === "revision" ? "revision" : action;
        await services.creator.decide(request, asId(id), {
          decision: decision as "approve" | "reject" | "revision",
          categoryScores: { brief_compliance: 88, technical_quality: 85, brand_alignment: 86, creativity: 82, product_clarity: 88 },
          legalSafetyPass: req.form.legal !== "fail",
          fileRequirementsPass: req.form.file !== "fail",
          reason: req.form.reason ?? `${decision} from review workspace`,
        });
        return back("/business/creators/submissions", "success", `Submission ${decision}d.`);
      }
      if (kind === "submissions" && action === "publish") {
        await services.creator.publishToLibrary(request, asId(id));
        return back("/business/creators/library", "success", "Content published to the library.");
      }
      if (kind === "payments" && action === "authorize") {
        await services.creator.authorizePayment(request, asId(id));
        return back("/business/creators/payments", "success", "Payment authorized (fee recognized).");
      }
      if (kind === "payments" && action === "execute") {
        await services.creator.executePayout(request, asId(id));
        return back("/business/creators/payments", "success", "Payout executed (SIMULATED — no real money).");
      }
      // Scheme-driven review: reviewer confirms a category; business config sets the payment.
      if (kind === "submissions" && action === "review-scheme") {
        const res = await services.creator.reviewWithScheme(request, asId(id), {
          categoryKey: req.form.categoryKey ?? "",
          accept: req.form.accept !== "false",
          reason: req.form.reason ?? "Reviewed",
          legalCleared: req.form.legal !== "fail",
        });
        const note = res.paymentId ? "Category confirmed; payable created (money not moved)." : `Category confirmed; queue state: ${res.disposition.queueState.replace(/_/g, " ")}.`;
        return back("/business/creators/submissions", "success", note);
      }
      // Program configuration (the business owns its categories, payments, budget).
      if (kind === "config" && parts[3] === "category") {
        const programId = asId<CreatorProgramId>(parts[4]!);
        const scheme = services.creator.getScheme(request, programId);
        const updated = scheme.categories.map((c) => (c.key === req.form.categoryKey ? { ...c, paymentMinor: String(Math.max(0, Math.round(Number(req.form.paymentMajor ?? "0") * 100))) } : c));
        services.creator.saveScheme(request, programId, updated);
        return back("/business/creators/config", "success", "Category payment updated (PrimeBuild configuration).");
      }
      if (kind === "config" && parts[3] === "budget") {
        const programId = asId<CreatorProgramId>(parts[4]!);
        services.creator.setBudget(request, programId, { totalMinor: String(Math.max(0, Math.round(Number(req.form.totalMajor ?? "0") * 100))), currency: "USD" });
        return back("/business/creators/config", "success", "Program budget updated.");
      }
      if (kind === "config" && parts[3] === "fee") {
        const programId = asId<CreatorProgramId>(parts[4]!);
        const bps = Math.round(Number(req.form.feePct ?? "3") * 100);
        services.creator.setFeeRate(request, programId, bps, "business");
        return back("/business/creators/config", "success", `Platform fee set to ${(bps / 100).toFixed(2)}%.`);
      }
      // Operational pilot checklist (persisted; survives restart).
      if (kind === "pilot" && (action === "done" || action === "undo")) {
        services.creator.setPilotItem(request, id, action === "done");
        return back("/business/creators/pilot", "success", "Checklist updated.");
      }
      // First-run checklist dismiss / reopen (UI preference cookie).
      if (kind === "checklist" && id === "off") {
        return { status: 303, headers: { location: "/business/creators?flash=Checklist%20hidden.&intent=success", "set-cookie": "pt_cm_checklist=off; Path=/; Max-Age=31536000; SameSite=Lax" }, body: "" };
      }
      if (kind === "checklist" && id === "on") {
        return { status: 303, headers: { location: "/business/creators?flash=Checklist%20shown.&intent=success", "set-cookie": "pt_cm_checklist=; Path=/; Max-Age=0" }, body: "" };
      }
      // Waiting-queue actions (over-limit content is never discarded).
      if (kind === "queue" && action === "promote") {
        services.creator.promoteFromQueue(request, asId(id));
        return back("/business/creators/queue", "success", "Promoted back into review.");
      }
      if (kind === "queue" && (action === "archive" || action === "irrelevant" || action === "internal")) {
        const state = action === "archive" ? "archived" : action === "irrelevant" ? "irrelevant" : "internal_only";
        services.creator.setDisposition(request, asId(id), { queueState: state });
        return back("/business/creators/queue", "success", `Marked ${state.replace(/_/g, " ")}.`);
      }
    }

    // --- Creator Marketplace: creator self workflows (ownership-authorized) ---
    if (parts[0] === "creator") {
      if (req.path === "/creator/profile") {
        services.creator.registerProfile(request, { displayName: req.form.displayName ?? "New Creator" });
        return back("/creator", "success", "Creator profile created.");
      }
      if (parts[1] === "opportunities" && parts[3] === "apply") {
        services.creator.apply(request, asId(parts[2]!));
        return back("/creator/jobs", "success", "Applied. Accept terms to open the job.");
      }
      if (parts[1] === "applications" && parts[3] === "accept") {
        services.creator.acceptTerms(request, asId(parts[2]!));
        return back("/creator/jobs", "success", "Terms accepted — fee locked, job open.");
      }
      if (parts[1] === "opportunities" && parts[3] === "submit") {
        await services.creator.submit(request, {
          opportunityId: asId(parts[2]!),
          deliverableId: asId(req.form.deliverableId ?? ""),
          fileName: req.form.fileName ?? "submission.mp4",
          durationSec: req.form.durationSec ? Number(req.form.durationSec) : undefined,
          widthPx: req.form.widthPx ? Number(req.form.widthPx) : undefined,
          heightPx: req.form.heightPx ? Number(req.form.heightPx) : undefined,
          hasAudio: req.form.hasAudio === "on",
          hasCta: req.form.hasCta === "on",
          language: req.form.language || undefined,
          note: req.form.note || undefined,
        });
        return back("/creator/jobs", "success", "Submission uploaded (local demo storage — no real file stored).");
      }
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
  if (path.startsWith("/internal")) return "internal";
  if (path.startsWith("/affiliate")) return "affiliate";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/creator")) return "creator";
  return "business";
}

function titleFor(scope: AppScope): string {
  switch (scope) {
    case "business":
      return "Business Dashboard";
    case "affiliate":
      return "Affiliate Portal";
    case "creator":
      return "Creator Portal";
    case "admin":
      return "Admin Console";
    case "internal":
      return "Partnera Internal OS";
  }
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
