# Fase 7 — Certificación final

> Evalúa el **estado real instalado**. Como la orden exige, **no se declara "certified" con solo
> pruebas locales**, y **no se sustituye Postgres real por memoria durante la certificación**. En
> esta máquina no hay Postgres/`pg`/deploy/Shopify real, así que la instalación **no ocurrió**.

## Clasificación final

> ## PARTNERA NOT INSTALLED
>
> No se obtuvo autorización/credenciales ni se completó la instalación. **No es un fallo del
> producto:** todo el código de activación (driver Postgres real, host productivo, adaptadores
> Shopify reales) está implementado y listo; faltan recursos externos y autorización de Brian, y
> un entorno con `pg`/Postgres (esta máquina bloquea install scripts y no tiene DB).

## Tabla de criterios

| Criterio | Estado |
|---|---|
| Postgres real conectado | **NO** (código real listo; sin DB/`pg` aquí) |
| Contract suite contra Postgres real | **NO** (runner listo: `deploy/run-contract-pg.ts`) |
| Prisma generado y validado | **NO** (CLL no instalable — install scripts bloqueados) |
| Migraciones reales aplicadas | **NO** (`sql/0001`+`sql/0002` listos) |
| Deploy realizado | **NO** (`server-prod.ts`/`Dockerfile`/`railway.json` listos) |
| Health/ready públicos verdes | **NO en vivo** (verdes en local) |
| Shopify App configurada | **NO** (acción de Brian) |
| OAuth real probado | **NO** (adaptador real listo; probado con fakes) |
| Webhooks reales probados | **NO** (lógica probada con fakes) |
| Session token real probado | **NO** (`RealSessionTokenVerifier` listo) |
| Embedded App real | **NO** (mínima probada con contexto resuelto) |
| Onboarding idempotente real | **NO en vivo** (idempotencia probada local) |
| PrimeBuild pilot migrado | **NO** (dry-run listo; migración requiere autorización) |
| Aislamiento real verificado | **NO en Postgres real** (verificado en memoria + cross-shop) |
| Reinicio conserva datos | **NO en Postgres** (verificado en modo JSON local) |
| Empresa validada | **local SÍ · en vivo NO** |
| Creador validado | **local SÍ · en vivo NO** |
| Afiliado validado | **local SÍ · en vivo NO** |
| Shopify Mobile probado | **NO** (requiere app instalada) |
| E2E críticos verdes | **local SÍ (con fakes) · en vivo NO** |
| Pilot certificado | **NO** |
| Producción | **NO** |

## Qué SÍ quedó certificado localmente (verde, 230 tests)
Driver Postgres (SqlStore) pasa la **misma contract suite** que memoria; host con OAuth/webhook/
session-token/embedded **montado y probado con fakes** (HMAC/state/idempotencia/dead-letter/uninstall/
token-expirado/tenant-del-shop-verificado/sin fuga de token); provisión idempotente de tenant +
aislamiento cross-tenant y cross-shop; pilot dry-run; env hard-fail sin fallback.

## Bloqueadores (todos externos)
1. **Sin Postgres real** + sin poder instalar `pg`/`@prisma/client` (install scripts bloqueados).
2. **Sin app Shopify Partner** ni tienda de desarrollo.
3. **Sin hosting/HTTPS/deploy** ni autorización de deploy/instalación/migración.

## Acción única y precisa que Brian debe realizar (§Brian)
> **Provisionar el entorno de activación y autorizar el deploy+instalación**, en un solo bloque:
> 1) Crear la **Shopify Partner App "Partnera"** (Client ID/Secret; App URL + `/api/auth/callback`;
> webhooks → `/api/webhooks`; scopes `read_products,read_orders,read_customers`).
> 2) Provisionar **hosting (Railway) + Postgres** (obtener `DATABASE_URL`) + **URL HTTPS**.
> 3) Configurar variables (sin commitear secretos; ver `.env.example`) y **habilitar la generación
> del cliente Prisma** (`npm approve-scripts` local o build de deploy) + instalar `pg`.
> 4) **Autorizar** el deploy, las migraciones (`sql/0001`+`sql/0002`) y la instalación en una
> **Development Store** (clon primero).
>
> Con eso, yo continúo exactamente desde el Bloque 1 (correr `run-contract-pg.ts` contra la Postgres
> real) → deploy → OAuth real → webhooks → session token → embedded → onboarding → migración del
> pilot → validación de 3 perfiles → aislamiento real → móvil → durabilidad → E2E → certificación.
> No pidas secretos en el chat; configúralos en el gestor de secretos del host.

Runbook operativo: [POST_INSTALL_RUNBOOK.md](POST_INSTALL_RUNBOOK.md).
