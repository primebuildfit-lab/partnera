import { err, ok, type Result, ValidationError } from "@partnera/core";
import {
  ALLOWED_HOOKS,
  ALLOWED_SCOPES,
  type ExtensionManifest,
  type ExtensionType,
} from "./manifest";

const EXTENSION_TYPES: readonly ExtensionType[] = [
  "offer_template",
  "affiliate_template",
  "tracking_module",
  "reporting_module",
  "marketing_tool",
  "automation_module",
  "widget",
  "integration",
  "analytics_module",
];

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

/** Collect every manifest problem for surfacing to the contributor. */
export function validateManifestIssues(manifest: ExtensionManifest): string[] {
  const issues: string[] = [];

  if (!manifest.key || !/^[a-z0-9][a-z0-9-]*$/.test(manifest.key)) {
    issues.push("key must be lowercase kebab/alphanumeric");
  }
  if (!SEMVER.test(manifest.version)) {
    issues.push(`version must be semver (x.y.z), got "${manifest.version}"`);
  }
  if (!EXTENSION_TYPES.includes(manifest.type)) {
    issues.push(`unknown extension type "${manifest.type}"`);
  }

  const badScopes = manifest.scopes.filter(
    (s) => !(ALLOWED_SCOPES as readonly string[]).includes(s),
  );
  if (badScopes.length > 0) {
    issues.push(`disallowed scope(s): ${badScopes.join(", ")}`);
  }

  const badHooks = manifest.hooks.filter((h) => !(ALLOWED_HOOKS as readonly string[]).includes(h));
  if (badHooks.length > 0) {
    issues.push(`disallowed hook(s): ${badHooks.join(", ")}`);
  }

  // Least privilege: an extension must not request scopes with no bound hook use.
  if (manifest.scopes.length > 0 && manifest.hooks.length === 0) {
    issues.push("extension requests scopes but binds no hooks (violates least privilege)");
  }

  return issues;
}

/**
 * Validate a manifest. This is the automated gate that runs BEFORE human review
 * — it can only reject, never approve (approval is always a human decision).
 */
export function validateManifest(
  manifest: ExtensionManifest,
): Result<ExtensionManifest, ValidationError> {
  const issues = validateManifestIssues(manifest);
  if (issues.length > 0) {
    return err(new ValidationError("Extension manifest is invalid", { issues }));
  }
  return ok(manifest);
}
