// Build the Tauri updater manifest (`creator-latest.json`) for the Partnera
// Creator desktop thin client.
//
// `tauri build` (with `bundle.createUpdaterArtifacts: true` and a signing key in
// TAURI_SIGNING_PRIVATE_KEY / TAURI_SIGNING_PRIVATE_KEY_PATH) emits the NSIS
// installer plus a detached minisign `.sig`. This script pairs the two into the
// manifest the installed app polls.
//
// Usage:
//   node scripts/make-release-manifest.mjs --base-url <url-prefix> [--notes "…"] [--out <file>]
//
// `--base-url` is the directory the installer will be downloadable from, e.g.
//   https://github.com/<owner>/<repo>/releases/download/v0.1.1
// For a local end-to-end test it can be http://127.0.0.1:8787.
//
// The emitted `platforms` key is `windows-x86_64`, which is what the updater
// looks up on 64-bit Windows.

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(here, "..");
const bundleDir = join(desktopRoot, "src-tauri", "target", "release", "bundle", "nsis");

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

const baseUrl = arg("base-url");
if (!baseUrl) {
  console.error("[manifest] --base-url is required (the directory the installer is served from)");
  process.exit(1);
}

const version = JSON.parse(
  readFileSync(join(desktopRoot, "src-tauri", "tauri.conf.json"), "utf8"),
).version;

// Find the signed NSIS installer for exactly this version. Being strict here is
// deliberate: silently shipping a manifest that points at a stale installer is
// the kind of thing that only shows up on a user's machine.
let entries;
try {
  entries = readdirSync(bundleDir);
} catch {
  console.error(`[manifest] no NSIS bundle directory — run \`pnpm desktop:build\` first (${bundleDir})`);
  process.exit(1);
}

const setup = entries.find((f) => f.endsWith("-setup.exe") && f.includes(version));
if (!setup) {
  console.error(`[manifest] no installer for version ${version} in ${bundleDir}`);
  console.error(`[manifest] found: ${entries.join(", ") || "(nothing)"}`);
  process.exit(1);
}

const sigFile = `${setup}.sig`;
if (!entries.includes(sigFile)) {
  console.error(`[manifest] missing signature ${sigFile}.`);
  console.error("[manifest] the build did not sign — set TAURI_SIGNING_PRIVATE_KEY_PATH (and");
  console.error("[manifest] TAURI_SIGNING_PRIVATE_KEY_PASSWORD) and rebuild.");
  process.exit(1);
}

const signature = readFileSync(join(bundleDir, sigFile), "utf8").trim();
if (!signature) {
  console.error(`[manifest] signature file ${sigFile} is empty`);
  process.exit(1);
}

/**
 * The asset name as GitHub will actually serve it.
 *
 * GitHub rewrites release-asset filenames, replacing every character outside
 * `[A-Za-z0-9._-]` with a dot — so `Partnera Creator_0.1.1_x64-setup.exe` is
 * served as `Partnera.Creator_0.1.1_x64-setup.exe`. Pointing the manifest at the
 * local filename yields a 404 at download time: the updater finds the new
 * version, tells the user, then fails. The product name contains a space, so
 * this always applies here.
 */
function githubAssetName(fileName) {
  return fileName.replace(/[^A-Za-z0-9._-]/g, ".");
}

const assetName = githubAssetName(setup);

const manifest = {
  version,
  notes: arg("notes", `Partnera Creator ${version}`),
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `${baseUrl.replace(/\/+$/, "")}/${assetName}`,
    },
  },
};

const out = arg("out", join(bundleDir, "creator-latest.json"));
writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n", "utf8");
console.log(`[manifest] ${version} → ${out}`);
console.log(`[manifest] installer: ${setup}`);
if (assetName !== setup) {
  console.log(`[manifest] asset served by GitHub as: ${assetName}`);
}
console.log(`[manifest] url: ${manifest.platforms["windows-x86_64"].url}`);
console.log("[manifest] verify the URL returns 200 before trusting the release.");
