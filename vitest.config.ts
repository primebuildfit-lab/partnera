import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Workspace-wide Vitest config.
 *
 * Aliases resolve `@partnera/*` imports directly to each package's TypeScript
 * source, so tests run against source without requiring a prior `tsc` build.
 * `tsc -b` (typecheck/build) resolves the same packages via their `dist` output
 * through project references — the two paths are kept intentionally separate.
 */
const pkg = (name: string) =>
  fileURLToPath(new URL(`./packages/${name}/src/index.ts`, import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/*.test.ts", "packages/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
  resolve: {
    alias: {
      "@partnera/core": pkg("core"),
      "@partnera/creator-marketplace": pkg("creator-marketplace"),
      "@partnera/shopify": pkg("shopify"),
      "@partnera/auth": pkg("auth"),
      "@partnera/offer-engine": pkg("offer-engine"),
      "@partnera/tracking-engine": pkg("tracking-engine"),
      "@partnera/commission-engine": pkg("commission-engine"),
      "@partnera/payment-engine": pkg("payment-engine"),
      "@partnera/fraud-engine": pkg("fraud-engine"),
      "@partnera/notification-engine": pkg("notification-engine"),
      "@partnera/extension-engine": pkg("extension-engine"),
      "@partnera/analytics": pkg("analytics"),
      "@partnera/platform": pkg("platform"),
      "@partnera/persistence": pkg("persistence"),
      "@partnera/application": pkg("application"),
      "@partnera/http-api": pkg("http-api"),
      "@partnera/web": pkg("web"),
      "@partnera/testing": pkg("testing"),
    },
  },
});
