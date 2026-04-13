#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="state/evidence/T0"
HEALTH_JSON="$EVIDENCE_DIR/standalone-health.json"
SERVER_LOG="$EVIDENCE_DIR/standalone-server.log"
mkdir -p "$EVIDENCE_DIR"
: > "$SERVER_LOG"

npm run build >/dev/null

PORT="$({ python3 - <<'PY'
import socket
with socket.socket() as s:
    s.bind(('127.0.0.1', 0))
    print(s.getsockname()[1])
PY
} | tr -d '\n')"

HOSTNAME=127.0.0.1 PORT="$PORT" node apps/web/.next/standalone/apps/web/server.js > "$SERVER_LOG" 2>&1 &
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
  echo "standalone verification failed: server did not become ready" >&2
  tail -n 50 "$SERVER_LOG" >&2 || true
  exit 1
fi

curl -fsS "http://127.0.0.1:$PORT/api/health" > "$HEALTH_JSON"
grep -q '"ok":true' "$HEALTH_JSON"
grep -q '"project":"Bruno Advisory"' "$HEALTH_JSON"
grep -q '"tranche":"T0"' "$HEALTH_JSON"
printf 'standalone verification ok: %s\n' "$HEALTH_JSON"
