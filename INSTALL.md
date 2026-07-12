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
.\scripts\partnera.ps1 open       # start (if needed) + open in your browser
.\scripts\partnera.ps1 start      # start in the background, print the URL
.\scripts\partnera.ps1 status     # is it running? where's the data?
.\scripts\partnera.ps1 stop       # stop it (your data is already saved)
.\scripts\partnera.ps1 restart
.\scripts\partnera.ps1 logs       # recent server output
.\scripts\partnera.ps1 update     # rebuild from local source
.\scripts\partnera.ps1 install-desktop   # Desktop + Start Menu shortcuts
.\scripts\partnera.ps1 remove-desktop    # remove those shortcuts
```
(`partnera.cmd` at the repo root is a double-clickable shortcut: `partnera open`.
On macOS/Linux use `./scripts/partnera.sh <command>`.)

## Launch like a normal Windows app (Desktop & Start Menu)

Create shortcuts once:

```powershell
.\scripts\partnera.ps1 install-desktop
```

This generates the app icon and adds **Partnera** to your **Desktop** and your
**Start Menu** (searchable as "Partnera"). Double-click it: the app starts (if it
isn't already), waits until it's ready, and **opens in your browser
automatically**. The shortcut has the correct icon, name, and working directory —
no temporary paths.

Prefer a one-liner? `.\scripts\partnera.ps1 open` does the same (start + open).

### Install as a desktop app (PWA)

Once the app is open in Chrome or Edge, use the browser's **Install** button
(address-bar icon, or menu -> "Install Partnera"). You then get a standalone
window with the Partnera icon in the taskbar and Start Menu — it looks and
behaves like a native app, still 100% local.

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

## Removal / uninstall

```powershell
.\scripts\partnera.ps1 stop            # stop the app
.\scripts\partnera.ps1 remove-desktop  # remove Desktop + Start Menu shortcuts
```

- If you installed the PWA, uninstall it from the standalone window's menu
  (**... -> Uninstall Partnera**) or from `edge://apps` / `chrome://apps`.
- Delete local data by removing the `.partnera\` folder (or run `reset` first).
- To remove everything, delete the project folder. Nothing is installed
  system-wide, no registry keys, no services.

## Known Windows limitations

- **First launch builds the app** (10-30s) — the shortcut window shows progress;
  later launches are instant.
- **PowerShell execution policy**: the launcher runs via `-ExecutionPolicy Bypass`
  from the shortcut, so no policy change is needed. If you run the `.ps1`
  directly and it's blocked, use `.\scripts\partnera.cmd <command>` instead.
- **SmartScreen**: because the launcher isn't code-signed, Windows may warn the
  first time. This is expected for a local, unsigned tool.
- **Single instance / port**: one app instance per port. Starting again reuses
  the running one; change `PARTNERA_PORT` to run a second instance.
- **Sessions reset on restart** (your data does not) — sign in again after a restart.
- **`.ps1` must stay ASCII** (Windows PowerShell 5.1 reads it as ANSI without a BOM).

## What this install does NOT do

- It does **not** connect Shopify, a database server, or any cloud service.
- It does **not** deploy or publish anything.
- It does **not** ask for external credentials.

Those belong to the next phase (live infrastructure & pilot).
