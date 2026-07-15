# Partnera Internal OS — Desktop Financial Safety

The desktop wrapper does **not** change Partnera's financial architecture. It is a
container around the existing Internal OS; every financial rule, ledger, and validation
runs exactly as in the web app.

## Revenue vs Vault separation is preserved

The Internal OS keeps two strictly separated books (Phase 8 double-ledger):

- **Revenue** (Bank A) — `/internal/finance/revenue`
- **Vault / managed funds** (Bank B) — `/internal/finance/vault`

These are rendered by the unchanged `packages/web/src/pages/internal.tsx`
(`revenuePage`, `vaultPage`) over the unchanged `@partnera/platform-finance` engine.
The desktop loads these routes as-is; it does not merge, net, or re-compute balances.

## What the desktop layer does NOT do

- It does **not** duplicate the database or create a second wallet.
- It does **not** copy financial data to insecure files.
- It does **not** alter balances, commissions, plans, or billing logic.
- It does **not** compute or trust balances in the frontend — all amounts are rendered
  server-side by the existing host and its engines.
- It does **not** add offline/unsynced financial actions.
- It does **not** enable real payments or move real money (the local runtime runs the
  same simulated/local world as the web dev host; production payments stay behind the
  backend and its env flags, untouched).

## Server-side authority

Every sensitive action continues to be validated on the server (the spawned host):
authorization (`isPlatformOperator`, permission engine), idempotency, and audit live in
the application/engine layers. The desktop is a view + navigation container; it holds no
financial authority and introduces no new financial endpoints.

## Local storage

The only local artifacts are: window geometry (window-state plugin), the local world
JSON (dev data, same as the web host), and secret-free logs. No balances, transactions,
tax data, banking data, tokens, or private financial history are stored unencrypted by
the desktop layer beyond what the existing local host already writes for local
development. The remote backend/host remains the source of truth for real deployments.
