#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T6-cycle-4}"
mkdir -p "$EVIDENCE_DIR"

# 1. Typecheck must pass (covers proxy.ts + cockpit-session.ts + new route)
npm run typecheck >/dev/null

# 2. Build must still succeed
rm -rf apps/web/.next apps/web/.next.partial.* 2>/dev/null || true
build_ok=0
for attempt in 1 2 3; do
  if npm run build >/dev/null; then
    build_ok=1
    break
  fi
  if [ "$attempt" -lt 3 ]; then
    sleep 2
  fi
done
if [ "$build_ok" -ne 1 ]; then
  echo "Build failed after 3 attempts" >&2
  exit 1
fi

# 3. Exercise 5 scenarios + middleware source checks + helper source checks
node --experimental-strip-types \
  infra/scripts/verifiers/t6-cycle-4.ts \
  "$ROOT" \
  "$EVIDENCE_DIR"
