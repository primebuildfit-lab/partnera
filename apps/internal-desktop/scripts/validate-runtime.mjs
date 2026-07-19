// Gate: fail the build if the bundled runtime is missing, empty, or stale.
//
// This is the guard that makes "Tauri packaged an old dist" impossible. It runs
// at the END of `prepare:runtime`, which is the `beforeBuildCommand` for
// `tauri build`. If the freshly generated `server.cjs` / `node.exe` /
// `build-info.json` are absent or implausibly small, or the stamped version does
// not match `tauri.conf.json`, we exit non-zero so `tauri build` never proceeds
// to wrap a broken or outdated runtime.
import { readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(here, "..");
const resources = join(desktopRoot, "src-tauri", "resources");
const tauriConf = join(desktopRoot, "src-tauri", "tauri.conf.json");

const problems = [];

function size(path) {
  try {
    return statSync(path).size;
  } catch {
    return -1;
  }
}

// 1) server.cjs must exist, be non-trivial, and actually be the Partnera host.
const serverPath = join(resources, "server.cjs");
const serverSize = size(serverPath);
if (serverSize < 200 * 1024) {
  problems.push(`server.cjs missing or too small (${serverSize} bytes, expected > 200 KB)`);
} else {
  const head = readFileSync(serverPath, "utf8");
  // Markers that prove this is the current web host bundle, not an empty stub.
  for (const marker of ["startServer", "/ready", "Partnera"]) {
    if (!head.includes(marker)) problems.push(`server.cjs is missing expected marker "${marker}"`);
  }
}

// 2) node.exe runtime must be staged and full-size (~90 MB).
const nodeSize = size(join(resources, "node.exe"));
if (nodeSize < 40 * 1024 * 1024) {
  problems.push(`node.exe missing or too small (${nodeSize} bytes, expected > 40 MB)`);
}

// 3) build-info.json must exist and match the single source of version truth.
const biPath = join(resources, "build-info.json");
let buildInfo = null;
try {
  buildInfo = JSON.parse(readFileSync(biPath, "utf8"));
} catch {
  problems.push("build-info.json missing or unreadable");
}
if (buildInfo) {
  const conf = JSON.parse(readFileSync(tauriConf, "utf8"));
  if (buildInfo.version !== conf.version) {
    problems.push(`build-info version ${buildInfo.version} != tauri.conf.json ${conf.version}`);
  }
  if (!buildInfo.buildId || !buildInfo.buildTime) {
    problems.push("build-info.json is missing buildId/buildTime");
  }
}

if (problems.length > 0) {
  console.error("[validate-runtime] FAILED — the bundled runtime is not shippable:");
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}

console.log(
  `[validate-runtime] OK · server.cjs ${(serverSize / 1024).toFixed(0)} KB · node.exe ${(nodeSize / (1024 * 1024)).toFixed(0)} MB · build ${buildInfo?.buildId ?? "?"}`,
);
