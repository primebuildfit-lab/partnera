// Serve a REAL Tauri update channel from the locally built, locally signed
// artifacts — so the updater can be verified end-to-end without publishing
// anything to GitHub.
//
//   node ./scripts/local-update-channel.mjs [--port 8787] [--dir <nsis dir>]
//
// It finds the `*-setup.nsis.zip` + `.sig` produced by
// `tauri build --config src-tauri/tauri.conf.release.json`, builds the
// `latest.json` manifest Tauri expects, and serves both over loopback.
//
// Point an INSTALLED older build at it and it will detect, download, verify and
// install exactly as it would against GitHub:
//
//   PARTNERA_UPDATE_ENDPOINT=http://127.0.0.1:8787/latest.json \
//     "%LOCALAPPDATA%\Partnera Internal OS\Partnera Internal OS.exe"
//
// `--tamper` corrupts the served payload (leaving the signature untouched) to
// prove a bad package is REJECTED and never installed.
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const desktopRoot = join(here, "..");

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};
const port = Number(flag("port", "8787"));
const tamper = argv.includes("--tamper");
const nsisDir = flag("dir", join(desktopRoot, "src-tauri", "target", "release", "bundle", "nsis"));

if (!existsSync(nsisDir)) {
  console.error(`✗ no NSIS output at ${nsisDir}\n  build first: pnpm exec tauri build --config src-tauri/tauri.conf.release.json`);
  process.exit(1);
}

// Tauri 2 ships the NSIS updater payload as the `-setup.exe` itself plus a
// sibling `.sig` (older docs describe a `.nsis.zip`; this version does not
// produce one).
const payloadName = readdirSync(nsisDir).find((f) => f.endsWith("-setup.exe"));
if (!payloadName) {
  console.error(`✗ no *-setup.exe in ${nsisDir}`);
  process.exit(1);
}
const payloadPath = join(nsisDir, payloadName);
const sigPath = `${payloadPath}.sig`;
if (!existsSync(sigPath)) {
  console.error(`✗ missing signature: ${sigPath}\n  set TAURI_SIGNING_PRIVATE_KEY before building`);
  process.exit(1);
}

// Version comes from the built artifact's own name, never from a hand-typed
// argument — the manifest can then never disagree with the payload it serves.
const version = flag("version", payloadName.match(/_(\d+\.\d+\.\d+)_/)?.[1] ?? "");
if (!version) {
  console.error(`✗ could not read a version out of "${payloadName}"`);
  process.exit(1);
}

const signature = readFileSync(sigPath, "utf8").trim();
const encodedPayload = encodeURIComponent(payloadName);
const manifest = {
  version,
  notes: `Compilación local de verificación ${version}.\n\nCanal de pruebas servido desde 127.0.0.1 — no es una release pública.`,
  pub_date: new Date().toISOString(),
  platforms: {
    "windows-x86_64": {
      signature,
      url: `http://127.0.0.1:${port}/${encodedPayload}`,
    },
  },
};

const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  console.log(`  → ${req.method} ${path}`);

  if (path === "/latest.json") {
    const body = JSON.stringify(manifest, null, 2);
    res.writeHead(200, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
    res.end(body);
    return;
  }

  if (path === `/${payloadName}`) {
    const size = statSync(payloadPath).size;
    // content-length is what drives the real percentage in the progress bar.
    res.writeHead(200, { "content-type": "application/octet-stream", "content-length": size });
    if (tamper) {
      // Flip a byte in the payload but keep the advertised signature: the client
      // must reject this and leave the existing install untouched.
      const bytes = readFileSync(payloadPath);
      bytes[Math.floor(bytes.length / 2)] ^= 0xff;
      res.end(bytes);
    } else {
      createReadStream(payloadPath).pipe(res);
    }
    return;
  }

  res.writeHead(404, { "content-type": "text/plain" });
  res.end("not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log(`\n  Canal de actualización local  ${tamper ? "\x1b[31m[TAMPER: payload corrupto a propósito]\x1b[0m" : ""}`);
  console.log(`  version   : ${version}`);
  console.log(`  payload   : ${payloadName} (${(statSync(payloadPath).size / (1024 * 1024)).toFixed(1)} MB)`);
  console.log(`  manifiesto: http://127.0.0.1:${port}/latest.json\n`);
  console.log(`  Lanza la app instalada con:`);
  console.log(`    PARTNERA_UPDATE_ENDPOINT=http://127.0.0.1:${port}/latest.json\n`);
});
