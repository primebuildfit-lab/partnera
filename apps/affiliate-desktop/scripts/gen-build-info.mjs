// Generate the verifiable build-identity descriptor for the Affiliate desktop
// thin client. Same idea as the Operations / Internal OS wrappers: stamp
// version/commit/build time/build id into the bundle so "am I running the
// current build?" is always answerable. The version is owned by tauri.conf.json
// (single source of truth).
//
// Output: apps/affiliate-desktop/src-tauri/resources/build-info.json (gitignored).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(here, "..");
const resourcesDir = join(desktopRoot, "src-tauri", "resources");
const tauriConf = join(desktopRoot, "src-tauri", "tauri.conf.json");

function readVersion() {
  const conf = JSON.parse(readFileSync(tauriConf, "utf8"));
  const v = conf.version;
  if (!v || typeof v !== "string") throw new Error("[build-info] tauri.conf.json has no string `version`");
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
const dirty = git(["status", "--porcelain"]).length > 0;
const buildTime = new Date().toISOString();
const env = process.env.PARTNERA_ENV ?? "desktop";
const stamp = buildTime.replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const buildId = `${version}+${commit}${dirty ? ".dirty" : ""}.${stamp}`;
const apiUrl = process.env.PARTNERA_API_URL ?? "https://partnera-web-production.up.railway.app";

const info = { version, buildId, commit, commitFull, branch, dirty, buildTime, env, apiUrl, kind: "thin-client", app: "affiliate" };

mkdirSync(resourcesDir, { recursive: true });
writeFileSync(join(resourcesDir, "build-info.json"), JSON.stringify(info, null, 2) + "\n", "utf8");
console.log(`[build-info] ${info.version} · build ${info.buildId} · commit ${info.commit}${info.dirty ? " (dirty)" : ""} · api ${info.apiUrl}`);
