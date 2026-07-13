# Shopify App Identity — Partnera

> **Part 2.** Partnera's own Shopify app identity. **No secrets are stored in the repo** — only
> the shape and where each value lives. Partnera must be **its own app**, never reusing
> PrimeBuild's rewards app identity.

## Environments (separate apps/keys)

| Env | App | URL (example) | DB | Money/AI/Billing |
|---|---|---|---|---|
| local | `partnera-dev` | `http://localhost:4000` | file (`.partnera/data.json`) | simulated / mock / off |
| staging/pilot | `partnera-staging` | `https://<staging-host>` | hosted Postgres | simulated / mock / test |
| production (future) | `partnera` | `https://app.partnera.<tld>` | hosted Postgres | 🔒 real (gated) |

Each has its **own** client id/secret. Never share keys across environments.

## `shopify.app.toml` (values provided at deploy, not committed)

```toml
name = "Partnera"
handle = "partnera"                    # distinct from PrimeBuild's rewards app
client_id = "<from Partner dashboard>" # env-specific; not committed
application_url = "<APP_URL>"
embedded = true

[access_scopes]
scopes = "read_products,read_orders,read_customers"   # least privilege (SCOPES.md)

[auth]
redirect_urls = ["<APP_URL>/api/auth/callback", "<APP_URL>/api/auth"]

[webhooks]
api_version = "2024-10"                # pin; upgrade deliberately

[app_proxy]
url = "<APP_URL>/proxy"
subpath = "partnera"
prefix = "apps"
```

## Secrets (never in repo, never to the browser)
`SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`, `SHOPIFY_APP_URL`, `DATABASE_URL`, `SESSION_SECRET`,
`TOKEN_ENCRYPTION_KEY` — supplied via the host's environment/secret manager. The offline access
token is encrypted at rest; only a **reference** is stored (`ShopifyInstallation.tokenRef`).

## Requires Brian (🔒 external)
Create the Partner app(s), obtain client id/secret, set the application/redirect URLs to the
deployed host, and authorize the install. Partnera provides the config; Brian holds the account.
