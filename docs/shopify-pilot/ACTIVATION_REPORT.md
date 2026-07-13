# Reporte de Activación — Persistencia alojada + Host + Preparación Shopify

> Rama `feat/creator-marketplace`. **Sin merge, sin push, sin deploy, sin instalación.** El código
> es la fuente de verdad. Los engines no importan Prisma/Shopify. Modo local intacto.

## 1. Resumen ejecutivo

Se sentó la base de **persistencia alojada** y **host productivo** sin reescribir lógica de negocio.
El **esquema Prisma** ahora cubre **las 59 colecciones** del runtime (antes solo ~28 de afiliados) —
resuelve la inconsistencia crítica del reporte previo. Se añadió **selección explícita de modo de
persistencia** con hard-fail (sin fallback silencioso a memoria), una **suite de contrato de store
compartida**, rutas públicas **`/health`/`/ready`**, **redacción de secretos en logs** y `.env.example`.
Todo verde: **19 paquetes, 218 tests**, typecheck/lint/build OK. Lo que **no** se hizo es lo que
requiere entorno/credenciales externas: **generar el cliente Prisma** (los install scripts están
bloqueados en esta máquina) + una **Postgres real**, el **host HTTP con framework productivo** y las
**rutas HTTP OAuth/webhook/app-proxy** montadas, y la **UI embebida App Bridge**.

## 2. Archivos creados
- `docs/PERSISTENCE_INVENTORY.md` — inventario exacto de las 59 colecciones (Bloque 1).
- `packages/persistence/src/config.ts` — modos de persistencia + validación + factory (Bloque 4).
- `packages/persistence/src/contract/store-contract.ts` + `.test.ts` — suite compartida (Bloque 5).
- `packages/persistence/sql/0002_creator_shopify.sql` — DDL de las 31 tablas nuevas + triggers (Bloque 3).
- `packages/web/src/observability.ts` — health/ready + redacción + log estructurado (Bloque 6/14).
- `.env.example` — variables por entorno, sin secretos (Bloque 13).
- `docs/shopify-pilot/ACTIVATION_REPORT.md` — este reporte.

## 3. Archivos modificados
- `packages/persistence/prisma/schema.prisma` — +31 modelos (60 total) para cubrir el runtime.
- `packages/persistence/src/index.ts` — export de `config`.
- `packages/web/src/app.tsx` — rutas públicas `/health`/`/ready` + `jsonResponse`.
- `packages/web/src/web.test.ts` — +2 tests (health, redacción).
- Docs: `DECISIONS.md` (D-325), `docs/23-persistence.md`, `docs/03-data-model.md`, `BUILD_STATUS.md`,
  `CHANGELOG.md`, `PROJECT_CONTEXT.md`, `TECHNICAL_HANDOFF.md`.

## 4. Modelo de datos
- **Modelos Prisma finales: 60** (cubren las **59 colecciones** del runtime + relación FK Organization↔Business).
- **Patrón (D-325):** cada agregado nuevo = fila **JSONB indexada** (columnas clave/tenant/únicas reales
  + `data JSONB` + `version`). Núcleo afiliados conserva columnas completas (sin cambios).
- **Relaciones/índices:** índices por tenant en todas las tablas empresariales; únicos de idempotencia
  (`shopify_installations.shop`, `webhook_events(shop,topic,webhook_id)`, `evaluation_schemes.program`,
  `creator_applications(opportunity_id,creator_id)`, etc.).
- **Dinero:** minor units como string dentro de JSON (o `BigInt` en el núcleo) — **exacto, sin float**.
- **Multi-tenant:** columnas `tenant_id`/`business_id` reales e indexadas; el tenant nunca depende del
  frontend (se resuelve del contexto/shop verificado).

## 5. Persistencia
- **Driver implementado:** `memoryDriver` (in-memory `RelationalStore`) — completo y probado.
- **Driver Postgres:** **puerto + config + DDL + plan** listos; la **implementación ejecutable** exige
  cliente Prisma generado + DB (gate de entorno; ver §11). `createUnitOfWork(postgres)` **lanza** si no
  hay driver (sin fallback silencioso).
- **Transacciones / Unit of Work:** `UnitOfWork` + `RelationalStore.transact` (snapshot/rollback) intactos.
- **Contract tests:** `runStoreContract` (create/read/unique/tenant-isolation/version-conflict/append-only/
  idempotencia/rollback/money/date) — verde contra memoria; misma suite para Postgres al activarse.
- **Modos soportados:** `memory` (default, local) y `postgres` (explícito, hard-fail).

## 6. Host HTTP
- **Estrategia elegida (provisional):** conservar el **host Node HTTP** existente (`packages/web/src/server.ts`)
  con estructura productiva + rutas de salud, en vez de introducir un framework grande ahora. Justificación:
  menor impacto arquitectónico, cero dependencias nuevas, mantiene verde/offline. La decisión de framework
  productivo (Next/NestJS/Fastify) para las **rutas HTTP Shopify + UI embebida** se registra como pendiente
  en `DECISIONS.md` (próxima sub-fase).
- **Rutas implementadas:** `GET /health`, `GET /healthz`, `GET /ready`, `GET /readyz` (JSON público, sin
  secretos; `/ready` 200/503 según checks). Assets/PWA/manifest y todas las rutas de app existentes.
- **Manejo de errores:** respuesta 500 genérica sin stack en UI; logs con `redactSecrets`.
- **Pendiente (montaje HTTP):** OAuth begin/callback, webhooks (raw body), app-proxy, session-token embebido
  — su **lógica/servicios ya están probados** (`InstallationService`/`WebhookService`/`OnboardingService`,
  HMAC, idempotencia, dead-letter, aislamiento cross-shop). Falta exponerlos como rutas del host.

## 7. Shopify
- **OAuth:** verificación HMAC de callback (`verifyOAuthHmac`) ✅; **intercambio de token (red)** pendiente
  (puerto `ShopifyApiPort` a implementar con fake/real).
- **Webhooks:** HMAC + idempotencia + dead-letter ✅ (servicio + tests); **endpoint HTTP** por montar.
- **Sesiones:** modelo offline/online + resolución de tenant desde shop verificado ✅; **verificación de
  session-token App Bridge** pendiente (delivery).
- **Onboarding:** `OnboardingService` persistido + idempotente ✅.
- **Contexto de tenant:** `resolveTenant(shop)` deriva tenant de la instalación verificada ✅.
- **UI embebida mínima:** **pendiente** (requiere host + App Bridge; no ejecutable sin tienda/deploy).
- **Requiere credenciales externas:** app Partner, client id/secret, URLs, dev store.

## 8. Seguridad
- **Implementado + probado:** HMAC constante (webhook/app-proxy/OAuth), tenant desde shop verificado,
  aislamiento cross-tenant y cross-shop, idempotencia (orders/conversions/webhooks/installs), `validateEnvironment`
  + `validatePersistenceConfig` (rechazan config insegura/mixta), **sin secretos/tokens al navegador ni en logs**
  (`redactSecrets`), RBAC deny-by-default, dinero append-only.
- **Pendiente (delivery):** OAuth state/nonce en rutas HTTP, CSRF, rate limiting, cookies seguras,
  headers de seguridad, verificación session-token — diseñados en `SECURITY.md`, a implementar al montar el host.

## 9. Pruebas (resultados exactos)
- `pnpm verify` → **Tasks: 19/19**, typecheck OK, lint OK, build OK.
- **Test Files: 30 · Tests: 218 (todos verdes).** Nuevos: `store-contract.test.ts` (6), health+redacción (2),
  + los 21 del adaptador Shopify de la fase previa.
- **Prisma validate:** **no ejecutado** — el CLI de Prisma no está instalado y los install scripts están
  bloqueados en esta máquina; validación diferida (gate de entorno). El schema es artefacto (no entra al build TS).
- **Pruebas de host:** `/health`/`/ready` verificadas por test; endpoints Shopify HTTP aún no montados.

## 10. Estado de la aplicación (honesto)
| Estado | Valor |
|---|---|
| Ejecutable localmente (memoria+JSON) | **SÍ** |
| Ejecutable con Postgres | **NO todavía** (falta generar cliente Prisma + DB; config + schema + DDL listos) |
| Desplegable | **NO** (falta host productivo + entorno) |
| Preparada para instalación Shopify | **Parcial** (adaptador/servicios listos; faltan rutas HTTP + UI embebida) |
| Instalada en Shopify | **NO** |
| Lista para producción | **NO** |

## 11. Bloqueadores externos (para la próxima fase)
Lo que se necesitará configurar de forma segura (no incluir secretos aquí):
- **Cuenta Shopify Partner** + **app Partnera** creada (separada de la app de rewards).
- **Client ID / API key** y **Client secret** (vía gestor de secretos/entorno).
- **Scopes** aprobados (`read_products,read_orders,read_customers`).
- **Development store** para instalar primero.
- **Base Postgres** alojada + **proveedor de hosting** + **URL pública HTTPS**.
- **Habilitar install scripts** localmente (`npm approve-scripts`) para generar el cliente Prisma, o
  generar/compilar el cliente en el entorno de despliegue.
- **Autorización de deploy** y **autorización de instalación**.

## 12. Próxima orden recomendada
**Otra sub-fase técnica local** antes del deploy: (a) implementar el **driver Prisma/Postgres** detrás del
`StoreDriver` + correr la **suite de contrato** contra una Postgres efímera; (b) **montar el host productivo**
con las rutas HTTP Shopify (OAuth/webhook/app-proxy/session-token) sobre los servicios ya probados, con un
`ShopifyApiPort` fake para tests; (c) **UI embebida mínima** con App Bridge. Cuando (a)–(c) estén verdes,
recién entonces: **Deploy controlado + instalación en una Shopify Development Store** (con las credenciales/
hosting de Brian). No continuar con deploy/instalación en esta fase.
