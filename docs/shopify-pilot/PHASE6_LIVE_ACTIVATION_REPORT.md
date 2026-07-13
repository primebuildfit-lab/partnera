# Fase 6 — Live Activation · Reporte

> Rama `feat/creator-marketplace`. **Honesto:** en esta máquina **no hay `pg`, ni `@prisma/client`,
> ni `psql`, ni `docker`, ni Postgres, y los install scripts están bloqueados** — por eso el deploy,
> la Postgres real y la instalación en Shopify **no pudieron ejecutarse aquí**. Se implementó **todo
> lo completable localmente** (adaptadores reales de deploy + wiring productivo) y se dejó cada
> acción externa como paso preciso para Brian. **No se falseó nada** (regla explícita de la orden).

## Baseline
230 tests verdes · rama `feat/creator-marketplace` · árbol limpio · `pnpm verify` exit 0.
Entorno: `pg`=NO, `@prisma/client`=NO, `psql`=NO, `docker`=NO (verificado).

## Bloque 1 — Cliente Postgres real
- **Implementado (real, no plantilla):** `packages/persistence/deploy/pg-sql-client.ts` — `PgSqlClient`
  sobre `pg.Pool`: `ensureSchema`, `loadTable`, `upsert`/`remove` (write-behind), `flush`
  (transacción `BEGIN/COMMIT/ROLLBACK`), `ping`, `close`. Detrás del puerto `SqlClient` (D-326).
- **Único driver productivo** seleccionable por config (`postgresDriver(new PgSqlClient(url))`);
  `InMemorySqlClient` es un doble de test declarado, no un segundo driver real.
- **Runner de la 3ª variante del contract:** `deploy/run-contract-pg.ts` — corre `runStoreContract`
  contra Postgres real (lo ejecuta Brian con `DATABASE_URL` de desarrollo).
- **Estado:** ✅ código real; **⛔ NO verificado contra Postgres real aquí** (sin DB/`pg`). Por la
  regla de la orden, **este bloque no se marca "terminado"** hasta que la 3ª variante esté verde.

## Bloque 2 — Prisma y migraciones
- Schema (60 modelos) + `sql/0001` + `sql/0002` listos. `prisma validate/generate` y las migraciones
  **requieren instalar el CLI** (install scripts bloqueados) → **acción de Brian** (o entorno deploy).

## Bloque 3 — Infraestructura
- `Dockerfile`, `railway.json`, `.env.example`, validación de arranque (`validateEnvironment` +
  `validatePersistenceConfig`, hard-fail; **sin fallback silencioso a memoria** en producción).
- **Provisión de Railway/Postgres/HTTPS/secretos = acción de Brian.**

## Bloque 4 — Deploy
- **Entry productivo real:** `packages/web/deploy/server-prod.ts` — env hard-fail → `PgSqlClient` →
  `ensureSchema`+`ping` → `SqlStore` → `hydrate` → seed-si-vacío → host (health/ready + rutas Shopify
  + app) → `flush` por request → shutdown limpio con `flush`+`close`. **Deploy = acción de Brian.**

## Bloques 5–7 — Shopify real (OAuth / session token)
- **Adaptadores reales:** `packages/web/deploy/real-shopify-adapters.ts` — `RealShopifyApi`
  (token exchange, shop read, webhook register vía Admin API) y `RealSessionTokenVerifier`
  (JWT HS256: firma + `exp`/`nbf`/`aud` + `dest`→shop). Reemplazan a los fakes cuando
  `SHOPIFY_API_KEY/SECRET` están presentes (`server-prod`).
- **Estado:** ✅ código real; **⛔ OAuth/session-token reales NO probados** (requieren app Partner +
  tienda + deploy) — la lógica está probada con fakes (16 tests), no basta para "validado real".

## Bloques 8–10 — Webhooks / embedded / onboarding reales
- Handlers + rutas montadas (`shopify-host.ts`/`shopify-routes.ts`), idempotencia + dead-letter +
  uninstall, embedded mínimo, onboarding idempotente — **probados con fakes**; la validación **en
  Shopify real** es acción posterior a la instalación (Brian).

## Resumen
Todo el **código de activación** (driver Postgres real, entry productivo, adaptadores Shopify reales)
está **implementado y listo**, fuera del build verde porque requiere `pg`/red no disponibles aquí.
La **activación en vivo (deploy + Postgres real + instalación Shopify)** queda pendiente de recursos
y autorización de Brian. Ver acción única en
[PHASE7_FINAL_CERTIFICATION.md](PHASE7_FINAL_CERTIFICATION.md) §Brian.
