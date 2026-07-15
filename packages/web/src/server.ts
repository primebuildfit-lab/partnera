import { createServer, type IncomingMessage } from "node:http";
import { join } from "node:path";
import { handle, type WebRequest } from "./app";
import { createLocalWorld, type LocalWorld } from "./localWorld";
import { dispatchShopify, shopifyRuntimeFromEnv } from "./shopify-routes";

/**
 * The local HTTP host for daily use — Node built-ins only (no web framework).
 * It loads (or, on first run, seeds) a durable local world from a JSON file,
 * persists after every mutation, and saves once more on shutdown. Configuration
 * is entirely by environment variable; nothing external is contacted.
 *
 *   PORT            port to listen on            (default 4000)
 *   PARTNERA_DATA   path to the data file        (default ./.partnera/data.json)
 *
 * Production replaces this with a NestJS/Next host + a Prisma/Postgres store
 * (MM5); the app code is unchanged (docs/24-delivery-ux.md, INSTALL.md).
 */

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
}

function parseForm(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(body)) out[k] = v;
  return out;
}

/**
 * Desktop entry (`GET /desktop`) — used only by the Tauri Internal OS wrapper.
 * It is a thin, self-contained sign-in that pre-selects the `internal` scope so a
 * platform operator lands directly in the Partnera Internal OS. It does NOT change
 * the shared web login or any public portal, and it grants no privilege of its own:
 * the `/internal` guard still enforces `isPlatformOperator` (deny-by-default), so a
 * business/creator/affiliate identity submitted here is rejected at `/internal`.
 */
const DESKTOP_SESSION_COOKIE = "pt_session";

function desktopLoginPage(defaultEmail: string, error: string | null): string {
  const err = error
    ? `<p style="margin:0 0 16px;padding:10px 12px;border-radius:8px;background:#3a1620;color:#ffb4c0;font-size:13px">${error.replace(/[<>&]/g, "")}</p>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Partnera Internal OS — Sign in</title></head>
<body style="margin:0;font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#0b0d12;color:#e6e8ee;min-height:100vh;display:flex;align-items:center;justify-content:center">
<main style="width:100%;max-width:380px;padding:24px">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
    <span aria-hidden style="width:30px;height:30px;border-radius:8px;background:#6366f1;display:inline-block"></span>
    <h1 style="margin:0;font-size:20px;font-weight:650">Partnera Internal OS</h1>
  </div>
  <div style="background:#141822;border:1px solid #232838;border-radius:12px;padding:20px">
    <h2 style="margin:0 0 4px;font-size:15px">Sign in</h2>
    <p style="margin:0 0 16px;color:#9aa2b4;font-size:12px">Platform operators only.</p>
    ${err}
    <form method="post" action="/login">
      <label for="email" style="display:block;font-size:12px;color:#9aa2b4;margin-bottom:6px">Email</label>
      <input id="email" name="email" type="email" required value="${defaultEmail.replace(/[<>&"]/g, "")}"
        style="width:100%;box-sizing:border-box;padding:9px 11px;border-radius:8px;border:1px solid #2b3142;background:#0f131b;color:#e6e8ee;font-size:14px;margin-bottom:14px">
      <input type="hidden" name="scope" value="internal">
      <button type="submit" style="width:100%;padding:10px;border:0;border-radius:8px;background:#6366f1;color:#fff;font-size:14px;font-weight:600;cursor:pointer">Continue</button>
    </form>
  </div>
  <p style="color:#6b7280;font-size:11px;margin-top:14px;text-align:center">Desktop runtime · loopback only · session validated by the server</p>
</main></body></html>`;
}

export function startServer(local: LocalWorld, port: number): void {
  const shopify = shopifyRuntimeFromEnv(process.env, port);
  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const isPost = req.method === "POST";
      const body = isPost ? await readBody(req) : "";
      const cookies = parseCookies(req.headers.cookie);

      // Desktop (Tauri) entry: pre-select the Internal OS scope. Isolated here so
      // the shared web login and public portals are untouched. Authorization is
      // still enforced downstream by the `/internal` guard (isPlatformOperator).
      if (url.pathname === "/desktop" && !isPost) {
        const sid = cookies[DESKTOP_SESSION_COOKIE];
        const existing = sid ? local.world.sessionStore.get(sid) : undefined;
        if (existing && existing.isPlatformOperator) {
          res.writeHead(303, { location: "/internal" });
          res.end();
          return;
        }
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(desktopLoginPage(local.world.users.admin, url.searchParams.get("error")));
        return;
      }

      // Shopify lifecycle routes (raw body + headers needed for HMAC).
      const shopifyRes = await dispatchShopify(
        local.world.services,
        shopify,
        req.method ?? "GET",
        url.pathname,
        url.searchParams,
        req.headers as Record<string, string | undefined>,
        body,
        cookies,
      );
      if (shopifyRes) {
        if (isPost) {
          try {
            local.save();
          } catch {
            /* best-effort */
          }
        }
        res.writeHead(shopifyRes.status, { ...shopifyRes.headers });
        res.end(shopifyRes.body);
        return;
      }

      const webReq: WebRequest = {
        method: req.method ?? "GET",
        path: url.pathname,
        query: url.searchParams,
        cookies,
        form: parseForm(body),
      };
      const response = await handle(local.world, webReq);
      // Persist after any state-changing workflow (not login/logout).
      if (isPost && url.pathname !== "/login" && url.pathname !== "/logout") {
        try {
          local.save();
        } catch {
          /* best-effort; the in-memory state is still correct */
        }
      }
      res.writeHead(response.status, { ...response.headers });
      if (response.bodyBase64 !== undefined) {
        res.end(Buffer.from(response.bodyBase64, "base64"));
      } else {
        res.end(response.body);
      }
    })().catch((err) => {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(`Internal error: ${String(err)}`);
    });
  });

  const shutdown = (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n${signal} received — saving and shutting down…`);
    try {
      local.save();
    } catch {
      /* ignore */
    }
    server.close(() => process.exit(0));
    // Force-exit if connections linger.
    setTimeout(() => process.exit(0), 2000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Bind to loopback by default so the local host is never exposed on the LAN
  // (the desktop runtime relies on this). Override with PARTNERA_HOST if needed.
  const host = process.env.PARTNERA_HOST ?? "127.0.0.1";
  server.listen(port, host, () => {
    // eslint-disable-next-line no-console
    console.log(
      [
        `Partnera is running at http://${host}:${port}`,
        `  data:      ${local.dataFile}`,
        `  first run: ${local.firstRun ? "yes (demo data seeded)" : "no (loaded existing data)"}`,
        `  sign in:   owner@primebuild.test | brian@primebuild.test | admin@partnera.test`,
        `  stop with Ctrl+C (state is saved on shutdown).`,
      ].join("\n"),
    );
  });
}

const port = Number(process.env.PORT ?? 4000);
const dataFile = process.env.PARTNERA_DATA ?? join(process.cwd(), ".partnera", "data.json");

createLocalWorld(dataFile)
  .then((local) => startServer(local, port))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start Partnera:", err);
    process.exit(1);
  });
