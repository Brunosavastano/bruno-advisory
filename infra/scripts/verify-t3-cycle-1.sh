#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3011}"
HOST="127.0.0.1"
BASE_URL="http://$HOST:$PORT"
EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3-cycle-1}"

COCKPIT_HTTP="$EVIDENCE_DIR/cockpit.http"
DETAIL_BEFORE_HTTP="$EVIDENCE_DIR/lead-detail-before.http"
DETAIL_AFTER_HTTP="$EVIDENCE_DIR/lead-detail-after.http"
INTAKE_HEADERS="$EVIDENCE_DIR/intake-valid.headers"
INTAKE_JSON="$EVIDENCE_DIR/intake-valid.json"
MUTATION_HEADERS="$EVIDENCE_DIR/stage-mutation.headers"
MUTATION_JSON="$EVIDENCE_DIR/stage-mutation.json"
DB_INSPECTION_JSON="$EVIDENCE_DIR/db-inspection.json"
SUMMARY_JSON="$EVIDENCE_DIR/summary.json"
DEV_SERVER_LOG="$EVIDENCE_DIR/dev-server.log"

TEST_NAME="T3 Cycle One"
TEST_EMAIL="t3-cycle-1-$(date +%s)@example.com"
TEST_PHONE="11988990011"
TEST_STAGE="contato_inicial"
TEST_NOTE="Stage changed by local verifier"
TEST_CHANGED_BY="verify_t3_cycle_1"

mkdir -p "$EVIDENCE_DIR"

log() {
  printf '[verify-t3-cycle-1] %s\n' "$1"
}

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

assert_status() {
  local expected="$1"
  local file="$2"
  local got
  got="$(awk 'NR==1 {print $2}' "$file")"
  if [[ "$got" != "$expected" ]]; then
    echo "Expected status $expected but got $got for $file" >&2
    exit 1
  fi
}

log "Starting Next dev server on $BASE_URL"
npm run dev -w @bruno-advisory/web -- --hostname "$HOST" --port "$PORT" >"$DEV_SERVER_LOG" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 60); do
  if curl -sS "$BASE_URL/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -sS "$BASE_URL/api/health" >/dev/null 2>&1; then
  echo "Server did not become healthy in time" >&2
  exit 1
fi

log "Submitting a valid intake payload to produce a lead"
curl -sS -D "$INTAKE_HEADERS" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d "{
    \"fullName\": \"$TEST_NAME\",
    \"email\": \"$TEST_EMAIL\",
    \"phone\": \"$TEST_PHONE\",
    \"city\": \"Sao Paulo\",
    \"state\": \"SP\",
    \"investableAssetsBand\": \"3m_a_10m\",
    \"primaryChallenge\": \"Preciso organizar carteira e governanca com disciplina.\",
    \"sourceLabel\": \"site_home_primary_cta\",
    \"privacyConsentAccepted\": true,
    \"termsConsentAccepted\": true
  }" \
  "$BASE_URL/api/intake" >"$INTAKE_JSON"

assert_status 201 "$INTAKE_HEADERS"
LEAD_ID="$(node -e "const fs=require('node:fs');const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!data.leadId){process.exit(1)};process.stdout.write(data.leadId);" "$INTAKE_JSON")"

log "Capturing list and detail surfaces"
curl -sS -i "$BASE_URL/cockpit/leads" >"$COCKPIT_HTTP"
assert_status 200 "$COCKPIT_HTTP"
grep -q "/cockpit/leads/$LEAD_ID" "$COCKPIT_HTTP"

curl -sS -i "$BASE_URL/cockpit/leads/$LEAD_ID" >"$DETAIL_BEFORE_HTTP"
assert_status 200 "$DETAIL_BEFORE_HTTP"
grep -q "Auditoria de estágio comercial" "$DETAIL_BEFORE_HTTP"

log "Mutating commercial stage via app route"
curl -sS -D "$MUTATION_HEADERS" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d "{
    \"toStage\": \"$TEST_STAGE\",
    \"note\": \"$TEST_NOTE\",
    \"changedBy\": \"$TEST_CHANGED_BY\"
  }" \
  "$BASE_URL/api/cockpit/leads/$LEAD_ID/commercial-stage" >"$MUTATION_JSON"

assert_status 200 "$MUTATION_HEADERS"

curl -sS -i "$BASE_URL/cockpit/leads/$LEAD_ID" >"$DETAIL_AFTER_HTTP"
assert_status 200 "$DETAIL_AFTER_HTTP"
grep -q "Contato inicial" "$DETAIL_AFTER_HTTP"

LEAD_ID="$LEAD_ID" OUTPUT_PATH="$DB_INSPECTION_JSON" bash infra/scripts/inspect-t3-cycle-1-db.sh >/dev/null

node - "$MUTATION_JSON" "$DB_INSPECTION_JSON" "$SUMMARY_JSON" "$LEAD_ID" "$TEST_STAGE" "$TEST_CHANGED_BY" "$TEST_NOTE" <<'NODE'
const fs = require('node:fs');

const mutationPath = process.argv[2];
const dbInspectionPath = process.argv[3];
const summaryPath = process.argv[4];
const leadId = process.argv[5];
const stage = process.argv[6];
const changedBy = process.argv[7];
const note = process.argv[8];

const mutation = JSON.parse(fs.readFileSync(mutationPath, 'utf8'));
const inspection = JSON.parse(fs.readFileSync(dbInspectionPath, 'utf8'));

if (!mutation.ok) {
  throw new Error('Stage mutation API did not return ok=true');
}

if (mutation.leadId !== leadId || mutation.changedTo !== stage) {
  throw new Error('Mutation payload mismatch with expected lead/stage');
}

if (!inspection.lead) {
  throw new Error('Lead not found in DB inspection');
}

if (inspection.lead.commercial_stage !== stage) {
  throw new Error(`Unexpected commercial stage in DB: ${inspection.lead.commercial_stage}`);
}

const matchingAudit = inspection.auditEntries.find((entry) => entry.to_stage === stage && entry.changed_by === changedBy);
if (!matchingAudit) {
  throw new Error('Expected stage audit entry not found');
}

if ((matchingAudit.note || null) !== note) {
  throw new Error('Expected audit note not found');
}

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  leadId,
  stageChangedTo: stage,
  changedBy,
  mutation,
  dbLead: inspection.lead,
  matchingAudit
};

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
NODE

log "T3 cycle 1 verification completed. Evidence written to $EVIDENCE_DIR"
