import { describe, expect, it } from "vitest";
import { canTransitionApproval, isEngineCompatible, transitionApproval } from "./lifecycle";
import { type ExtensionManifest } from "./manifest";
import { validateManifest } from "./validation";

function manifest(partial: Partial<ExtensionManifest>): ExtensionManifest {
  return {
    key: "cool-report",
    name: "Cool Report",
    version: "1.0.0",
    type: "reporting_module",
    scopes: ["read:analytics"],
    hooks: ["report.define"],
    engineCompat: "^1.0.0",
    declarative: true,
    ...partial,
  };
}

describe("validateManifest", () => {
  it("accepts a well-formed, least-privilege manifest", () => {
    expect(validateManifest(manifest({})).ok).toBe(true);
  });

  it("rejects disallowed scopes", () => {
    const result = validateManifest(manifest({ scopes: ["write:payouts"] }));
    expect(result.ok).toBe(false);
  });

  it("rejects scopes requested without any hook (least privilege)", () => {
    const result = validateManifest(manifest({ hooks: [] }));
    expect(result.ok).toBe(false);
  });

  it("rejects an invalid version", () => {
    expect(validateManifest(manifest({ version: "1.0" })).ok).toBe(false);
  });
});

describe("approval lifecycle", () => {
  it("allows only legal transitions", () => {
    expect(canTransitionApproval("submitted", "in_review")).toBe(true);
    expect(canTransitionApproval("submitted", "published")).toBe(false);
    expect(transitionApproval("approved", "published")).toBe("published");
    expect(() => transitionApproval("published", "in_review")).toThrow();
  });
});

describe("engine compatibility", () => {
  it("matches caret ranges within the same major", () => {
    expect(isEngineCompatible("1.4.0", "^1.0.0")).toBe(true);
    expect(isEngineCompatible("2.0.0", "^1.0.0")).toBe(false);
    expect(isEngineCompatible("1.0.0", ">=1.0.0")).toBe(true);
    expect(isEngineCompatible("0.9.0", "^1.0.0")).toBe(false);
  });
});
