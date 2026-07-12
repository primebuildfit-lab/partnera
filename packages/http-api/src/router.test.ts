import {
  asId,
  type BusinessId,
  FixedClock,
  InMemoryEventBus,
  type RequestContext,
  type RoleId,
  type UserId,
} from "@partnera/core";
import { type PermissionKey } from "@partnera/auth";
import { createServices } from "@partnera/application";
import { UnitOfWork } from "@partnera/persistence";
import { describe, expect, it } from "vitest";
import { buildApiRouter } from "./routes";
import { Router } from "./router";

function harness(perms: readonly PermissionKey[]) {
  const uow = new UnitOfWork();
  const clock = new FixedClock("2026-03-01T00:00:00.000Z");
  const events = new InMemoryEventBus();
  const services = createServices({ uow, clock, ids: new (class {
    private n = 0;
    next<T>(): T {
      return `id_${++this.n}` as unknown as T;
    }
  })(), events });

  const tenantId = asId<BusinessId>("biz_1");
  const roleId = asId<RoleId>("role_1");
  const userId = asId<UserId>("user_1");
  uow.identity.createBusiness({
    id: tenantId,
    organizationId: null,
    name: "T",
    status: "active",
    planKey: "pro",
    createdAt: clock.now(),
  });
  uow.identity.createRole({
    id: roleId,
    key: "r",
    name: "r",
    scopeLevel: "business",
    permissions: perms,
    isSystem: false,
  });
  uow.identity.createUser({
    id: userId,
    email: "u@x.com",
    displayName: "u",
    status: "active",
    authSubject: null,
    createdAt: clock.now(),
  });
  uow.identity.createMembership({
    id: asId("m1"),
    userId,
    scope: { kind: "business", businessId: tenantId },
    roleIds: [roleId],
    status: "active",
    createdAt: clock.now(),
  });
  const ctx: RequestContext = {
    tenantId,
    actorUserId: userId,
    isPlatformOperator: false,
    requestId: "r1",
  };
  return { router: buildApiRouter(services), ctx };
}

describe("Router", () => {
  it("returns 404 for an unknown route", async () => {
    const r = new Router();
    const res = await r.handle({ method: "GET", path: "/nope", body: null, ctx: {} as RequestContext });
    expect(res.status).toBe(404);
  });

  it("extracts path params", async () => {
    const r = new Router();
    r.route("GET", "/x/:id", (req) => ({ status: 200, body: req.params.id }));
    const res = await r.handle({ method: "GET", path: "/x/42", body: null, ctx: {} as RequestContext });
    expect(res.body).toBe("42");
  });
});

describe("buildApiRouter", () => {
  it("serves a permitted read as 200", async () => {
    const { router, ctx } = harness(["offers.read"]);
    const res = await router.handle({ method: "GET", path: "/offers", body: null, ctx });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("maps a permission failure to 403 via the domain status hint", async () => {
    const { router, ctx } = harness(["offers.read"]); // lacks offers.create
    const res = await router.handle({
      method: "POST",
      path: "/offers",
      body: {
        programId: "prog_1",
        name: "x",
        scope: [{ kind: "all" }],
        conditions: [],
        calculation: { kind: "percentage", basisPoints: 1000 },
        reward: { kind: "cash" },
        schedule: { kind: "always" },
        limits: [],
      },
      ctx,
    });
    expect(res.status).toBe(403);
    expect((res.body as { error: string }).error).toBe("permission_denied");
  });
});
