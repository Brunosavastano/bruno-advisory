#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="state/evidence/T0"
VERIFY_LOG="$EVIDENCE_DIR/verify.log"
SERVER_LOG="$EVIDENCE_DIR/dev-server.log"
HEALTH_JSON="$EVIDENCE_DIR/health.json"
CONTROL_ROOM_HTML="$EVIDENCE_DIR/control-room.html"
mkdir -p "$EVIDENCE_DIR"
: > "$VERIFY_LOG"
: > "$SERVER_LOG"

log() {
  printf '%s %s\n' "[$(date -u +%Y-%m-%dT%H:%M:%SZ)]" "$*" | tee -a "$VERIFY_LOG"
}

PORT="$({ python3 - <<'PY'
import socket
with socket.socket() as s:
    s.bind(('127.0.0.1', 0))
    print(s.getsockname()[1])
PY
} | tr -d '\n')"

log "Using ephemeral port $PORT"
log "Running typecheck"
npm run typecheck | tee -a "$VERIFY_LOG"
log "Running build"
npm run build | tee -a "$VERIFY_LOG"
log "Starting Next dev server"
npm run dev -w @bruno-advisory/web -- --hostname 127.0.0.1 --port "$PORT" > "$SERVER_LOG" 2>&1 &
PID=$!
trap 'kill $PID >/dev/null 2>&1 || true' EXIT

READY=0
for _ in {1..60}; do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  log "Server did not become ready in time"
  tail -n 50 "$SERVER_LOG" | tee -a "$VERIFY_LOG"
  exit 1
fi

log "Capturing health endpoint"
curl -fsS "http://127.0.0.1:$PORT/api/health" > "$HEALTH_JSON"
log "Capturing Control Room HTML"
curl -fsS "http://127.0.0.1:$PORT/" > "$CONTROL_ROOM_HTML"

[ -s "$HEALTH_JSON" ]
[ -s "$CONTROL_ROOM_HTML" ]

grep -q '"project":"Bruno Advisory"' "$HEALTH_JSON"
grep -q '"tranche":"T0"' "$HEALTH_JSON"
grep -q 'Bruno Advisory' "$CONTROL_ROOM_HTML"
grep -q 'foundation' "$CONTROL_ROOM_HTML"
grep -q 'Acoplamento invisível ao VLH' "$CONTROL_ROOM_HTML"
grep -q 'Projeto será completamente separado do VLH' "$CONTROL_ROOM_HTML"
grep -q 'state/risk-log.md' "$CONTROL_ROOM_HTML"
grep -q 'state/decision-log.md' "$CONTROL_ROOM_HTML"

log "T0 verification passed"
