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

case "${1:-help}" in
  install) do_build; echo "Done. Start with: ./scripts/partnera.sh start" ;;
  start)   do_start ;;
  stop)    do_stop ;;
  restart) do_stop; sleep 1; do_start ;;
  status)
    if p="$(running_pid)"; then echo "Partnera: RUNNING (PID $p) — http://localhost:$PORT"; else echo "Partnera: STOPPED"; fi
    echo "  Data: $DATA_FILE ($([ -f "$DATA_FILE" ] && echo exists || echo 'none — first run seeds demo'))" ;;
  update)  wr=0; running_pid >/dev/null && wr=1; [ $wr -eq 1 ] && do_stop; do_build; echo "Updated."; [ $wr -eq 1 ] && do_start || true ;;
  logs)    [ -f "$LOG_FILE" ] && tail -n 40 "$LOG_FILE" || echo "No logs yet." ;;
  reset)   do_stop; rm -f "$DATA_FILE" && echo "Local data deleted; next start seeds a fresh demo." || echo "No data." ;;
  *)       echo "Usage: ./scripts/partnera.sh <install|start|stop|restart|status|update|logs|reset|help>" ;;
esac
