#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3013}"
HOST="127.0.0.1"
BASE_URL="http://$HOST:$PORT"
EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3-cycle-3}"

COCKPIT_HTTP="$EVIDENCE_DIR/cockpit.http"
DETAIL_BEFORE_HTTP="$EVIDENCE_DIR/lead-detail-before.http"
DETAIL_AFTER_CREATE_HTTP="$EVIDENCE_DIR/lead-detail-after-create.http"
DETAIL_AFTER_STATUS_HTTP="$EVIDENCE_DIR/lead-detail-after-status.http"
INTAKE_HEADERS="$EVIDENCE_DIR/intake-valid.headers"
INTAKE_JSON="$EVIDENCE_DIR/intake-valid.json"
TASK_CREATE_HEADERS="$EVIDENCE_DIR/task-create.headers"
TASK_CREATE_JSON="$EVIDENCE_DIR/task-create.json"
TASK_STATUS_HEADERS="$EVIDENCE_DIR/task-status.headers"
TASK_STATUS_JSON="$EVIDENCE_DIR/task-status.json"
DB_INSPECTION_JSON="$EVIDENCE_DIR/db-inspection.json"
SUMMARY_JSON="$EVIDENCE_DIR/summary.json"
DEV_SERVER_LOG="$EVIDENCE_DIR/dev-server.log"

TEST_NAME="T3 Cycle Three"
TEST_EMAIL="t3-cycle-3-$(date +%s)@example.com"
TEST_PHONE="11988990033"
TEST_TASK_TITLE="Consolidar pendencias comerciais do lead"
TEST_TASK_STATUS="todo"
TEST_TASK_DUE_DATE="2026-04-22"
TEST_TASK_NEXT_STATUS="in_progress"
TEST_CHANGED_BY="verify_t3_cycle_3"

mkdir -p "$EVIDENCE_DIR"

log() {
  printf '[verify-t3-cycle-3] %s\n' "$1"
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
    \"primaryChallenge\": \"Preciso evoluir tarefas internas com trilha de auditoria.\",
    \"sourceLabel\": \"verify_t3_cycle_3\",
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
grep -q "Tarefas internas" "$DETAIL_BEFORE_HTTP"
grep -q "Nenhuma tarefa registrada ainda." "$DETAIL_BEFORE_HTTP"

log "Creating internal task"
curl -sS -D "$TASK_CREATE_HEADERS" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d "{
    \"title\": \"$TEST_TASK_TITLE\",
    \"status\": \"$TEST_TASK_STATUS\",
    \"dueDate\": \"$TEST_TASK_DUE_DATE\"
  }" \
  "$BASE_URL/api/cockpit/leads/$LEAD_ID/tasks" >"$TASK_CREATE_JSON"

assert_status 201 "$TASK_CREATE_HEADERS"
TASK_ID="$(node -e "const fs=require('node:fs');const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!data.task?.taskId){process.exit(1)};process.stdout.write(data.task.taskId);" "$TASK_CREATE_JSON")"

curl -sS -i "$BASE_URL/cockpit/leads/$LEAD_ID" >"$DETAIL_AFTER_CREATE_HTTP"
assert_status 200 "$DETAIL_AFTER_CREATE_HTTP"
grep -q "$TEST_TASK_TITLE" "$DETAIL_AFTER_CREATE_HTTP"
grep -q "Auditoria da tarefa" "$DETAIL_AFTER_CREATE_HTTP"

log "Changing task status"
curl -sS -D "$TASK_STATUS_HEADERS" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d "{
    \"toStatus\": \"$TEST_TASK_NEXT_STATUS\",
    \"changedBy\": \"$TEST_CHANGED_BY\"
  }" \
  "$BASE_URL/api/cockpit/leads/$LEAD_ID/tasks/$TASK_ID/status" >"$TASK_STATUS_JSON"

assert_status 200 "$TASK_STATUS_HEADERS"

curl -sS -i "$BASE_URL/cockpit/leads/$LEAD_ID" >"$DETAIL_AFTER_STATUS_HTTP"
assert_status 200 "$DETAIL_AFTER_STATUS_HTTP"
grep -q "$TEST_TASK_TITLE" "$DETAIL_AFTER_STATUS_HTTP"
grep -q "in progress" "$DETAIL_AFTER_STATUS_HTTP"
grep -q "$TEST_CHANGED_BY" "$DETAIL_AFTER_STATUS_HTTP"

LEAD_ID="$LEAD_ID" OUTPUT_PATH="$DB_INSPECTION_JSON" bash infra/scripts/inspect-t3-cycle-3-db.sh >/dev/null

node - "$TASK_CREATE_JSON" "$TASK_STATUS_JSON" "$DB_INSPECTION_JSON" "$SUMMARY_JSON" "$LEAD_ID" "$TASK_ID" "$TEST_TASK_TITLE" "$TEST_TASK_STATUS" "$TEST_TASK_NEXT_STATUS" "$TEST_CHANGED_BY" <<'NODE'
const fs = require('node:fs');

const createPath = process.argv[2];
const statusPath = process.argv[3];
const dbInspectionPath = process.argv[4];
const summaryPath = process.argv[5];
const leadId = process.argv[6];
const taskId = process.argv[7];
const taskTitle = process.argv[8];
const taskStatus = process.argv[9];
const taskNextStatus = process.argv[10];
const changedBy = process.argv[11];

const createMutation = JSON.parse(fs.readFileSync(createPath, 'utf8'));
const statusMutation = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
const inspection = JSON.parse(fs.readFileSync(dbInspectionPath, 'utf8'));

if (!createMutation.ok || !statusMutation.ok) {
  throw new Error('Task create/status mutation did not return ok=true');
}

if (!inspection.lead || inspection.lead.lead_id !== leadId) {
  throw new Error('Lead not found in DB inspection');
}

const matchingTask = inspection.tasks.find((row) => row.task_id === taskId && row.title === taskTitle);
if (!matchingTask) {
  throw new Error('Expected task row not found');
}

if (matchingTask.status !== taskNextStatus) {
  throw new Error(`Task status mismatch: expected ${taskNextStatus} got ${matchingTask.status}`);
}

const matchingAudit = inspection.taskAudit.find(
  (row) =>
    row.task_id === taskId &&
    row.from_status === taskStatus &&
    row.to_status === taskNextStatus &&
    row.changed_by === changedBy
);

if (!matchingAudit) {
  throw new Error('Expected task audit row not found');
}

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  leadId,
  taskId,
  taskCreateMutation: createMutation,
  taskStatusMutation: statusMutation,
  matchingTask,
  matchingAudit
};

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
NODE

log "T3 cycle 3 verification completed. Evidence written to $EVIDENCE_DIR"
