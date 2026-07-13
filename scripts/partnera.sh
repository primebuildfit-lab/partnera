#!/usr/bin/env bash
# Partnera local launcher (macOS / Linux / Git Bash). No external services.
# Usage: ./scripts/partnera.sh <install|start|stop|restart|status|update|logs|reset|help>
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$ROOT/.partnera"
DATA_FILE="$DATA_DIR/data.json"
PID_FILE="$DATA_DIR/server.pid"
LOG_FILE="$DATA_DIR/server.log"
BUNDLE="$ROOT/packages/web/dist/server.mjs"
PORT="${PARTNERA_PORT:-4000}"

running_pid() {
  [ -f "$PID_FILE" ] || return 1
  local p; p="$(cat "$PID_FILE" 2>/dev/null || true)"
  [ -n "$p" ] && kill -0 "$p" 2>/dev/null && echo "$p" && return 0
  return 1
}

do_build() {
  echo "Installing dependencies..."; (cd "$ROOT" && pnpm install)
  echo "Building..."; (cd "$ROOT" && pnpm --filter "@partnera/web" build && pnpm --filter "@partnera/web" bundle)
}

do_start() {
  if p="$(running_pid)"; then echo "Already running (PID $p) at http://localhost:$PORT"; return; fi
  mkdir -p "$DATA_DIR"
  [ -f "$BUNDLE" ] || { echo "App not built — building..."; do_build; }
  PORT="$PORT" PARTNERA_DATA="$DATA_FILE" nohup node "$BUNDLE" > "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  sleep 1
  echo "Partnera started at http://localhost:$PORT (PID $(cat "$PID_FILE"))"
  echo "  Sign in: owner@primebuild.test | brian@primebuild.test | admin@partnera.test"
  echo "  Data: $DATA_FILE"
}

do_stop() {
  if p="$(running_pid)"; then echo "Stopping (PID $p)..."; kill "$p" 2>/dev/null || true; rm -f "$PID_FILE"; echo "Stopped (state saved)."; else echo "Not running."; rm -f "$PID_FILE" 2>/dev/null || true; fi
}

do_open() {
  do_start
  echo "Waiting for the app to be ready..."
  for _ in $(seq 1 40); do
    if curl -sf -o /dev/null "http://localhost:$PORT/login" 2>/dev/null; then break; fi
    sleep 0.5
  done
  if command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then open "http://localhost:$PORT" || true
  else echo "Open http://localhost:$PORT in your browser."; fi
}

case "${1:-help}" in
  install) do_build; echo "Done. Start with: ./scripts/partnera.sh open" ;;
  start)   do_start ;;
  open)    do_open ;;
  install-desktop|remove-desktop) echo "Desktop shortcuts are a Windows feature. Use scripts/partnera.ps1 on Windows." ;;
  stop)    do_stop ;;
  restart) do_stop; sleep 1; do_start ;;
  status)
    if p="$(running_pid)"; then echo "Partnera: RUNNING (PID $p) — http://localhost:$PORT"; else echo "Partnera: STOPPED"; fi
    echo "  Data: $DATA_FILE ($([ -f "$DATA_FILE" ] && echo exists || echo 'none — first run seeds demo'))" ;;
  update)  wr=0; running_pid >/dev/null && wr=1; [ $wr -eq 1 ] && do_stop; do_build; echo "Updated."; [ $wr -eq 1 ] && do_start || true ;;
  logs)    [ -f "$LOG_FILE" ] && tail -n 40 "$LOG_FILE" || echo "No logs yet." ;;
  reset)   do_stop; rm -f "$DATA_FILE" && echo "Local data deleted; next start seeds a fresh demo." || echo "No data." ;;
  backup)
    if [ ! -f "$DATA_FILE" ]; then echo "No data file to back up yet."; else
      mkdir -p "$DATA_DIR/backups"
      DEST="$DATA_DIR/backups/data-$(date +%Y%m%d-%H%M%S).json"
      cp "$DATA_FILE" "$DEST" && echo "Backed up to: $DEST"
    fi ;;
  restore)
    if [ -n "${2:-}" ]; then SRC="$DATA_DIR/backups/$2"; else SRC="$(ls -1t "$DATA_DIR"/backups/data-*.json 2>/dev/null | head -1)"; fi
    if [ -z "$SRC" ] || [ ! -f "$SRC" ]; then echo "No matching backup found in $DATA_DIR/backups"; else
      do_stop; cp "$SRC" "$DATA_FILE" && echo "Restored from: $SRC" && echo "Start with: ./scripts/partnera.sh open"
    fi ;;
  *)       echo "Usage: ./scripts/partnera.sh <install|start|stop|restart|status|update|logs|reset|help>" ;;
esac
