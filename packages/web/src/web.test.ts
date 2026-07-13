import { describe, expect, it } from "vitest";
import { createDemoWorld, type DemoWorld } from "./demo";
import { handle, type WebRequest, type WebResponse } from "./app";

/**
 * End-to-end delivery tests: they drive the real {@link handle} entry point over
 * the demo world (which itself ran the real money spine), so a passing test means
 * the pages render actual service data, workflows execute through the services,
 * permissions are enforced, and the accessibility landmarks are present.
 */

function req(partial: Partial<WebRequest> & { path: string }): WebRequest {
  return {
    method: "GET",
    query: new URLSearchParams(),
    cookies: {},
    form: {},
    ...partial,
  };
}

async function login(world: DemoWorld, email: string, scope: string): Promise<string> {
  const res = await handle(world, req({ method: "POST", path: "/login", form: { email, scope } }));
  const cookie = res.headers["set-cookie"] ?? "";
  const id = /pt_session=([^;]+)/.exec(cookie)?.[1] ?? "";
  return id;
}

function get(world: DemoWorld, path: string, session: string, query?: Record<string, string>): Promise<WebResponse> {
  return handle(world, req({ path, cookies: { pt_session: session }, query: new URLSearchParams(query) }));
}

describe("delivery — authentication & routing", () => {
  it("redirects unauthenticated requests to /login", async () => {
    const world = await createDemoWorld();
    const res = await handle(world, req({ path: "/business" }));
    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/login");
  });

  it("logs in and sets a session cookie", async () => {
    const world = await createDemoWorld();
    const res = await handle(world, req({ method: "POST", path: "/login", form: { email: world.users.owner, scope: "business" } }));
    expect(res.status).toBe(303);
    expect(res.headers["set-cookie"]).toContain("pt_session=");
    expect(res.headers.location).toBe("/business");
  });

  it("logs out and clears the cookie", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.owner, "business");
    const res = await handle(world, req({ path: "/logout", cookies: { pt_session: session } }));
    expect(res.headers["set-cookie"]).toContain("Max-Age=0");
  });
});

describe("delivery — Business Dashboard shows real money-spine data", () => {
  it("overview reflects seeded conversions and commissions", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.owner, "business");
    const res = await get(world, "/business", session);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Overview");
    expect(res.body).toContain("$50.00"); // Brian's paid commission
  });

  it("commissions page lists commissions with states", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.owner, "business");
    const res = await get(world, "/business/commissions", session);
    expect(res.body).toContain("$50.00");
    expect(res.body).toContain("reversed");
  });

  it("balances are derived from the ledger", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.owner, "business");
    const res = await get(world, "/business/balances", session);
    expect(res.body).toContain("Available");
  });

  it("analytics computes attributed revenue", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.owner, "business");
    const res = await get(world, "/business/analytics", session);
    expect(res.body).toContain("Attributed revenue");
    expect(res.body).toContain("$1090.00");
  });
});

describe("delivery — Affiliate Portal is scoped to the affiliate", () => {
  it("shows the affiliate's own paid balance", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.affiliate, "affiliate");
    const res = await get(world, "/affiliate", session);
    expect(res.body).toContain("Performance");
    expect(res.body).toContain("$50.00"); // Brian's paid to date
  });
});

describe("delivery — Admin Console", () => {
  it("renders the operations overview for a platform operator", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.admin, "admin");
    const res = await get(world, "/admin", session);
    expect(res.body).toContain("Operations Overview");
    expect(res.body).toContain("Users");
  });
});

describe("delivery — workflows execute through services", () => {
  it("creates a draft offer and shows it in the list", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.owner, "business");
    const post = await handle(
      world,
      req({
        method: "POST",
        path: "/business/offers",
        cookies: { pt_session: session },
        form: { name: "Test Offer 22%", calc: "percentage", value: "2200" },
      }),
    );
    expect(post.status).toBe(303);
    expect(post.headers.location).toContain("intent=success");
    const list = await get(world, "/business/offers", session);
    expect(list.body).toContain("Test Offer 22%");
  });

  it("approving a pending commission moves it to approved", async () => {
    const world = await createDemoWorld();
    const owner = { tenantId: world.tenantId, actorUserId: world.uow.identity.getUserByEmail(world.users.owner)!.id, isPlatformOperator: false, requestId: "t" };
    const pending = (await world.services.query.commissions(owner)).find((c) => c.state === "pending");
    expect(pending).toBeTruthy();
    const session = await login(world, world.users.owner, "business");
    const post = await handle(
      world,
      req({ method: "POST", path: `/business/commissions/${pending!.commissionId}/approve`, cookies: { pt_session: session } }),
    );
    expect(post.headers.location).toContain("intent=success");
    const after = await world.services.query.commissions(owner);
    expect(after.find((c) => c.commissionId === pending!.commissionId)!.state).toBe("approved");
  });
});

describe("delivery — Creator Marketplace surfaces (real services)", () => {
  it("creator portal shows the seeded creator and simulated earnings", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.creator, "creator");
    const overview = await get(world, "/creator", session);
    expect(overview.status).toBe(200);
    expect(overview.body).toContain("Cora Creator");
    const earnings = await get(world, "/creator/earnings", session);
    expect(earnings.body).toContain("$150.00"); // paid deliverable (business-paid: full gross), simulated
  });

  it("business creator dashboard and review queue reflect the seeded flow", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.owner, "business");
    const dash = await get(world, "/business/creators", session);
    expect(dash.body).toContain("Awaiting review");
    const queue = await get(world, "/business/creators/submissions", session);
    expect(queue.body).toContain("Cora Creator"); // the under-review unboxing submission
    const payments = await get(world, "/business/creators/payments", session);
    expect(payments.body).toContain("simulated");
  });

  it("affiliate content library unlocks the published asset by rank", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.affiliate, "affiliate");
    const res = await get(world, "/affiliate/content", session);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Content library");
    expect(res.body).toContain("unlocked"); // gold demo rank ≥ silver rule
  });

  it("a creator can apply to an opportunity through the portal workflow", async () => {
    const world = await createDemoWorld();
    // A fresh creator user (reuse Cora) applying to an already-open opportunity is idempotent;
    // assert the workflow executes and redirects with success.
    const session = await login(world, world.users.creator, "creator");
    const discover = await get(world, "/creator/discover", session);
    const oppMatch = /\/creator\/opportunities\/([^/]+)\/apply/.exec(discover.body);
    expect(oppMatch).toBeTruthy();
    const post = await handle(world, req({ method: "POST", path: oppMatch![0], cookies: { pt_session: session } }));
    expect(post.status).toBe(303);
    expect(post.headers.location).toContain("intent=success");
  });

  it("does not expose internal architecture terms in user-facing pages", async () => {
    const world = await createDemoWorld();
    const owner = await login(world, world.users.owner, "business");
    const creator = await login(world, world.users.creator, "creator");
    const jargon = /append-only|creator-payment ledger|\bTenant member\b|repository|domain event/i;
    for (const [session, path] of [
      [owner, "/business"], [owner, "/business/creators"], [owner, "/business/creators/payments"],
      [creator, "/creator"], [creator, "/creator/earnings"],
    ] as const) {
      const res = await get(world, path, session);
      expect(res.body, `${path} leaks jargon`).not.toMatch(jargon);
    }
  });

  it("business creator home shows the first-run checklist and it can be dismissed", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.owner, "business");
    const home = await get(world, "/business/creators", session);
    expect(home.body).toContain("Get started");
    const dismiss = await handle(world, req({ method: "POST", path: "/business/creators/checklist/off", cookies: { pt_session: session } }));
    expect(dismiss.status).toBe(303);
    expect(dismiss.headers["set-cookie"]).toContain("pt_cm_checklist=off");
  });

  it("setup guide wizard renders numbered steps", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.owner, "business");
    const res = await get(world, "/business/creators/setup", session);
    expect(res.body).toContain("Creator Program setup");
    expect(res.body).toContain("Payments per category");
    expect(res.body).toContain("Acceptance limits");
  });

  it("simulated payment shows the full money breakdown and never claims real money moved", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.owner, "business");
    const res = await get(world, "/business/creators/payments", session);
    expect(res.body).toContain("Creator payment");
    expect(res.body).toContain("Partnera fee");
    expect(res.body).toContain("Creator receives");
    expect(res.body.toLowerCase()).toContain("simulated");
    // A money-moving action is behind a confirm disclosure, not a bare single-click button.
    expect(res.body).toContain("Authorize payment…");
  });

  it("program setup shows PrimeBuild's own categories + payments and the config notice", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.owner, "business");
    const res = await get(world, "/business/creators/config", session);
    expect(res.status).toBe(200);
    expect(res.body).toContain("Program setup");
    expect(res.body).toContain("Excellent");
    expect(res.body).toContain("$35.00"); // PrimeBuild's own payment, not a Partnera global
    expect(res.body).toContain("Partnera does not determine creator compensation");
  });

  it("review workspace shows two AI scores and the fee/net breakdown per category", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.owner, "business");
    const res = await get(world, "/business/creators/submissions", session);
    expect(res.body).toContain("Technical score");
    expect(res.body).toContain("Commercial score");
    expect(res.body).toContain("Creator net");
    expect(res.body).toContain("Confirm category");
  });

  it("waiting queue surfaces the seeded waiting-for-budget and internal-only items honestly", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.owner, "business");
    const res = await get(world, "/business/creators/queue", session);
    expect(res.body).toContain("Waiting queue");
    expect(res.body).toContain("waiting for budget"); // over-budget item, not auto-rejected
    expect(res.body).toContain("internal only"); // low-score retained content
  });

  it("a scheme-driven review applies the business payment and can route to waiting", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.owner, "business");
    // The seeded oppB unboxing submission is under_review; confirm "good" ($20) category.
    const queue = await get(world, "/business/creators/submissions", session);
    const m = /\/business\/creators\/submissions\/([^/]+)\/review-scheme/.exec(queue.body);
    expect(m).toBeTruthy();
    const post = await handle(world, req({ method: "POST", path: m![0], cookies: { pt_session: session }, form: { categoryKey: "good", accept: "true", reason: "solid" } }));
    expect(post.status).toBe(303);
    expect(post.headers.location).toContain("intent=success");
  });

  it("gates the authorize control by permission and hides it behind a confirmation", async () => {
    const world = await createDemoWorld();
    // A user WITHOUT creator_payment.authorize must never see an authorize control.
    const creatorSession = await login(world, world.users.creator, "creator");
    const denied = await get(world, "/business/creators/payments", creatorSession);
    expect(denied.body).not.toContain("/authorize");
    // The authorized owner sees the approved payable's authorize action, but only behind a
    // confirm disclosure — no accidental single click can authorize a (simulated) payout.
    const ownerSession = await login(world, world.users.owner, "business");
    const payments = await get(world, "/business/creators/payments", ownerSession);
    expect(payments.body).toContain("Authorize payment…");
    expect(payments.body).toContain("/authorize"); // inside a <details> confirm, per ConfirmButton
  });
});

describe("delivery — PWA / desktop assets", () => {
  it("serves the web manifest (installable)", async () => {
    const world = await createDemoWorld();
    const res = await handle(world, req({ path: "/manifest.webmanifest" }));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("manifest");
    expect(res.body).toContain('"display":"standalone"');
    expect(res.body).toContain('"name":"Partnera"');
  });

  it("serves the icon as PNG bytes", async () => {
    const world = await createDemoWorld();
    const res = await handle(world, req({ path: "/favicon.ico" }));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(typeof res.bodyBase64).toBe("string");
    // PNG signature "\x89PNG" base64-encodes with the "iVBORw0" prefix.
    expect(res.bodyBase64!.startsWith("iVBORw0")).toBe(true);
  });

  it("includes the manifest + theme-color in the document head", async () => {
    const world = await createDemoWorld();
    const res = await handle(world, req({ path: "/login" }));
    expect(res.body).toContain('rel="manifest"');
    expect(res.body).toContain('name="theme-color"');
    expect(res.body).toContain("<title>Sign in - Partnera</title>");
  });
});

describe("delivery — permissions & accessibility", () => {
  it("denies a workflow the principal lacks permission for", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.affiliate, "business");
    const res = await handle(
      world,
      req({ method: "POST", path: "/business/offers", cookies: { pt_session: session }, form: { name: "x", calc: "percentage", value: "1" } }),
    );
    expect(res.headers.location).toContain("intent=danger");
    expect(decodeURIComponent(res.headers.location!)).toContain("offers.create");
  });

  it("hides nav items the principal cannot access", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.affiliate, "business");
    const res = await get(world, "/business", session);
    // Affiliate lacks audit.read → the Audit nav link must not appear.
    expect(res.body).not.toContain("/business/audit");
  });

  it("includes accessibility landmarks", async () => {
    const world = await createDemoWorld();
    const session = await login(world, world.users.owner, "business");
    const res = await get(world, "/business", session);
    expect(res.body).toContain("pt-skip"); // skip link
    expect(res.body).toContain('id="main"'); // main landmark
    expect(res.body).toContain('aria-label="Primary"'); // primary navigation
  });
});
