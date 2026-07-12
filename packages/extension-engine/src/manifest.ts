/**
 * Extension manifest and its safety model.
 *
 * The cardinal rule: **never arbitrary code execution in the core.** Extensions
 * are declarative-first; anything executable is heavily sandboxed and must
 * declare least-privilege scopes and hooks up front. This module defines the
 * manifest contract and its validation. See docs/10-extensions.md.
 */
export type ExtensionType =
  | "offer_template"
  | "affiliate_template"
  | "tracking_module"
  | "reporting_module"
  | "marketing_tool"
  | "automation_module"
  | "widget"
  | "integration"
  | "analytics_module";

/** The allow-list of capability scopes an extension may request. */
export const ALLOWED_SCOPES = [
  "read:offers",
  "read:campaigns",
  "read:affiliates",
  "read:analytics",
  "read:conversions",
  "write:notifications",
  "render:widget",
] as const;
export type ExtensionScope = (typeof ALLOWED_SCOPES)[number];

/** The allow-list of hooks an extension may bind to. */
export const ALLOWED_HOOKS = [
  "offer.template.provide",
  "report.define",
  "analytics.metric.define",
  "automation.trigger",
  "widget.render",
] as const;
export type ExtensionHook = (typeof ALLOWED_HOOKS)[number];

export interface ExtensionManifest {
  readonly key: string;
  readonly name: string;
  /** Semantic version, e.g. "1.2.0". */
  readonly version: string;
  readonly type: ExtensionType;
  readonly scopes: readonly string[];
  readonly hooks: readonly string[];
  /** Engine compatibility range, e.g. "^1.0.0". */
  readonly engineCompat: string;
  /**
   * Declarative extensions carry only data/config (no logic) and are always
   * preferred. Non-declarative extensions MUST run sandboxed.
   */
  readonly declarative: boolean;
}
