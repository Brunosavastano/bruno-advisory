#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T6-cycle-3}"
mkdir -p "$EVIDENCE_DIR"

# 1. Typecheck must pass (covers the additive signature change in audit-log.ts)
npm run typecheck >/dev/null

# 2. Build must still succeed — no route regression under the new INSERT
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

# 3. Exercise the additive signature: source-text audits + schema/read-path round-trip
node --experimental-strip-types \
  infra/scripts/verifiers/t6-cycle-3.ts \
  "$ROOT" \
  "$EVIDENCE_DIR"
