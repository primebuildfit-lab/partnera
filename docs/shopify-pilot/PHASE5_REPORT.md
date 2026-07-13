# Fase 5 — Shopify Activation · Reporte final

> Rama `feat/creator-marketplace`. **Sin merge, sin push, sin deploy, sin instalación.** Todo lo
> implementable localmente quedó hecho y **verde (19 paquetes, 230 tests)**. El código es la fuente
> de verdad; los engines no importan Prisma/Shopify; el modo local permanece.

## Bloque 14 — Clasificación de finalización

| Ítem | Estado | Evidencia |
|---|---|---|
| **Driver Prisma/Postgres** | **SÍ** | `SqlStore` (write-through tras `SqlClient`) pasa la MISMA contract suite que memoria; `postgresDriver`; UnitOfWork-sobre-Postgres con aislamiento. `InMemorySqlClient` (test) + `PgSqlClient` (plantilla deploy). |
| **Host HTTP** | **SÍ** | Host productivo (`server.ts`) con `/health` `/ready` (JSON, sin secretos), request-id, logging con redacción, manejo de errores, y rutas Shopify montadas. |
| **OAuth preparado** | **SÍ** | begin/callback: HMAC + state (CSRF, constante) + token-exchange (`ShopifyApiPort`) + provisión idempotente + registro de webhooks. Fakes para test; adaptador real en deploy. |
| **Webhooks preparados** | **SÍ** | `/api/webhooks`: HMAC + idempotencia (`shop::topic::id`) + dead-letter + `app/uninstalled` + topics de privacidad. |
| **Session Tokens** | **SÍ** | `resolveEmbeddedContext`: verifica token → shop verificado → instalación → tenant → owner → `RequestContext`. Nunca confía en el navegador. |
| **Embedded App** | **SÍ (mínima)** | `renderEmbeddedApp`: tienda/tenant/estado/dashboard; `shopify-api-key` meta; sin filtrar tokens. Bootstrap App Bridge documentado. |
| **Onboarding automático** | **SÍ** | Al instalar: OAuth→tenant→empresa→owner→onboarding→storage default, idempotente (reinstalar no duplica). |
| **PrimeBuild Pilot preparado** | **SÍ** | `pilotMigrationPlan` (dry-run): detecta tenant/config existentes, reporta sin escribir; migración JSON→hosted preparada (no ejecutada). |
| **Deploy preparado** | **SÍ** | `Dockerfile` + `railway.json` + `.env.example` + `DEPLOY.md` + validación de entorno con hard-fail. |
| **Instalación Shopify preparada** | **SÍ** | Runbook `PRIMEBUILD_INSTALLATION.md` + rutas montadas + adaptadores fake→real por entorno. |
| **Instalación Shopify realizada** | **NO** | Requiere credenciales + tienda + consentimiento de Brian. |
| **Producción** | **NO** | Requiere autorización. |

## Bloque 10 — Seguridad (revisado + probado)
OAuth HMAC (constante, forjado rechazado) · state/CSRF (constante) · webhook HMAC (raw body) ·
idempotencia (anti-replay en callbacks/webhooks/install) · session-token inválido/expirado
rechazado · tenant desde shop verificado (nunca del navegador) · tokens/secretos nunca al navegador
ni a logs (`redactSecrets`) · aislamiento cross-tenant y cross-shop · env inseguro → hard-fail.
Pendiente de deploy (documentado): cookies seguras/headers/rate-limit sobre el host real.

## Bloque 11 — Pruebas
**230 tests, 31 files, verde.** Nuevos en esta fase: contract sobre memoria **y** Postgres,
hydrate, UoW-Postgres isolation (persistencia); OAuth begin/callback/HMAC/state, webhook
idempotencia/uninstall/forged, session-token válido/expirado/desinstalado, embedded sin fuga de
token, pilot dry-run. typecheck/lint/build verdes. `prisma validate` **diferido** (CLI no
instalable offline — install scripts bloqueados; el schema es artefacto, no entra al build).

## Bloque 13 — Acciones que Brian debe hacer (exactas)
1. **Crear la Shopify Partner App "Partnera"** (separada de la app de rewards) — obtener **Client ID/API key** y **Client secret**.
2. **Fijar en la app:** Application URL = `SHOPIFY_APP_URL`; Redirect URL = `.../api/auth/callback`; scopes `read_products,read_orders,read_customers`; webhooks → `.../api/webhooks`.
3. **Provisionar hosting + Postgres** (Railway u otro) y obtener `DATABASE_URL`; **URL pública HTTPS**.
4. **Configurar variables** (sin commitear): `NODE_ENV=production`, `PARTNERA_PERSISTENCE=postgres`, `DATABASE_URL`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `SHOPIFY_AUTH_CALLBACK_URL`, `TOKEN_ENCRYPTION_KEY`, `SESSION_SECRET`.
5. **Habilitar la generación del cliente Prisma** (en deploy o local con `npm approve-scripts`) y **correr migraciones** (`sql/0001` + `sql/0002` o `prisma migrate deploy`).
6. **Autorizar el deploy**; verificar `/health` y `/ready` = 200.
7. **Instalar en una Development Store** (clon primero) desde el Partner dashboard; aprobar scopes; abrir el dashboard embebido.

> No incluir secretos en el repo. Todo lo demás (código, adaptadores fake→real, schema, migraciones,
> runbook) ya está listo. Ver `DEPLOY.md` y `PRIMEBUILD_INSTALLATION.md`.

## Lo que falta implementar en deploy (plantillas provistas)
`RealShopifyApi` (fetch a Admin API) y `PgSqlClient` (node-postgres) — plantillas en `DEPLOY.md`;
se inyectan por entorno sin tocar la lógica probada. Verificación real de session-token JWT (firma
del secreto) reemplaza al `FakeSessionTokenVerifier`.
