#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

LOG="state/evidence/T0/ci-local.log"
mkdir -p "$(dirname "$LOG")"
: > "$LOG"

printf '%s %s\n' "[$(date -u +%Y-%m-%dT%H:%M:%SZ)]" "CI_LOCAL_START" | tee -a "$LOG"
bash infra/scripts/audit-t0.sh | tee -a "$LOG"
printf '%s %s\n' "[$(date -u +%Y-%m-%dT%H:%M:%SZ)]" "CI_LOCAL_OK" | tee -a "$LOG"
