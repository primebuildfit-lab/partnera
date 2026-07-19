// One-command release for Partnera Business.
//
//   pnpm --filter @partnera/business-desktop release          # 0.1.3 -> 0.1.4
//   pnpm --filter @partnera/business-desktop release minor    # 0.1.3 -> 0.2.0
//   pnpm --filter @partnera/business-desktop release 1.0.0    # explicit
//
// It bumps the three version files that must agree, builds and SIGNS the
// installer, publishes the versioned GitHub release, and repoints the rolling
// channel manifest that installed apps poll. After it finishes, every installed
// copy picks the new version up on its next launch.
//
// Signing happens HERE, on this machine, with the key at
// .secrets-tauri/business-updater.key — so this needs no GitHub Actions secret.
// The key never leaves the machine and is never printed.

import { execFileSync, execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const app = join(here, "..");
const repoRoot = join(app, "..", "..");

const KEY = join(repoRoot, ".secrets-tauri", "business-updater.key");
const RELEASES_OWNER = "primebuildfit-lab";
const RELEASES_NAME = "partnera-releases";
const RELEASES_REPO = `${RELEASES_OWNER}/${RELEASES_NAME}`;
const CHANNEL_TAG = "partnera-business-channel-stable";

const CONF = join(app, "src-tauri", "tauri.conf.json");
const CARGO = join(app, "src-tauri", "Cargo.toml");
const PKG = join(app, "package.json");

const die = (msg) => {
  console.error(`\n[release] ✗ ${msg}\n`);
  process.exit(1);
};
const step = (msg) => console.log(`\n[release] ${msg}`);

// `gh` is normally on PATH; fall back to the default Windows install location.
function ghBin() {
  const fallback = "C:\\Program Files\\GitHub CLI\\gh.exe";
  try {
    execFileSync("gh", ["--version"], { stdio: "ignore" });
    return "gh";
  } catch {
    if (existsSync(fallback)) return fallback;
    die("GitHub CLI (`gh`) not found. Install it, or run the manual steps in README.md.");
  }
}
const GH = ghBin();

function gh(args, opts = {}) {
  return execFileSync(GH, args, { encoding: "utf8", ...opts });
}

function nextVersion(current, arg) {
  if (!arg || arg === "patch" || arg === "minor" || arg === "major") {
    const [ma, mi, pa] = current.split(".").map(Number);
    if (arg === "major") return `${ma + 1}.0.0`;
    if (arg === "minor") return `${ma}.${mi + 1}.0`;
    return `${ma}.${mi}.${pa + 1}`;
  }
  if (!/^\d+\.\d+\.\d+$/.test(arg)) die(`"${arg}" is not a version or patch|minor|major`);
  return arg;
}

// --- preflight -------------------------------------------------------------

if (!existsSync(KEY)) {
  die(
    `Signing key missing: ${KEY}\n` +
      `  Without it the build produces no .sig and installed apps reject the update.`,
  );
}
try {
  gh(["auth", "status"], { stdio: "ignore" });
} catch {
  die("GitHub CLI is not authenticated. Run: gh auth login");
}

const conf = JSON.parse(readFileSync(CONF, "utf8"));
const current = conf.version;
const version = nextVersion(current, process.argv[2]);
const tag = `partnera-business-v${version}`;

step(`${current} -> ${version}`);

try {
  gh(["release", "view", tag, "--repo", RELEASES_REPO], { stdio: "ignore" });
  die(`Release ${tag} already exists. Pick a different version.`);
} catch (e) {
  if (e.status === undefined) throw e; // gh missing/crashed, not "not found"
}

// --- bump the three files that must agree ----------------------------------

conf.version = version;
writeFileSync(CONF, JSON.stringify(conf, null, 2) + "\n");

const cargo = readFileSync(CARGO, "utf8").replace(
  /^version = "[^"]+"/m,
  `version = "${version}"`,
);
writeFileSync(CARGO, cargo);

const pkg = JSON.parse(readFileSync(PKG, "utf8"));
pkg.version = version;
writeFileSync(PKG, JSON.stringify(pkg, null, 2) + "\n");

step("versions synced (tauri.conf.json, Cargo.toml, package.json)");

// --- build + sign ----------------------------------------------------------

step("building and signing (this takes several minutes)…");
execSync("pnpm exec tauri build", {
  cwd: app,
  stdio: "inherit",
  env: {
    ...process.env,
    TAURI_SIGNING_PRIVATE_KEY: readFileSync(KEY, "utf8").trim(),
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: "",
    PARTNERA_UPDATE_OWNER: RELEASES_OWNER,
    PARTNERA_UPDATE_REPO: RELEASES_NAME,
  },
});

const bundle = join(app, "src-tauri", "target", "release", "bundle", "nsis");
const exe = join(bundle, `Partnera Business_${version}_x64-setup.exe`);
const sig = `${exe}.sig`;
if (!existsSync(exe)) die(`Installer not found: ${exe}`);
if (!existsSync(sig)) die(`Signature not found: ${sig} — the key did not apply.`);

// GitHub rewrites spaces in asset names to dots; do it ourselves so the URL we
// bake into the manifest matches the asset that actually gets stored.
const asset = `Partnera.Business_${version}_x64-setup.exe`;
const assetPath = join(bundle, asset);
writeFileSync(assetPath, readFileSync(exe));

// --- publish ---------------------------------------------------------------

step(`publishing ${tag} to ${RELEASES_REPO}…`);
gh([
  "release", "create", tag,
  "--repo", RELEASES_REPO,
  "--title", `Partnera Business ${version}`,
  "--notes", `Partnera Business desktop ${version}.\n\nLas instalaciones existentes se actualizan solas al abrir la app.`,
  assetPath, sig,
], { stdio: "inherit" });

const manifest = {
  version,
  notes: `Partnera Business ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature: readFileSync(sig, "utf8").trim(),
      url: `https://github.com/${RELEASES_REPO}/releases/download/${tag}/${asset}`,
    },
  },
};
const manifestPath = join(bundle, "business-latest.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

step("repointing the channel every installed app polls…");
try {
  gh(["release", "view", CHANNEL_TAG, "--repo", RELEASES_REPO], { stdio: "ignore" });
} catch {
  gh([
    "release", "create", CHANNEL_TAG,
    "--repo", RELEASES_REPO,
    "--title", "Partnera Business — canal estable",
    "--notes", "Manifiesto que consultan las instalaciones de Partnera Business.",
  ], { stdio: "inherit" });
}
gh(["release", "upload", CHANNEL_TAG, manifestPath, "--repo", RELEASES_REPO, "--clobber"], {
  stdio: "inherit",
});

console.log(`
[release] ✓ ${version} publicada.

  Release:  https://github.com/${RELEASES_REPO}/releases/tag/${tag}
  Canal:    ${CHANNEL_TAG} -> ${version}

  Cada instalación de Partnera Business se actualizará sola en su próximo
  arranque. No hace falta hacer nada más.
`);
