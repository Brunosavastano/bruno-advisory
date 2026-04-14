#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3014}"
HOST="127.0.0.1"
BASE_URL="http://$HOST:$PORT"
EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3-cycle-4}"

COCKPIT_HTTP="$EVIDENCE_DIR/cockpit.http"
DETAIL_INITIAL_HTTP="$EVIDENCE_DIR/lead-detail-initial.http"
DETAIL_MID_HTTP="$EVIDENCE_DIR/lead-detail-mid.http"
DETAIL_READY_HTTP="$EVIDENCE_DIR/lead-detail-ready.http"
INTAKE_HEADERS="$EVIDENCE_DIR/intake-valid.headers"
INTAKE_JSON="$EVIDENCE_DIR/intake-valid.json"
TASK_CREATE_HEADERS="$EVIDENCE_DIR/task-create.headers"
TASK_CREATE_JSON="$EVIDENCE_DIR/task-create.json"
STAGE_MUTATION_HEADERS="$EVIDENCE_DIR/stage-mutation.headers"
STAGE_MUTATION_JSON="$EVIDENCE_DIR/stage-mutation.json"
TASK_STATUS_HEADERS="$EVIDENCE_DIR/task-status.headers"
TASK_STATUS_JSON="$EVIDENCE_DIR/task-status.json"
READINESS_INITIAL_JSON="$EVIDENCE_DIR/readiness-initial.json"
READINESS_MID_JSON="$EVIDENCE_DIR/readiness-mid.json"
READINESS_READY_JSON="$EVIDENCE_DIR/readiness-ready.json"
DB_INSPECTION_JSON="$EVIDENCE_DIR/db-inspection.json"
SUMMARY_JSON="$EVIDENCE_DIR/summary.json"
DEV_SERVER_LOG="$EVIDENCE_DIR/dev-server.log"

TEST_NAME="T3 Cycle Four"
TEST_EMAIL="t3-cycle-4-$(date +%s)@example.com"
TEST_PHONE="11988995511"
TEST_TASK_TITLE="Checklist final para entrada em billing"
TEST_TASK_STATUS="todo"
TEST_TASK_NEXT_STATUS="done"
TEST_TASK_DUE_DATE="2026-04-25"
TEST_CHANGED_BY="verify_t3_cycle_4"
TEST_STAGE="cliente_convertido"

mkdir -p "$EVIDENCE_DIR"

log() {
  printf '[verify-t3-cycle-4] %s\n' "$1"
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
    \"primaryChallenge\": \"Preciso saber se o lead esta pronto para entrar em billing sem fake readiness.\",
    \"sourceLabel\": \"verify_t3_cycle_4\",
    \"privacyConsentAccepted\": true,
    \"termsConsentAccepted\": true
  }" \
  "$BASE_URL/api/intake" >"$INTAKE_JSON"

assert_status 201 "$INTAKE_HEADERS"
LEAD_ID="$(node -e "const fs=require('node:fs');const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!data.leadId){process.exit(1)};process.stdout.write(data.leadId);" "$INTAKE_JSON")"

log "Capturing list and detail with initial unmet billing conditions"
curl -sS -i "$BASE_URL/cockpit/leads" >"$COCKPIT_HTTP"
assert_status 200 "$COCKPIT_HTTP"
grep -q "/cockpit/leads/$LEAD_ID" "$COCKPIT_HTTP"

curl -sS -i "$BASE_URL/cockpit/leads/$LEAD_ID" >"$DETAIL_INITIAL_HTTP"
assert_status 200 "$DETAIL_INITIAL_HTTP"
grep -q "Billing readiness T3" "$DETAIL_INITIAL_HTTP"
grep -q "Billing ready: <strong>NO</strong>" "$DETAIL_INITIAL_HTTP"
grep -q "Estagio comercial deve estar em Cliente convertido." "$DETAIL_INITIAL_HTTP"
grep -q "Deve existir ao menos 1 tarefa interna." "$DETAIL_INITIAL_HTTP"
curl -sS "$BASE_URL/api/cockpit/leads/$LEAD_ID/billing-readiness" >"$READINESS_INITIAL_JSON"

log "Creating todo task and converting stage, still not ready due pending task"
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

curl -sS -D "$STAGE_MUTATION_HEADERS" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d "{
    \"toStage\": \"$TEST_STAGE\",
    \"changedBy\": \"$TEST_CHANGED_BY\",
    \"note\": \"advance to billing readiness check\"
  }" \
  "$BASE_URL/api/cockpit/leads/$LEAD_ID/commercial-stage" >"$STAGE_MUTATION_JSON"

assert_status 200 "$STAGE_MUTATION_HEADERS"

curl -sS -i "$BASE_URL/cockpit/leads/$LEAD_ID" >"$DETAIL_MID_HTTP"
assert_status 200 "$DETAIL_MID_HTTP"
grep -q "Billing ready: <strong>NO</strong>" "$DETAIL_MID_HTTP"
grep -q "Todas as tarefas internas devem estar com status done." "$DETAIL_MID_HTTP"
curl -sS "$BASE_URL/api/cockpit/leads/$LEAD_ID/billing-readiness" >"$READINESS_MID_JSON"

log "Marking task as done so billing readiness becomes YES"
curl -sS -D "$TASK_STATUS_HEADERS" \
  -H 'Content-Type: application/json' \
  -X POST \
  -d "{
    \"toStatus\": \"$TEST_TASK_NEXT_STATUS\",
    \"changedBy\": \"$TEST_CHANGED_BY\"
  }" \
  "$BASE_URL/api/cockpit/leads/$LEAD_ID/tasks/$TASK_ID/status" >"$TASK_STATUS_JSON"

assert_status 200 "$TASK_STATUS_HEADERS"

curl -sS -i "$BASE_URL/cockpit/leads/$LEAD_ID" >"$DETAIL_READY_HTTP"
assert_status 200 "$DETAIL_READY_HTTP"
grep -q "Billing ready: <strong>YES</strong>" "$DETAIL_READY_HTTP"
grep -q "Todas as condicoes minimas de entrada em billing foram atendidas." "$DETAIL_READY_HTTP"
curl -sS "$BASE_URL/api/cockpit/leads/$LEAD_ID/billing-readiness" >"$READINESS_READY_JSON"

LEAD_ID="$LEAD_ID" OUTPUT_PATH="$DB_INSPECTION_JSON" bash infra/scripts/inspect-t3-cycle-4-db.sh >/dev/null

node - "$STAGE_MUTATION_JSON" "$TASK_CREATE_JSON" "$TASK_STATUS_JSON" "$READINESS_INITIAL_JSON" "$READINESS_MID_JSON" "$READINESS_READY_JSON" "$DB_INSPECTION_JSON" "$SUMMARY_JSON" "$LEAD_ID" "$TASK_ID" "$TEST_STAGE" "$TEST_TASK_NEXT_STATUS" "$TEST_CHANGED_BY" <<'NODE'
const fs = require('node:fs');

const stageMutationPath = process.argv[2];
const taskCreatePath = process.argv[3];
const taskStatusPath = process.argv[4];
const readinessInitialPath = process.argv[5];
const readinessMidPath = process.argv[6];
const readinessReadyPath = process.argv[7];
const dbInspectionPath = process.argv[8];
const summaryPath = process.argv[9];
const leadId = process.argv[10];
const taskId = process.argv[11];
const targetStage = process.argv[12];
const targetTaskStatus = process.argv[13];
const changedBy = process.argv[14];

const stageMutation = JSON.parse(fs.readFileSync(stageMutationPath, 'utf8'));
const taskCreateMutation = JSON.parse(fs.readFileSync(taskCreatePath, 'utf8'));
const taskStatusMutation = JSON.parse(fs.readFileSync(taskStatusPath, 'utf8'));
const readinessInitial = JSON.parse(fs.readFileSync(readinessInitialPath, 'utf8'));
const readinessMid = JSON.parse(fs.readFileSync(readinessMidPath, 'utf8'));
const readinessReady = JSON.parse(fs.readFileSync(readinessReadyPath, 'utf8'));
const inspection = JSON.parse(fs.readFileSync(dbInspectionPath, 'utf8'));

if (!stageMutation.ok || !taskCreateMutation.ok || !taskStatusMutation.ok) {
  throw new Error('One or more mutations did not return ok=true');
}

if (!readinessInitial.ok || readinessInitial.readiness?.isBillingReady) {
  throw new Error('Initial readiness must be unmet');
}
if (!readinessMid.ok || readinessMid.readiness?.isBillingReady) {
  throw new Error('Mid readiness must be unmet');
}
if (!readinessReady.ok || !readinessReady.readiness?.isBillingReady) {
  throw new Error('Ready readiness must be true');
}

if (!inspection.lead || inspection.lead.lead_id !== leadId) {
  throw new Error('Lead row not found in DB inspection');
}

if (inspection.lead.commercial_stage !== targetStage) {
  throw new Error(`commercial_stage mismatch: expected ${targetStage}, got ${inspection.lead.commercial_stage}`);
}

const matchingTask = inspection.tasks.find((row) => row.task_id === taskId && row.status === targetTaskStatus);
if (!matchingTask) {
  throw new Error('Expected done task row not found');
}

const matchingStageAudit = inspection.stageAudit.find(
  (row) => row.to_stage === targetStage && row.changed_by === changedBy
);
if (!matchingStageAudit) {
  throw new Error('Expected stage audit row not found');
}

const matchingTaskAudit = inspection.taskAudit.find(
  (row) => row.task_id === taskId && row.to_status === targetTaskStatus && row.changed_by === changedBy
);
if (!matchingTaskAudit) {
  throw new Error('Expected task audit row not found');
}

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  leadId,
  taskId,
  stageMutation,
  taskCreateMutation,
  taskStatusMutation,
  readinessInitial,
  readinessMid,
  readinessReady,
  matchingStageAudit,
  matchingTaskAudit,
  matchingTask,
  evaluatedState: {
    stage: inspection.lead.commercial_stage,
    totalTasks: inspection.tasks.length,
    doneTasks: inspection.tasks.filter((row) => row.status === 'done').length,
    pendingTasks: inspection.tasks.filter((row) => row.status !== 'done').length
  }
};

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
NODE

log "T3 cycle 4 verification completed. Evidence written to $EVIDENCE_DIR"
