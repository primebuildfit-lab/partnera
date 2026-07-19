# `tauri.conf.e2e.json` — test-only overlay

**Never used for a release build.** `desktop:build` and the
`release-partnera-business` workflow both use `tauri.conf.json` alone; nothing
references this overlay except a human running the end-to-end update test.

It sets exactly one field:

```json
{ "plugins": { "updater": { "dangerousInsecureTransportProtocol": true } } }
```

## Why it exists

Tauri (correctly) refuses updater endpoints that are not HTTPS. To verify the
update flow end to end we serve a manifest and installer from `127.0.0.1`, which
is plain HTTP. The only alternative would be installing a self-signed root CA
into the Windows trust store — a far worse trade for a local test.

Everything the overlay does **not** touch is exercised exactly as it ships:
manifest parsing, **minisign signature verification**, download, install and
relaunch. Only the transport-scheme check is relaxed, and only in a throwaway
build that is deleted afterwards.

## Usage

```bash
# Build the "old" version used as the update source
pnpm exec tauri build --config src-tauri/tauri.conf.e2e.json

# Then run it against a local manifest
PARTNERA_UPDATE_ENDPOINT=http://127.0.0.1:8791/business-latest.json
```

See `PARTNERA_BUSINESS_UPDATER_REPORT.md` for the full procedure and results.
