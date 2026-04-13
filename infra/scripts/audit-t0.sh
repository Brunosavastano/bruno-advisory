#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="state/evidence/T0"
RUNS_DIR="$EVIDENCE_DIR/runs"
AUDIT_LOG="$EVIDENCE_DIR/audit.log"
VERIFY_LOG="$EVIDENCE_DIR/verify.log"
COMBINED_VERIFY="$EVIDENCE_DIR/verify.combined.log"
AUDIT_JSON="$EVIDENCE_DIR/npm-audit.json"
NPM_LS_TXT="$EVIDENCE_DIR/npm-ls-next.txt"
BACKUP_TXT="$EVIDENCE_DIR/backup.txt"
HEALTHCHECK_JSON="$EVIDENCE_DIR/healthcheck.json"
HEALTHCHECK_SERVER_LOG="$EVIDENCE_DIR/healthcheck-server.log"

mkdir -p "$EVIDENCE_DIR" "$RUNS_DIR"
rm -rf "$RUNS_DIR"/*
: > "$AUDIT_LOG"
: > "$COMBINED_VERIFY"

log() {
  printf '%s %s\n' "[$(date -u +%Y-%m-%dT%H:%M:%SZ)]" "$*" | tee -a "$AUDIT_LOG"
}

log "Recording dependency tree"
npm ls next react react-dom --depth=0 | tee "$NPM_LS_TXT" >> "$AUDIT_LOG"

log "Running npm audit"
npm audit --omit=dev --json > "$AUDIT_JSON"
python3 - "$AUDIT_JSON" <<'PY' | tee -a "$AUDIT_LOG"
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as fh:
    data = json.load(fh)
meta = data.get('metadata', {}).get('vulnerabilities', {})
assert meta.get('total', 1) == 0, meta
print('npm audit ok')
PY

for run in 1 2; do
  log "Running verification pass $run"
  VERIFY_RUN_LABEL="run-$run" bash infra/scripts/verify-t0.sh
  PASS_DIR="$RUNS_DIR/pass-$run"
  mkdir -p "$PASS_DIR"
  cp "$VERIFY_LOG" "$PASS_DIR/verify.log"
  cp "$EVIDENCE_DIR/dev-server.log" "$PASS_DIR/dev-server.log"
  cp "$EVIDENCE_DIR/health.json" "$PASS_DIR/health.json"
  cp "$EVIDENCE_DIR/control-room.html" "$PASS_DIR/control-room.html"
  {
    echo "### run-$run"
    cat "$PASS_DIR/verify.log"
    echo
  } >> "$COMBINED_VERIFY"
done

mv "$COMBINED_VERIFY" "$VERIFY_LOG"
printf '%s %s\n' "[$(date -u +%Y-%m-%dT%H:%M:%SZ)]" "AUDIT_T0_TWO_PASS_OK" | tee -a "$VERIFY_LOG" "$AUDIT_LOG"

log "Running explicit local healthcheck"
bash infra/scripts/healthcheck-local.sh "$HEALTHCHECK_JSON" "$HEALTHCHECK_SERVER_LOG" | tee -a "$AUDIT_LOG"
log "Local healthcheck passed"

log "Running explicit local backup"
bash infra/scripts/backup-local.sh | tee "$BACKUP_TXT" | tee -a "$AUDIT_LOG"
log "Local backup recorded"

log "T0 audit completed successfully"
