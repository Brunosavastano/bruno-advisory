#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

OUTPUT_JSON="${1:-state/evidence/T0/healthcheck.json}"
SERVER_LOG="${2:-state/evidence/T0/healthcheck-server.log}"
mkdir -p "$(dirname "$OUTPUT_JSON")"
: > "$SERVER_LOG"

npm run build >/dev/null

PORT="$({ python3 - <<'PY'
import socket
with socket.socket() as s:
    s.bind(('127.0.0.1', 0))
    print(s.getsockname()[1])
PY
} | tr -d '\n')"

npm run start -w @bruno-advisory/web -- --hostname 127.0.0.1 --port "$PORT" > "$SERVER_LOG" 2>&1 &
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
  echo "healthcheck failed: server did not become ready" >&2
  tail -n 50 "$SERVER_LOG" >&2 || true
  exit 1
fi

EXPECTED_STATUS="$(sed -n 's/^  tranche_status: //p' project.yaml | head -n1 | tr -d '\r')"

curl -fsS "http://127.0.0.1:$PORT/api/health" > "$OUTPUT_JSON"
python3 - "$OUTPUT_JSON" "$EXPECTED_STATUS" <<'PY'
import json, sys
path = sys.argv[1]
expected_status = sys.argv[2]
with open(path, 'r', encoding='utf-8') as fh:
    data = json.load(fh)
assert data.get('ok') is True, data
assert data.get('project') == 'Bruno Advisory', data
assert data.get('tranche') == 'T0', data
assert data.get('status') == expected_status, data
print(f"healthcheck ok: {path}")
PY
