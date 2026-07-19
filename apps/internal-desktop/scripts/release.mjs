// One command, the whole chain: `pnpm desktop:release`.
//
// Enforces the correct order and fails fast — Tauri can never be packaged on a
// stale frontend or a red gate:
//
//   clean → typecheck → lint → test → desktop:build
//     (desktop:build itself runs: build-info → bundle server → copy node →
//      validate runtime → tauri build → NSIS installer)
//   → verify installer (exists, size, sha256)
//
// Every step's failure aborts the release. The final block prints the verifiable
// artifact identity (version, build id, installer path, size, checksum).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(here, "..");
const repoRoot = join(desktopRoot, "..", "..");
const nsisDir = join(desktopRoot, "src-tauri", "target", "release", "bundle", "nsis");

const args = new Set(process.argv.slice(2));
const skipTests = args.has("--skip-tests"); // escape hatch; discouraged

// Ensure cargo is reachable for `tauri build` (it lives under ~/.cargo/bin here).
const home = process.env.USERPROFILE ?? process.env.HOME ?? "";
const cargoBin = join(home, ".cargo", "bin");
const PATH = `${cargoBin}${process.platform === "win32" ? ";" : ":"}${process.env.PATH ?? ""}`;
const env = { ...process.env, PATH };

function run(label, cmd, cmdArgs, cwd) {
  console.log(`\n\x1b[1m▶ ${label}\x1b[0m  (${cmd} ${cmdArgs.join(" ")})`);
  const t0 = Date.now();
  const res = spawnSync(cmd, cmdArgs, { cwd, env, stdio: "inherit", shell: true });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (res.status !== 0) {
    console.error(`\n\x1b[31m✗ ${label} failed after ${secs}s — release aborted.\x1b[0m`);
    process.exit(res.status ?? 1);
  }
  console.log(`\x1b[32m✓ ${label} (${secs}s)\x1b[0m`);
}

// 1) Clean stale outputs.
run("clean outputs", "node", ["./scripts/clean-outputs.mjs"], desktopRoot);

// 2) Quality gates (repo root).
run("typecheck", "pnpm", ["typecheck"], repoRoot);
run("lint", "pnpm", ["lint"], repoRoot);
if (!skipTests) run("test", "pnpm", ["test"], repoRoot);
else console.log("\x1b[33m⚠ tests skipped (--skip-tests)\x1b[0m");

// 3) Build the desktop app (regenerates + validates runtime, then tauri build).
run("desktop build (bundle + validate + tauri)", "pnpm", ["desktop:build"], desktopRoot);

// 4) Verify the produced installer.
console.log("\n\x1b[1m▶ verify installer\x1b[0m");
if (!existsSync(nsisDir)) {
  console.error(`\x1b[31m✗ NSIS output dir not found: ${nsisDir}\x1b[0m`);
  process.exit(1);
}
const installers = readdirSync(nsisDir).filter((f) => f.toLowerCase().endsWith(".exe"));
if (installers.length !== 1) {
  console.error(`\x1b[31m✗ expected exactly one installer, found ${installers.length}: ${installers.join(", ")}\x1b[0m`);
  process.exit(1);
}
const installerPath = join(nsisDir, installers[0]);
const bytes = readFileSync(installerPath);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const mb = (bytes.length / (1024 * 1024)).toFixed(1);

const buildInfo = JSON.parse(readFileSync(join(desktopRoot, "src-tauri", "resources", "build-info.json"), "utf8"));

console.log("\n\x1b[1m═══ RELEASE OK ═══\x1b[0m");
console.log(`  version   : ${buildInfo.version}`);
console.log(`  build id  : ${buildInfo.buildId}`);
console.log(`  commit    : ${buildInfo.commit}${buildInfo.dirty ? " (dirty tree)" : ""}`);
console.log(`  built     : ${buildInfo.buildTime}`);
console.log(`  installer : ${installerPath}`);
console.log(`  size      : ${mb} MB`);
console.log(`  sha256    : ${sha256}`);
if (buildInfo.dirty) {
  console.log("\n\x1b[33m  note: built from a tree with uncommitted changes; commit before a real release.\x1b[0m");
}
