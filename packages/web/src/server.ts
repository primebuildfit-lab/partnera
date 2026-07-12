import { createServer, type IncomingMessage } from "node:http";
import { join } from "node:path";
import { handle, type WebRequest } from "./app";
import { createLocalWorld, type LocalWorld } from "./localWorld";

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

export function startServer(local: LocalWorld, port: number): void {
  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const isPost = req.method === "POST";
      const body = isPost ? await readBody(req) : "";
      const webReq: WebRequest = {
        method: req.method ?? "GET",
        path: url.pathname,
        query: url.searchParams,
        cookies: parseCookies(req.headers.cookie),
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
      res.end(response.body);
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

  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(
      [
        `Partnera is running at http://localhost:${port}`,
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
