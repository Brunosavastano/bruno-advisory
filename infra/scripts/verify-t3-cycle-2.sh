#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3012}"
HOST="127.0.0.1"
BASE_URL="http://$HOST:$PORT"
EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3-cycle-2}"

COCKPIT_HTTP="$EVIDENCE_DIR/cockpit.http"
DETAIL_BEFORE_HTTP="$EVIDENCE_DIR/lead-detail-before.http"
DETAIL_AFTER_HTTP="$EVIDENCE_DIR/lead-detail-after.http"
INTAKE_HEADERS="$EVIDENCE_DIR/intake-valid.headers"
INTAKE_JSON="$EVIDENCE_DIR/intake-valid.json"
NOTE_HEADERS="$EVIDENCE_DIR/note-mutation.headers"
NOTE_JSON="$EVIDENCE_DIR/note-mutation.json"
TASK_HEADERS="$EVIDENCE_DIR/task-mutation.headers"
TASK_JSON="$EVIDENCE_DIR/task-mutation.json"
DB_INSPECTION_JSON="$EVIDENCE_DIR/db-inspection.json"
SUMMARY_JSON="$EVIDENCE_DIR/summary.json"
DEV_SERVER_LOG="$EVIDENCE_DIR/dev-server.log"

TEST_NAME="T3 Cycle Two"
TEST_EMAIL="t3-cycle-2-$(date +%s)@example.com"
TEST_PHONE="11988990022"
TEST_NOTE_CONTENT="Nota criada via verificador HTTP de ciclo 2"
TEST_NOTE_AUTHOR="verify_t3_cycle_2"
TEST_TASK_TITLE="Enviar checklist de onboarding"
TEST_TASK_STATUS="todo"
TEST_TASK_DUE_DATE="2026-04-20"

mkdir -p "$EVIDENCE_DIR"

log() {
  printf '[verify-t3-cycle-2] %s\n' "$1"
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

log "Submitting intake payload"
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
    \"primaryChallenge\": \"Preciso organizar notas e tarefas comerciais no detalhe do lead.\",
    \"sourceLabel\": \"verify_t3_cycle_2\",
    \"privacyConsentAccepted\": true,
    \"termsConsentAccepted\": true
  }" \
  "$BASE_URL/api/intake" >"$INTAKE_JSON"

assert_status 201 "$INTAKE_HEADERS"
LEAD_ID="$(node -e "const fs=require('node:fs');const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!data.leadId){process.exit(1)};process.stdout.write(data.leadId);" "$INTAKE_JSON")"

log "Capturing lead list and detail surfaces"
curl -sS -i "$BASE_URL/cockpit/leads" >"$COCKPIT_HTTP"
assert_status 200 "$COCKPIT_HTTP"
grep -q "/cockpit/leads/$LEAD_ID" "$COCKPIT_HTTP"

curl -sS -i "$BASE_URL/cockpit/leads/$LEAD_ID" >"$DETAIL_BEFORE_HTTP"
assert_status 200 "$DETAIL_BEFORE_HTTP"
grep -q "Notas internas" "$DETAIL_BEFORE_HTTP"
grep -q "Tarefas internas" "$DETAIL_BEFORE_HTTP"

log "Creating internal note via app mutation route"
curl -sS -D "$NOTE_HEADERS" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d "{
    \"content\": \"$TEST_NOTE_CONTENT\",
    \"authorMarker\": \"$TEST_NOTE_AUTHOR\"
  }" \
  "$BASE_URL/api/cockpit/leads/$LEAD_ID/notes" >"$NOTE_JSON"

assert_status 201 "$NOTE_HEADERS"

log "Creating internal task via app mutation route"
curl -sS -D "$TASK_HEADERS" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d "{
    \"title\": \"$TEST_TASK_TITLE\",
    \"status\": \"$TEST_TASK_STATUS\",
    \"dueDate\": \"$TEST_TASK_DUE_DATE\"
  }" \
  "$BASE_URL/api/cockpit/leads/$LEAD_ID/tasks" >"$TASK_JSON"

assert_status 201 "$TASK_HEADERS"

curl -sS -i "$BASE_URL/cockpit/leads/$LEAD_ID" >"$DETAIL_AFTER_HTTP"
assert_status 200 "$DETAIL_AFTER_HTTP"
grep -q "$TEST_NOTE_CONTENT" "$DETAIL_AFTER_HTTP"
grep -q "$TEST_TASK_TITLE" "$DETAIL_AFTER_HTTP"

LEAD_ID="$LEAD_ID" OUTPUT_PATH="$DB_INSPECTION_JSON" bash infra/scripts/inspect-t3-cycle-2-db.sh >/dev/null

node - "$NOTE_JSON" "$TASK_JSON" "$DB_INSPECTION_JSON" "$SUMMARY_JSON" "$LEAD_ID" "$TEST_NOTE_CONTENT" "$TEST_NOTE_AUTHOR" "$TEST_TASK_TITLE" "$TEST_TASK_STATUS" "$TEST_TASK_DUE_DATE" <<'NODE'
const fs = require('node:fs');

const notePath = process.argv[2];
const taskPath = process.argv[3];
const dbInspectionPath = process.argv[4];
const summaryPath = process.argv[5];
const leadId = process.argv[6];
const noteContent = process.argv[7];
const noteAuthor = process.argv[8];
const taskTitle = process.argv[9];
const taskStatus = process.argv[10];
const taskDueDate = process.argv[11];

const noteMutation = JSON.parse(fs.readFileSync(notePath, 'utf8'));
const taskMutation = JSON.parse(fs.readFileSync(taskPath, 'utf8'));
const inspection = JSON.parse(fs.readFileSync(dbInspectionPath, 'utf8'));

if (!noteMutation.ok || !taskMutation.ok) {
  throw new Error('Mutations did not return ok=true');
}

if (!inspection.lead || inspection.lead.lead_id !== leadId) {
  throw new Error('Lead not found in DB inspection');
}

const matchingNote = inspection.notes.find(
  (row) => row.content === noteContent && row.author_marker === noteAuthor
);
if (!matchingNote) {
  throw new Error('Expected note row not found');
}

const matchingTask = inspection.tasks.find(
  (row) => row.title === taskTitle && row.status === taskStatus && row.due_date === taskDueDate
);
if (!matchingTask) {
  throw new Error('Expected task row not found');
}

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  leadId,
  noteMutation,
  taskMutation,
  dbLead: inspection.lead,
  matchingNote,
  matchingTask
};

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
NODE

log "T3 cycle 2 verification completed. Evidence written to $EVIDENCE_DIR"
