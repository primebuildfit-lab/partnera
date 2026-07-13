# Deploy — Partnera (Railway + Postgres) · Block 9

> Todo queda **preparado**; **nada se despliega** en esta fase. Deploy e instalación son acciones
> de Brian (credenciales/infra/consentimiento).

## Artefactos listos en el repo
- `Dockerfile` — build multi-paso (pnpm, `pnpm build` + bundle web, `prisma generate`), corre
  `packages/web/dist/server.mjs`, `HEALTHCHECK` sobre `/health`.
- `railway.json` — builder Dockerfile, `startCommand`, `healthcheckPath=/health`, restart policy.
- `.env.example` — variables por entorno (sin secretos).
- Validación de arranque: `@partnera/shopify` `validateEnvironment` + `@partnera/persistence`
  `validatePersistenceConfig` → el proceso **rechaza** config insegura/mixta.

## Pasos de deploy (los ejecuta Brian)
1. Crear proyecto en Railway + añadir **Postgres** (obtiene `DATABASE_URL`).
2. Configurar variables (Railway → Variables): `NODE_ENV=production`, `PARTNERA_PERSISTENCE=postgres`,
   `DATABASE_URL` (del plugin), `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`,
   `SHOPIFY_AUTH_CALLBACK_URL`, `TOKEN_ENCRYPTION_KEY`, `SESSION_SECRET`. **Nunca** commitear secretos.
3. Migraciones: `prisma migrate deploy` (o aplicar `sql/0001_init.sql` + `sql/0002_creator_shopify.sql`).
4. Deploy (push/CLI). Verificar `GET /health` = 200 y `GET /ready` = 200.
5. En la Shopify Partner app: fijar **Application URL** = `SHOPIFY_APP_URL` y **Redirect URL** =
   `.../api/auth/callback`; suscribir webhooks a `.../api/webhooks`.
6. Instalar en una **Development Store** (primero un clon), abrir el dashboard embebido.

## Rutas que el host ya expone
`GET /health`, `GET /ready`, `GET /shopify/install?shop=`, `GET /api/auth/callback`,
`POST /api/webhooks`, `GET /shopify/app` (embebido). En local usan **fakes** (sin red); en deploy,
al definir `SHOPIFY_API_KEY/SECRET`, se inyectan los adaptadores reales (`ShopifyApiPort`,
verificador de session-token) — ver `shopify-routes.ts`.

## Adaptador real `ShopifyApiPort` (plantilla, se añade en deploy)
```ts
// PgShopifyApi / RealShopifyApi — usa fetch a la Admin API. NO se compila aquí
// (requiere red + secretos). Reemplaza a FakeShopifyApi cuando SHOPIFY_API_* están presentes.
class RealShopifyApi implements ShopifyApiPort {
  constructor(private apiKey: string, private apiSecret: string) {}
  async exchangeToken(shop, code) {
    const r = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ client_id: this.apiKey, client_secret: this.apiSecret, code }),
    });
    const j = await r.json();
    return { accessToken: j.access_token, scope: j.scope };
  }
  // getShopInfo / registerWebhooks: GET/POST a la Admin API con X-Shopify-Access-Token.
}
```

## Cliente Postgres real `PgSqlClient` (plantilla)
El driver `SqlStore` ya está probado con `InMemorySqlClient`. En deploy se provee un `PgSqlClient`
(node-postgres) que implementa `SqlClient` (`loadTable`/`upsert`/`remove`/`begin`/`commit`/`rollback`)
con SQL parametrizado sobre las tablas de `sql/0002`. `createUnitOfWork({mode:"postgres",...},
postgresDriver(new PgSqlClient(pool)))`.
