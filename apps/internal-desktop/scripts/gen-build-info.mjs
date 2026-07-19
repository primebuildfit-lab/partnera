// Generate the single, verifiable build-identity descriptor for the desktop app.
//
// This is the answer to "am I running the current build or a stale one?". Every
// desktop build stamps a `build-info.json` into the bundled resources so the
// version, git commit, build time, and a unique build id travel *inside* the
// installed executable. The web runtime reads it for the Diagnostics view and
// `/health`; the Rust supervisor logs it at boot; the About/Diagnostics screen
// shows it. Because the version is derived from `tauri.conf.json` (the single
// source of truth) and the commit/time are captured at build, two different
// builds can never look identical.
//
// Output: apps/internal-desktop/src-tauri/resources/build-info.json (gitignored).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(here, "..");
const resourcesDir = join(desktopRoot, "src-tauri", "resources");
const tauriConf = join(desktopRoot, "src-tauri", "tauri.conf.json");

/** The version is owned by tauri.conf.json — never hand-typed in two places. */
function readVersion() {
  const conf = JSON.parse(readFileSync(tauriConf, "utf8"));
  const v = conf.version;
  if (!v || typeof v !== "string") {
    throw new Error("[build-info] tauri.conf.json has no string `version`");
  }
  return v;
}

function git(args) {
  try {
    return execFileSync("git", args, { cwd: desktopRoot, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

const version = readVersion();
const commitFull = git(["rev-parse", "HEAD"]) || "unknown";
const commit = commitFull === "unknown" ? "unknown" : commitFull.slice(0, 9);
const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]) || "unknown";
// `--porcelain` prints nothing on a clean tree; any output means uncommitted changes.
const dirty = git(["status", "--porcelain"]).length > 0;
const buildTime = new Date().toISOString();
// Environment: an explicit override wins; otherwise this generator only runs for
// the packaged desktop build, so default to "desktop".
const env = process.env.PARTNERA_ENV ?? "desktop";
// Unique, human-comparable build id: version + short commit (+dirty) + date-time.
const stamp = buildTime.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const buildId = `${version}+${commit}${dirty ? ".dirty" : ""}.${stamp}`;

const info = { version, buildId, commit, commitFull, branch, dirty, buildTime, env };

mkdirSync(resourcesDir, { recursive: true });
const dest = join(resourcesDir, "build-info.json");
writeFileSync(dest, JSON.stringify(info, null, 2) + "\n", "utf8");

console.log(
  `[build-info] ${info.version} · build ${info.buildId} · commit ${info.commit}${info.dirty ? " (dirty)" : ""} · ${info.env}`,
);
