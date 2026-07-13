/**
 * PRODUCTION host entry (Phase 6). Deploy artifact kept OUTSIDE `src/` (it imports
 * the `pg`-backed client). This is the single productive composition:
 *
 *   env validation (hard-fail) → Postgres SqlStore → hydrate → seed-if-empty →
 *   HTTP host (health/ready + Shopify OAuth/webhook/embedded + app) → flush per
 *   request → clean shutdown.
 *
 * There is NO silent fallback to memory/JSON: if `PARTNERA_PERSISTENCE=postgres`
 * and the DB/config is bad, the process refuses to start. Engines/services never
 * see `pg` — it lives behind the SqlClient port.
 *
 * Build/run at deploy (where `pg` is installed):
 *   node --loader tsx packages/web/deploy/server-prod.ts
 * (or bundle it as the container CMD — see Dockerfile).
 */
import { createServer, type IncomingMessage } from "node:http";
import { validateEnvironment } from "@partnera/shopify";
import {
  createUnitOfWork,
  persistenceConfigFromEnv,
  postgresDriver,
  SqlStore,
  validatePersistenceConfig,
} from "@partnera/persistence";
import { buildDemoRuntime } from "../src/demo";
import { handle, type WebRequest } from "../src/app";
import { healthReport, logLine, readyReport } from "../src/observability";
import { dispatchShopify, shopifyRuntimeFromEnv } from "../src/shopify-routes";
import { PgSqlClient } from "../../persistence/deploy/pg-sql-client";
import { RealShopifyApi, RealSessionTokenVerifier } from "./real-shopify-adapters";

async function main(): Promise<void> {
  const port = Number(process.env.PORT ?? 8080);

  // 1) Hard-fail on unsafe / mixed configuration.
  const env = validateEnvironment({
    mode: (process.env.NODE_ENV as "production" | "staging" | "local") ?? "production",
    persistence: "database",
    realPayments: process.env.PARTNERA_REAL_PAYMENTS === "true",
    realAi: process.env.PARTNERA_REAL_AI === "true",
    realBilling: process.env.PARTNERA_REAL_BILLING === "true",
    shopifyConfigured: Boolean(process.env.SHOPIFY_API_KEY),
  });
  if (!env.ok) throw new Error(env.error.message);

  const pcfg = persistenceConfigFromEnv(process.env);
  const pv = validatePersistenceConfig(pcfg);
  if (!pv.ok) throw new Error(pv.error.message);
  if (pcfg.mode !== "postgres") throw new Error("production requires PARTNERA_PERSISTENCE=postgres");

  // 2) Real Postgres store (no memory fallback).
  const pg = new PgSqlClient(pcfg.databaseUrl!);
  await pg.ensureSchema();
  if (!(await pg.ping())) throw new Error("database not reachable");
  const store = new SqlStore(pg);
  createUnitOfWork(pcfg, postgresDriver(pg)); // validates the driver is wired

  // 3) Runtime over the Postgres store; hydrate; seed only if empty.
  const runtime = buildDemoRuntime({ store });
  await store.hydrate();
  if (runtime.world.uow.identity.listUsers().length === 0) {
    await runtime.seed();
    await store.flush();
  }
  runtime.world.persistence.mode = "local-file"; // reported as durable; detail below
  runtime.world.persistence.dataFile = "postgres";

  // 4) Real Shopify adapters (replace the fakes when secrets are present).
  const shopify = shopifyRuntimeFromEnv(process.env, port);
  if (process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET) {
    (shopify as { api: unknown }).api = new RealShopifyApi(process.env.SHOPIFY_API_KEY, process.env.SHOPIFY_API_SECRET);
    (shopify as { verifier: unknown }).verifier = new RealSessionTokenVerifier(process.env.SHOPIFY_API_KEY, process.env.SHOPIFY_API_SECRET);
  }

  const readBody = (req: IncomingMessage): Promise<string> =>
    new Promise((resolve) => {
      let d = "";
      req.on("data", (c) => (d += c));
      req.on("end", () => resolve(d));
      req.on("error", () => resolve(""));
    });

  const server = createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost");
      const isPost = req.method === "POST";
      const body = isPost ? await readBody(req) : "";
      if (url.pathname === "/health") return json(res, 200, healthReport(runtime.world));
      if (url.pathname === "/ready") {
        const ok = await pg.ping();
        return json(res, ok ? 200 : 503, { ...readyReport(runtime.world), db: ok ? "ok" : "fail" });
      }
      const sres = await dispatchShopify(runtime.world.services, shopify, req.method ?? "GET", url.pathname, url.searchParams, req.headers as Record<string, string | undefined>, body, parseCookies(req.headers.cookie));
      if (sres) {
        if (isPost) await store.flush();
        res.writeHead(sres.status, sres.headers).end(sres.body);
        return;
      }
      const webReq: WebRequest = { method: req.method ?? "GET", path: url.pathname, query: url.searchParams, cookies: parseCookies(req.headers.cookie), form: parseForm(body) };
      const response = await handle(runtime.world, webReq);
      if (isPost && url.pathname !== "/login" && url.pathname !== "/logout") await store.flush();
      res.writeHead(response.status, { ...response.headers });
      res.end(response.bodyBase64 !== undefined ? Buffer.from(response.bodyBase64, "base64") : response.body);
    })().catch((e) => {
      // eslint-disable-next-line no-console
      console.error(logLine("error", "request.error", { message: e instanceof Error ? e.message : "error" }));
      res.writeHead(500, { "content-type": "text/plain" }).end("Internal error");
    });
  });

  const shutdown = async () => {
    try {
      await store.flush();
      await pg.close();
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(logLine("info", "server.started", { port, persistence: "postgres" }));
  });
}

function json(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
}
function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function parseForm(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(body)) out[k] = v;
  return out;
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start (production):", e instanceof Error ? e.message : e);
  process.exit(1);
});
