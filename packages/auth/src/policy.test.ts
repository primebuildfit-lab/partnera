import { asId, type RoleId, type UserId } from "@partnera/core";
import { describe, expect, it } from "vitest";
import { PermissionEngine, type Principal } from "./policy";
import { findSystemRole, materializeSystemRole } from "./roles";

const engine = new PermissionEngine();

function principalWithRole(key: string): Principal {
  const template = findSystemRole(key);
  if (!template) throw new Error(`unknown role ${key}`);
  const role = materializeSystemRole(template, asId<RoleId>(`role_${key}`));
  return { userId: asId<UserId>("user_1"), roles: [role] };
}

describe("PermissionEngine", () => {
  it("denies by default when no role grants the permission", () => {
    const affiliate = principalWithRole("affiliate");
    expect(engine.can(affiliate, "offers.create")).toBe(false);
    expect(() => engine.require(affiliate, "offers.create")).toThrow(/Missing permission/);
  });

  it("grants exact matches", () => {
    const finance = principalWithRole("finance");
    expect(engine.can(finance, "payouts.execute")).toBe(true);
  });

  it("platform admin wildcard grants everything", () => {
    const admin = principalWithRole("platform_admin");
    expect(engine.can(admin, "anything.at.all" as never)).toBe(true);
    expect(engine.can(admin, "payouts.execute")).toBe(true);
  });

  it("supports resource wildcards in custom grants", () => {
    const principal: Principal = {
      userId: asId<UserId>("user_2"),
      roles: [
        {
          id: asId<RoleId>("role_custom"),
          key: "offers_manager",
          name: "Offers Manager",
          scopeLevel: "business",
          permissions: ["offers.*"],
          isSystem: false,
        },
      ],
    };
    expect(engine.can(principal, "offers.activate")).toBe(true);
    expect(engine.can(principal, "payouts.execute")).toBe(false);
  });

  it("enforces separation of duties: support cannot approve payouts", () => {
    const support = principalWithRole("support");
    expect(engine.can(support, "payouts.read")).toBe(true);
    expect(engine.can(support, "payouts.approve")).toBe(false);
  });
});
