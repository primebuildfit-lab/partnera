# Installing & running Partnera locally

Partnera runs **entirely on your machine**. No account, no cloud, no external
service is contacted. Data is stored in a single local JSON file. This is the
desktop/daily-use tier; a production Postgres + hosted deployment is a later
phase (and is intentionally not part of local install).

## Requirements

- **Node.js 20+** and **pnpm 9+** (`npm i -g pnpm@9` if you don't have it).
- Windows, macOS, or Linux.

## Install (one time)

```powershell
# Windows (PowerShell), from the repo root:
.\scripts\partnera.ps1 install
```
```bash
# macOS / Linux / Git Bash:
./scripts/partnera.sh install
```

This installs dependencies and builds the app. (Equivalently: `pnpm install && pnpm app:build`.)

## Start / stop

```powershell
.\scripts\partnera.ps1 start      # starts in the background, prints the URL
.\scripts\partnera.ps1 status     # is it running? where's the data?
.\scripts\partnera.ps1 stop       # stops it (your data is already saved)
.\scripts\partnera.ps1 restart
```
(`partnera.cmd` at the repo root is a double-clickable shortcut: `partnera start`.)

Then open **http://localhost:4000** and sign in as one of the demo users:

| User | Sees |
|---|---|
| `owner@primebuild.test` | Business Dashboard (full) |
| `brian@primebuild.test` | Affiliate Portal (Brian's earnings) |
| `admin@partnera.test` | Admin Console |

> Authentication is a **local placeholder** — pick a user, no password. A real
> auth provider (OAuth/SSO/MFA) is a later phase; the seams are already in place.

## First-run experience

The very first start **seeds a realistic demo** by running the real money spine:
offers, referral coupons, five conversions, commissions in every state, a payout,
a fraud hold, and a refund clawback. Every number you see is real (derived from
the append-only ledger), not mocked.

## Configuration

All configuration is by environment variable — no config files to edit:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` / `PARTNERA_PORT` | `4000` | Port the app listens on |
| `PARTNERA_DATA` | `<repo>/.partnera/data.json` | Where local data is stored |

Example (PowerShell): `$env:PARTNERA_PORT=5000; .\scripts\partnera.ps1 start`.

In-app, business settings (e.g. minimum payout, clawback window) are editable
under **Business → Configuration**.

## Persistence & recovery after restart

Your data lives in `.partnera/data.json`. It is saved **after every change** and
again on shutdown (atomic write — never a half-written file). Stop and start the
app and everything is exactly as you left it. Sessions are not persisted, so you
sign in again after a restart — your data is untouched.

To start over from a fresh demo:

```powershell
.\scripts\partnera.ps1 reset      # deletes local data; next start reseeds
```

## Updating

After pulling new local changes:

```powershell
.\scripts\partnera.ps1 update      # reinstall + rebuild; restarts if it was running
```

Your `.partnera/data.json` is preserved across updates (the data format is
versioned; incompatible bumps are detected and reported rather than corrupting).

## Logs & troubleshooting

```powershell
.\scripts\partnera.ps1 logs        # recent server output (and errors)
```

- **Port already in use** → set `PARTNERA_PORT` to a free port and start again.
- **Won't start** → `logs` shows the error; `install` rebuilds from source.
- **Weird state** → `reset` gives a clean demo (this deletes local data).

## What this install does NOT do

- It does **not** connect Shopify, a database server, or any cloud service.
- It does **not** deploy or publish anything.
- It does **not** ask for external credentials.

Those belong to the next phase (live infrastructure & pilot).
