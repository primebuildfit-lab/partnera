// Remove stale build outputs before a release so nothing old can be reused.
//
// Deletes ONLY generated artifacts — never user data (which lives in the OS
// app-data dir, not the repo) and never secrets. Specifically:
//   • the regenerated runtime resources (server.cjs, build-info.json)
//   • previously produced NSIS installers (so an old setup.exe can't be shipped)
// node.exe is left in place: it is a verbatim copy of the Node runtime and is
// overwritten idempotently by `prepare:node`; re-copying ~90 MB every release is
// wasteful and it can never be "stale" in a way that matters.
import { existsSync, rmSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(here, "..");
const resources = join(desktopRoot, "src-tauri", "resources");
const nsisDir = join(desktopRoot, "src-tauri", "target", "release", "bundle", "nsis");

function rm(path, label) {
  if (existsSync(path)) {
    rmSync(path, { recursive: true, force: true });
    console.log(`[clean] removed ${label}`);
  }
}

// 1) Regenerated runtime descriptors (server.cjs + build-info.json).
rm(join(resources, "server.cjs"), "resources/server.cjs");
rm(join(resources, "build-info.json"), "resources/build-info.json");

// 2) Old installers — remove every previously built NSIS setup so a stale one
//    can never be mistaken for the new release.
if (existsSync(nsisDir)) {
  for (const name of readdirSync(nsisDir)) {
    if (name.toLowerCase().endsWith(".exe")) {
      const p = join(nsisDir, name);
      const mb = (statSync(p).size / (1024 * 1024)).toFixed(1);
      rm(p, `old installer ${name} (${mb} MB)`);
    }
  }
}

console.log("[clean] done — runtime + installers will be regenerated fresh.");
