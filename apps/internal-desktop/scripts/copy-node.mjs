// Stage the Node.js runtime as a bundled resource for the desktop app.
//
// The Partnera Internal OS desktop runs the existing local web host
// (packages/web/src/server.ts, bundled to resources/server.cjs) inside a private
// Node runtime that Tauri spawns on 127.0.0.1. Bundling node.exe makes the
// installer self-contained: the target machine does NOT need Node installed.
//
// This copies the node.exe that is building the app. Override with PARTNERA_NODE_EXE.
import { copyFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const resourcesDir = join(here, "..", "src-tauri", "resources");
const dest = join(resourcesDir, "node.exe");

const src = process.env.PARTNERA_NODE_EXE ?? process.execPath;
if (!existsSync(src)) {
  console.error(`[copy-node] node.exe not found at ${src}`);
  process.exit(1);
}

mkdirSync(resourcesDir, { recursive: true });
copyFileSync(src, dest);
const mb = (statSync(dest).size / (1024 * 1024)).toFixed(1);
console.log(`[copy-node] staged ${src} -> ${dest} (${mb} MB)`);
