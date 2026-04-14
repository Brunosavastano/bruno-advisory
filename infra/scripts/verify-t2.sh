#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T2-cycle-5}"
VERIFY_LOG="$EVIDENCE_DIR/verify.log"
SERVER_LOG="$EVIDENCE_DIR/server.log"
HOME_HTTP="$EVIDENCE_DIR/home.http"
WHO_HTTP="$EVIDENCE_DIR/para-quem-e.http"
HOW_HTTP="$EVIDENCE_DIR/como-funciona.http"
PRIVACY_HTTP="$EVIDENCE_DIR/privacidade.http"
TERMS_HTTP="$EVIDENCE_DIR/termos.http"
GO_INTAKE_HTTP="$EVIDENCE_DIR/go-intake.http"
INTAKE_HTTP="$EVIDENCE_DIR/intake.http"
VALID_HEADERS="$EVIDENCE_DIR/intake-valid.headers"
VALID_JSON="$EVIDENCE_DIR/intake-valid.json"
INVALID_HEADERS="$EVIDENCE_DIR/intake-invalid.headers"
INVALID_JSON="$EVIDENCE_DIR/intake-invalid.json"
COCKPIT_HTTP="$EVIDENCE_DIR/cockpit.http"
DB_INSPECTION_JSON="$EVIDENCE_DIR/db-inspection.json"
SUMMARY_JSON="$EVIDENCE_DIR/summary.json"
mkdir -p "$EVIDENCE_DIR"
: > "$VERIFY_LOG"
: > "$SERVER_LOG"

log() {
  printf '%s %s\n' "[$(date -u +%Y-%m-%dT%H:%M:%SZ)]" "$*" | tee -a "$VERIFY_LOG"
}

PORT="$({
  node - <<'NODE'
const net = require('node:net');
const server = net.createServer();
server.listen(0, '127.0.0.1', () => {
  const address = server.address();
  console.log(address.port);
  server.close();
});
NODE
} | tr -d '\n')"

RUN_LABEL="${VERIFY_RUN_LABEL:-t2-cycle-5}"
RUN_STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_STAMP_LOWER="$(printf '%s' "$RUN_STAMP" | tr '[:upper:]' '[:lower:]')"
TEST_EMAIL="t2-cycle-5-${RUN_STAMP_LOWER}@example.com"
TEST_NAME="T2 Cycle 5 ${RUN_STAMP}"
TEST_PHONE="11970000000"
TEST_SOURCE_LABEL="site_home_primary_cta"
TEST_SOURCE_CHANNEL="site_home"
TEST_CITY="São Paulo"
TEST_STATE="SP"
TEST_ASSET_BAND="3m_a_10m"
TEST_CHALLENGE="Preciso organizar a tomada de decisão patrimonial com mais clareza, método e registro."

assert_status() {
  local expected="$1"
  local file="$2"
  grep -q "^HTTP/1.1 ${expected} " "$file"
}

log "BEGIN $RUN_LABEL"
log "Using ephemeral port $PORT"
log "Running typecheck"
npm run typecheck | tee -a "$VERIFY_LOG"
log "Running build"
npm run build | tee -a "$VERIFY_LOG"
log "Starting built app server"
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
  log "Server did not become ready in time"
  tail -n 100 "$SERVER_LOG" | tee -a "$VERIFY_LOG"
  exit 1
fi

log "Capturing public route proofs"
curl -sS -i "http://127.0.0.1:$PORT/" > "$HOME_HTTP"
curl -sS -i "http://127.0.0.1:$PORT/para-quem-e" > "$WHO_HTTP"
curl -sS -i "http://127.0.0.1:$PORT/como-funciona" > "$HOW_HTTP"
curl -sS -i "http://127.0.0.1:$PORT/privacidade" > "$PRIVACY_HTTP"
curl -sS -i "http://127.0.0.1:$PORT/termos" > "$TERMS_HTTP"
curl -sS -i "http://127.0.0.1:$PORT/go/intake?sourceLabel=$TEST_SOURCE_LABEL" > "$GO_INTAKE_HTTP"
curl -sS -i "http://127.0.0.1:$PORT/intake?sourceLabel=$TEST_SOURCE_LABEL" > "$INTAKE_HTTP"

assert_status 200 "$HOME_HTTP"
assert_status 200 "$WHO_HTTP"
assert_status 200 "$HOW_HTTP"
assert_status 200 "$PRIVACY_HTTP"
assert_status 200 "$TERMS_HTTP"
assert_status 302 "$GO_INTAKE_HTTP"
assert_status 200 "$INTAKE_HTTP"

grep -q '/para-quem-e' "$HOME_HTTP"
grep -q '/como-funciona' "$HOME_HTTP"
grep -q '/privacidade' "$HOME_HTTP"
grep -q '/termos' "$HOME_HTTP"
grep -q '/privacidade' "$INTAKE_HTTP"
grep -q '/termos' "$INTAKE_HTTP"

log "Posting successful intake"
curl -sS -D "$VALID_HEADERS" \
  -H 'content-type: application/json' \
  -d "{\"fullName\":\"$TEST_NAME\",\"email\":\"$TEST_EMAIL\",\"phone\":\"$TEST_PHONE\",\"city\":\"$TEST_CITY\",\"state\":\"$TEST_STATE\",\"investableAssetsBand\":\"$TEST_ASSET_BAND\",\"primaryChallenge\":\"$TEST_CHALLENGE\",\"sourceLabel\":\"$TEST_SOURCE_LABEL\",\"privacyConsentAccepted\":true,\"termsConsentAccepted\":true,\"sourceChannel\":\"$TEST_SOURCE_CHANNEL\"}" \
  "http://127.0.0.1:$PORT/api/intake" > "$VALID_JSON"

log "Posting validation failure case"
curl -sS -D "$INVALID_HEADERS" \
  -H 'content-type: application/json' \
  -d '{"fullName":"A","email":"x","phone":"1","investableAssetsBand":"x","primaryChallenge":"curto","sourceLabel":"","privacyConsentAccepted":false,"termsConsentAccepted":false,"sourceChannel":"site_home"}' \
  "http://127.0.0.1:$PORT/api/intake" > "$INVALID_JSON"

assert_status 201 "$VALID_HEADERS"
assert_status 400 "$INVALID_HEADERS"
grep -q '"ok":true' "$VALID_JSON"
grep -q '"leadId":"' "$VALID_JSON"
grep -q '"ok":false' "$INVALID_JSON"
grep -q '"field":"email"' "$INVALID_JSON"
grep -q '"field":"privacyConsentAccepted"' "$INVALID_JSON"

SUCCESS_LEAD_ID="$(node -e "const fs=require('node:fs');const body=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));if(!body.leadId){process.exit(1)};process.stdout.write(body.leadId);" "$VALID_JSON")"

log "Capturing cockpit proof"
curl -sS -i "http://127.0.0.1:$PORT/cockpit/leads" > "$COCKPIT_HTTP"
assert_status 200 "$COCKPIT_HTTP"

log "Capturing DB inspection"
OUTPUT_PATH="$DB_INSPECTION_JSON" LEAD_EMAIL="$TEST_EMAIL" bash infra/scripts/inspect-t2-db.sh > /dev/null

node - "$VALID_JSON" "$INVALID_JSON" "$DB_INSPECTION_JSON" "$COCKPIT_HTTP" "$SUMMARY_JSON" "$SUCCESS_LEAD_ID" "$TEST_EMAIL" "$TEST_NAME" <<'NODE'
const fs = require('node:fs');
const validBody = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const invalidBody = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const inspection = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
const cockpitHtml = fs.readFileSync(process.argv[5], 'utf8');
const summaryPath = process.argv[6];
const successLeadId = process.argv[7];
const testEmail = process.argv[8];
const testName = process.argv[9];

if (!inspection.matchingLead) {
  throw new Error('Expected lead not found in DB inspection');
}
if (inspection.matchingLead.email !== testEmail) {
  throw new Error('DB lead email does not match successful submission');
}
if (inspection.matchingLead.full_name !== testName) {
  throw new Error('DB lead name does not match successful submission');
}
if (inspection.matchingLead.lead_id !== successLeadId || validBody.leadId !== successLeadId) {
  throw new Error('Lead id mismatch between API and DB');
}
if (inspection.matchingLead.status !== 'new') {
  throw new Error(`Unexpected lead status: ${inspection.matchingLead.status}`);
}
const hasSuccessEvent = inspection.matchingLeadEvents.some((event) => event.event_name === 't2_intake_submit_succeeded');
if (!hasSuccessEvent) {
  throw new Error('Expected success event for submitted lead not found');
}
if (!Array.isArray(invalidBody.errors) || invalidBody.errors.length === 0) {
  throw new Error('Invalid submission did not return validation errors');
}
if (!cockpitHtml.includes(testName) || !cockpitHtml.includes(testEmail)) {
  throw new Error('Cockpit output does not show the submitted lead');
}
if (!cockpitHtml.includes('data/dev/bruno-advisory-dev.sqlite3')) {
  throw new Error('Cockpit output does not expose the DB-backed state path');
}

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  leadId: successLeadId,
  email: testEmail,
  name: testName,
  dbPath: inspection.dbPath,
  counts: inspection.counts,
  matchingLead: inspection.matchingLead,
  matchingLeadEvents: inspection.matchingLeadEvents,
  invalidErrorFields: invalidBody.errors.map((error) => error.field),
  cockpitContainsLead: true,
  cockpitShowsDbPath: true
};
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
NODE

[ -s "$SUMMARY_JSON" ]

log "T2 verification path passed"
log "Evidence folder: $EVIDENCE_DIR"
log "END $RUN_LABEL OK"
