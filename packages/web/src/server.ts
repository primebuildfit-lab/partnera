import { createServer, type IncomingMessage } from "node:http";
import { createDemoWorld, type DemoWorld } from "./demo";
import { handle, type WebRequest } from "./app";

/**
 * A tiny HTTP host using only Node built-ins (no web framework) — enough to run
 * and explore the three apps locally. It boots the demo world once and dispatches
 * every request through {@link handle}. Production replaces this with a NestJS/
 * Express host and a live persistence/auth wiring (docs/24-delivery-ux.md).
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
  const params = new URLSearchParams(body);
  const out: Record<string, string> = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}

export function startServer(world: DemoWorld, port: number): void {
  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const body = req.method === "POST" ? await readBody(req) : "";
      const webReq: WebRequest = {
        method: req.method ?? "GET",
        path: url.pathname,
        query: url.searchParams,
        cookies: parseCookies(req.headers.cookie),
        form: parseForm(body),
      };
      const response = await handle(world, webReq);
      res.writeHead(response.status, { ...response.headers });
      res.end(response.body);
    })().catch((err) => {
      res.writeHead(500, { "content-type": "text/plain" });
      res.end(`Internal error: ${String(err)}`);
    });
  });
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Partnera web running at http://localhost:${port}  (sign in with a demo user)`);
  });
}

// Entry point when run directly (node dist/server.js).
const port = Number(process.env.PORT ?? 4000);
createDemoWorld()
  .then((world) => startServer(world, port))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start Partnera web:", err);
    process.exit(1);
  });
