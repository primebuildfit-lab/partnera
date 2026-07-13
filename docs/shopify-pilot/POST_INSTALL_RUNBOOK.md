# Post-Install Runbook — Partnera (staging/pilot)

> Operativa tras el deploy + instalación. Todo con el host `server-prod.ts` (Postgres, sin fallback
> a memoria). No producción, no App Store.

## Arranque productivo
```bash
# En el host (con pg instalado, DATABASE_URL y secretos configurados):
node --loader tsx packages/web/deploy/server-prod.ts   # o el CMD del contenedor
```
El proceso: valida env (hard-fail) → conecta Postgres (`ensureSchema`+`ping`) → hydrate → seed si
vacío → sirve. Si falta `DATABASE_URL` o el modo no es `postgres`, **no arranca**.

## Verificación de salud
- `GET /health` → 200 `{status, version, persistence}` (sin secretos).
- `GET /ready` → 200 con `db:"ok"` (o 503 si la DB no responde).

## Verificar la 3ª variante del contract (obligatoria antes de certificar)
```bash
DATABASE_URL=postgres://…/partnera_dev node --loader tsx packages/persistence/deploy/run-contract-pg.ts
# Espera: "PASS — store contract green against real Postgres"
```

## Instalación / OAuth
- Iniciar: `GET /shopify/install?shop=<dev-store>.myshopify.com` → redirige a Shopify (state cookie).
- Callback: `GET /api/auth/callback` (HMAC + state + token exchange + provisión idempotente + registro
  de webhooks). Redirige a `/shopify/app`.

## Webhooks
- Endpoint: `POST /api/webhooks` (raw body + HMAC + idempotencia + dead-letter). Topics: `app/uninstalled`,
  `customers/data_request`, `customers/redact`, `shop/redact`, `orders/create`, `refunds/create`.
- Probar duplicado: reenviar el mismo `X-Shopify-Webhook-Id` → segunda respuesta `duplicate` (una sola vez).
- **No** ejecutar `shop/redact` contra el pilot; usar una tienda desechable.

## Embedded
- `GET /shopify/app` (App Bridge obtiene session token → `Authorization: Bearer <jwt>`), resuelve
  shop→tenant→owner→RequestContext y muestra tienda/tenant/estado/dashboard.

## Migración del pilot PrimeBuild (tras autorización)
1. Dry-run: `installation.pilotMigrationPlan(shop)` → reporte (crear/reutilizar/actualizar; sin duplicados).
2. Backup del JSON local + checksum.
3. Migrar idempotentemente (conservar IDs cuando sea seguro; validar conteos/dinero/fechas/tenants).
4. Verificar: dashboard, aislamiento, sin duplicados; **reiniciar host** y re-verificar.

## Durabilidad
- Escrituras: write-behind → `flush()` por request (transacción). Reinicio → `hydrate()` recarga de
  Postgres. Backups: `pg_dump` (o snapshot del proveedor).

## Observabilidad
- Logs estructurados (`logLine`) con `redactSecrets` (nunca tokens/secretos/authorization/PII).
- Dead-letter de webhooks visible vía `webhooks.deadLetterCount()` / futura pantalla admin.

## Rollback de deploy
- Conservar logs, corregir, redeploy. No continuar a Shopify hasta `/ready` verde en vivo.
