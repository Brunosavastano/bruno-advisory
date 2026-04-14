#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T4-cycle-6}"
SUMMARY_JSON="$EVIDENCE_DIR/summary-local.json"
SERVER_LOG="$EVIDENCE_DIR/server.log"
mkdir -p "$EVIDENCE_DIR"
: > "$SERVER_LOG"

if [ ! -d apps/web/.next/server/app ]; then
  npm run build >/dev/null
fi

TMP_DIR="$(mktemp -d)"
BACKUP_DIR="$TMP_DIR/original-data-dev"
RUNTIME_DIR="$TMP_DIR/runtime"
mkdir -p "$RUNTIME_DIR"

restore() {
  if [ -n "${SERVER_PID:-}" ]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi

  rm -rf "$ROOT/data/dev"
  if [ -d "$BACKUP_DIR" ]; then
    mv "$BACKUP_DIR" "$ROOT/data/dev"
  else
    mkdir -p "$ROOT/data/dev"
  fi

  rm -rf "$TMP_DIR"
}
trap restore EXIT

if [ -d "$ROOT/data/dev" ]; then
  mv "$ROOT/data/dev" "$BACKUP_DIR"
fi
mkdir -p "$ROOT/data/dev"

PORT="$({ python3 - <<'PY'
import socket
with socket.socket() as s:
    s.bind(('127.0.0.1', 0))
    print(s.getsockname()[1])
PY
} | tr -d '\n')"
BASE_URL="http://127.0.0.1:$PORT"
COOKIE_JAR="$RUNTIME_DIR/cookies.txt"
UPLOAD_FILE="$RUNTIME_DIR/documento-cliente.txt"
printf 'Documento de prova T4 cycle 6\n' > "$UPLOAD_FILE"

HOSTNAME=127.0.0.1 PORT="$PORT" node apps/web/.next/standalone/apps/web/server.js > "$SERVER_LOG" 2>&1 &
SERVER_PID=$!

READY=0
for _ in {1..60}; do
  if curl -fsS "$BASE_URL/api/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "server did not become ready" >&2
  tail -n 100 "$SERVER_LOG" >&2 || true
  exit 1
fi

INTAKE_BODY="$RUNTIME_DIR/intake.json"
cat > "$INTAKE_BODY" <<'JSON'
{
  "fullName": "T4 Cycle 6 Cliente",
  "email": "t4-cycle-6@example.com",
  "phone": "11999990000",
  "city": "Brasilia",
  "state": "DF",
  "investableAssetsBand": "3m_a_10m",
  "primaryChallenge": "Consolidar acompanhamento patrimonial",
  "sourceLabel": "verify_t4_cycle_6",
  "privacyConsentAccepted": true,
  "termsConsentAccepted": true,
  "sourceChannel": "site_home"
}
JSON

INTAKE_RESPONSE="$RUNTIME_DIR/intake-response.json"
INTAKE_STATUS="$(curl -sS -o "$INTAKE_RESPONSE" -w '%{http_code}' -H 'content-type: application/json' -d @"$INTAKE_BODY" "$BASE_URL/api/intake")"
LEAD_ID="$(python3 - <<'PY' "$INTAKE_RESPONSE"
import json, sys
body = json.load(open(sys.argv[1]))
print(body.get('leadId',''))
PY
)"

INVITE_RESPONSE="$RUNTIME_DIR/invite-response.json"
INVITE_STATUS="$(curl -sS -o "$INVITE_RESPONSE" -w '%{http_code}' -H 'content-type: application/json' -d '{}' "$BASE_URL/api/cockpit/leads/$LEAD_ID/portal-invite-codes")"
INVITE_CODE="$(python3 - <<'PY' "$INVITE_RESPONSE"
import json, sys
body = json.load(open(sys.argv[1]))
print((body.get('invite') or {}).get('code',''))
PY
)"
INVITE_ID="$(python3 - <<'PY' "$INVITE_RESPONSE"
import json, sys
body = json.load(open(sys.argv[1]))
print((body.get('invite') or {}).get('inviteId',''))
PY
)"

REDEEM_HEADERS="$RUNTIME_DIR/redeem.headers"
REDEEM_STATUS="$(curl -sS -o /dev/null -D "$REDEEM_HEADERS" -c "$COOKIE_JAR" -w '%{http_code}' -X POST -F "code=$INVITE_CODE" "$BASE_URL/api/portal/session")"
SESSION_COOKIE="$(python3 - <<'PY' "$REDEEM_HEADERS"
import re, sys
headers = open(sys.argv[1], encoding='utf-8').read()
match = re.search(r'(?im)^set-cookie:\s*([^=;\s]+)=([^;\r\n]+)', headers)
if match:
    print(f"{match.group(1)}={match.group(2)}")
PY
)"

CHECKLIST_CREATE_BODY="$RUNTIME_DIR/checklist-create.json"
cat > "$CHECKLIST_CREATE_BODY" <<'JSON'
{
  "title": "Enviar comprovante de residencia",
  "description": "Subir comprovante atualizado no portal"
}
JSON
CHECKLIST_CREATE_RESPONSE="$RUNTIME_DIR/checklist-create-response.json"
CHECKLIST_CREATE_STATUS="$(curl -sS -o "$CHECKLIST_CREATE_RESPONSE" -w '%{http_code}' -H 'content-type: application/json' -d @"$CHECKLIST_CREATE_BODY" "$BASE_URL/api/cockpit/leads/$LEAD_ID/checklist")"
ITEM_ID="$(python3 - <<'PY' "$CHECKLIST_CREATE_RESPONSE"
import json, sys
body = json.load(open(sys.argv[1]))
print((body.get('item') or {}).get('itemId',''))
PY
)"

CHECKLIST_COMPLETE_HEADERS="$RUNTIME_DIR/checklist-complete.headers"
CHECKLIST_COMPLETE_STATUS="$(curl -sS -o /dev/null -D "$CHECKLIST_COMPLETE_HEADERS" -b "$COOKIE_JAR" -w '%{http_code}' -X POST "$BASE_URL/api/portal/checklist/$ITEM_ID/complete")"
CHECKLIST_LIST_RESPONSE="$RUNTIME_DIR/checklist-list-response.json"
CHECKLIST_LIST_STATUS="$(curl -sS -o "$CHECKLIST_LIST_RESPONSE" -w '%{http_code}' "$BASE_URL/api/cockpit/leads/$LEAD_ID/checklist")"

RECOMMENDATION_CREATE_BODY="$RUNTIME_DIR/recommendation-create.json"
cat > "$RECOMMENDATION_CREATE_BODY" <<'JSON'
{
  "title": "Rebalancear reserva tatica",
  "body": "Publicar ajuste conservador com foco em liquidez.",
  "recommendationDate": "2026-04-14",
  "category": "asset_allocation",
  "createdBy": "operator_local"
}
JSON
RECOMMENDATION_CREATE_RESPONSE="$RUNTIME_DIR/recommendation-create-response.json"
RECOMMENDATION_CREATE_STATUS="$(curl -sS -o "$RECOMMENDATION_CREATE_RESPONSE" -w '%{http_code}' -H 'content-type: application/json' -d @"$RECOMMENDATION_CREATE_BODY" "$BASE_URL/api/cockpit/leads/$LEAD_ID/recommendations")"
RECOMMENDATION_ID="$(python3 - <<'PY' "$RECOMMENDATION_CREATE_RESPONSE"
import json, sys
body = json.load(open(sys.argv[1]))
print((body.get('recommendation') or {}).get('recommendationId',''))
PY
)"
PORTAL_RECOMMENDATIONS_BEFORE="$RUNTIME_DIR/portal-recommendations-before.json"
PORTAL_RECOMMENDATIONS_BEFORE_STATUS="$(curl -sS -o "$PORTAL_RECOMMENDATIONS_BEFORE" -w '%{http_code}' -b "$COOKIE_JAR" "$BASE_URL/api/portal/recommendations")"
RECOMMENDATION_PUBLISH_RESPONSE="$RUNTIME_DIR/recommendation-publish-response.json"
RECOMMENDATION_PUBLISH_STATUS="$(curl -sS -o "$RECOMMENDATION_PUBLISH_RESPONSE" -w '%{http_code}' -X PATCH -H 'content-type: application/json' -d '{}' "$BASE_URL/api/cockpit/leads/$LEAD_ID/recommendations/$RECOMMENDATION_ID")"
PORTAL_RECOMMENDATIONS_AFTER="$RUNTIME_DIR/portal-recommendations-after.json"
PORTAL_RECOMMENDATIONS_AFTER_STATUS="$(curl -sS -o "$PORTAL_RECOMMENDATIONS_AFTER" -w '%{http_code}' -b "$COOKIE_JAR" "$BASE_URL/api/portal/recommendations")"

FLAG_CREATE_RESPONSE="$RUNTIME_DIR/flag-create-response.json"
FLAG_CREATE_STATUS="$(curl -sS -o "$FLAG_CREATE_RESPONSE" -w '%{http_code}' -H 'content-type: application/json' -d '{"flagCode":"pending_document","createdBy":"operator_local"}' "$BASE_URL/api/cockpit/leads/$LEAD_ID/pending-flags")"
PORTAL_DASHBOARD_HTML="$RUNTIME_DIR/portal-dashboard.html"
PORTAL_DASHBOARD_STATUS="$(curl -sS -o "$PORTAL_DASHBOARD_HTML" -w '%{http_code}' -b "$COOKIE_JAR" "$BASE_URL/portal/dashboard")"

PORTAL_DOCUMENTS_BEFORE="$RUNTIME_DIR/portal-documents-before.json"
PORTAL_DOCUMENTS_BEFORE_STATUS="$(curl -sS -o "$PORTAL_DOCUMENTS_BEFORE" -w '%{http_code}' -b "$COOKIE_JAR" "$BASE_URL/api/portal/documents")"
PORTAL_DOCUMENT_UPLOAD_RESPONSE="$RUNTIME_DIR/portal-document-upload.json"
PORTAL_DOCUMENT_UPLOAD_STATUS="$(curl -sS -o "$PORTAL_DOCUMENT_UPLOAD_RESPONSE" -w '%{http_code}' -b "$COOKIE_JAR" -F "file=@$UPLOAD_FILE;type=text/plain" "$BASE_URL/api/portal/documents")"
PORTAL_DOCUMENTS_AFTER="$RUNTIME_DIR/portal-documents-after.json"
PORTAL_DOCUMENTS_AFTER_STATUS="$(curl -sS -o "$PORTAL_DOCUMENTS_AFTER" -w '%{http_code}' -b "$COOKIE_JAR" "$BASE_URL/api/portal/documents")"
COCKPIT_DOCUMENTS_RESPONSE="$RUNTIME_DIR/cockpit-documents-response.json"
COCKPIT_DOCUMENTS_STATUS="$(curl -sS -o "$COCKPIT_DOCUMENTS_RESPONSE" -w '%{http_code}' "$BASE_URL/api/cockpit/leads/$LEAD_ID/documents")"

export ROOT SUMMARY_JSON SERVER_LOG INTAKE_RESPONSE INVITE_RESPONSE REDEEM_HEADERS CHECKLIST_CREATE_RESPONSE CHECKLIST_LIST_RESPONSE RECOMMENDATION_CREATE_RESPONSE PORTAL_RECOMMENDATIONS_BEFORE RECOMMENDATION_PUBLISH_RESPONSE PORTAL_RECOMMENDATIONS_AFTER FLAG_CREATE_RESPONSE PORTAL_DASHBOARD_HTML PORTAL_DOCUMENTS_BEFORE PORTAL_DOCUMENT_UPLOAD_RESPONSE PORTAL_DOCUMENTS_AFTER COCKPIT_DOCUMENTS_RESPONSE LEAD_ID INVITE_ID INVITE_CODE SESSION_COOKIE ITEM_ID RECOMMENDATION_ID INTAKE_STATUS INVITE_STATUS REDEEM_STATUS CHECKLIST_CREATE_STATUS CHECKLIST_COMPLETE_STATUS CHECKLIST_LIST_STATUS RECOMMENDATION_CREATE_STATUS PORTAL_RECOMMENDATIONS_BEFORE_STATUS RECOMMENDATION_PUBLISH_STATUS PORTAL_RECOMMENDATIONS_AFTER_STATUS FLAG_CREATE_STATUS PORTAL_DASHBOARD_STATUS PORTAL_DOCUMENTS_BEFORE_STATUS PORTAL_DOCUMENT_UPLOAD_STATUS PORTAL_DOCUMENTS_AFTER_STATUS COCKPIT_DOCUMENTS_STATUS

node <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readText(file) {
  return fs.readFileSync(file, 'utf8');
}

function num(name) {
  return Number(process.env[name] || '0');
}

function text(name) {
  return process.env[name] || '';
}

const db = new DatabaseSync(path.join(text('ROOT'), 'data', 'dev', 'bruno-advisory-dev.sqlite3'), { readonly: true });
const leadId = text('LEAD_ID');
const recommendationId = text('RECOMMENDATION_ID');
const itemId = text('ITEM_ID');

const checklistRow = db.prepare(`SELECT item_id AS itemId, status, completed_by AS completedBy, completed_at AS completedAt FROM onboarding_checklist_items WHERE item_id = ?`).get(itemId);
const recommendationRow = db.prepare(`SELECT recommendation_id AS recommendationId, visibility, published_at AS publishedAt FROM lead_recommendations WHERE recommendation_id = ?`).get(recommendationId);
const pendingFlagRow = db.prepare(`SELECT flag_id AS flagId, flag_type AS flagType, cleared_at AS clearedAt FROM lead_pending_flags WHERE lead_id = ? AND cleared_at IS NULL LIMIT 1`).get(leadId);
const documentRow = db.prepare(`SELECT document_id AS documentId, original_filename AS originalFilename, stored_filename AS storedFilename, status FROM lead_documents WHERE lead_id = ? ORDER BY uploaded_at DESC, document_id DESC LIMIT 1`).get(leadId);
const inviteRow = db.prepare(`SELECT invite_id AS inviteId, status, used_at AS usedAt FROM portal_invites WHERE invite_id = ?`).get(text('INVITE_ID'));
const sessionRow = db.prepare(`SELECT lead_id AS leadId, invite_id AS inviteId, session_token AS sessionToken FROM portal_sessions WHERE lead_id = ? LIMIT 1`).get(leadId);

const intakeBody = readJson(text('INTAKE_RESPONSE'));
const inviteBody = readJson(text('INVITE_RESPONSE'));
const checklistCreateBody = readJson(text('CHECKLIST_CREATE_RESPONSE'));
const checklistListBody = readJson(text('CHECKLIST_LIST_RESPONSE'));
const recommendationCreateBody = readJson(text('RECOMMENDATION_CREATE_RESPONSE'));
const portalRecommendationsBeforeBody = readJson(text('PORTAL_RECOMMENDATIONS_BEFORE'));
const recommendationPublishBody = readJson(text('RECOMMENDATION_PUBLISH_RESPONSE'));
const portalRecommendationsAfterBody = readJson(text('PORTAL_RECOMMENDATIONS_AFTER'));
const flagCreateBody = readJson(text('FLAG_CREATE_RESPONSE'));
const portalDocumentsBeforeBody = readJson(text('PORTAL_DOCUMENTS_BEFORE'));
const portalDocumentUploadBody = readJson(text('PORTAL_DOCUMENT_UPLOAD_RESPONSE'));
const portalDocumentsAfterBody = readJson(text('PORTAL_DOCUMENTS_AFTER'));
const cockpitDocumentsBody = readJson(text('COCKPIT_DOCUMENTS_RESPONSE'));
const redeemHeaders = readText(text('REDEEM_HEADERS'));
const portalDashboardHtml = readText(text('PORTAL_DASHBOARD_HTML'));

const summary = {
  ok: false,
  checkedAt: new Date().toISOString(),
  leadId,
  steps: {
    intake: {
      status: num('INTAKE_STATUS'),
      body: intakeBody
    },
    inviteCreate: {
      status: num('INVITE_STATUS'),
      body: inviteBody
    },
    inviteRedeem: {
      status: num('REDEEM_STATUS'),
      hasSessionCookie: redeemHeaders.includes('Set-Cookie:'),
      sessionCookieCaptured: Boolean(text('SESSION_COOKIE'))
    },
    checklistCreate: {
      status: num('CHECKLIST_CREATE_STATUS'),
      body: checklistCreateBody
    },
    checklistComplete: {
      status: num('CHECKLIST_COMPLETE_STATUS'),
      cockpitListStatus: num('CHECKLIST_LIST_STATUS'),
      cockpitListBody: checklistListBody,
      dbRow: checklistRow
    },
    recommendationDraft: {
      status: num('RECOMMENDATION_CREATE_STATUS'),
      body: recommendationCreateBody,
      portalBeforeStatus: num('PORTAL_RECOMMENDATIONS_BEFORE_STATUS'),
      portalBeforeBody: portalRecommendationsBeforeBody
    },
    recommendationPublish: {
      status: num('RECOMMENDATION_PUBLISH_STATUS'),
      body: recommendationPublishBody,
      portalAfterStatus: num('PORTAL_RECOMMENDATIONS_AFTER_STATUS'),
      portalAfterBody: portalRecommendationsAfterBody,
      dbRow: recommendationRow
    },
    pendingFlagHiddenFromPortal: {
      status: num('FLAG_CREATE_STATUS'),
      body: flagCreateBody,
      portalDashboardStatus: num('PORTAL_DASHBOARD_STATUS'),
      dashboardLeaksPendingFlag: /pending_document|Aguardando RG atualizado|pending_call|pending_payment|pending_contract|pending_other/.test(portalDashboardHtml),
      dbRow: pendingFlagRow
    },
    documentUpload: {
      portalBeforeStatus: num('PORTAL_DOCUMENTS_BEFORE_STATUS'),
      portalBeforeBody: portalDocumentsBeforeBody,
      uploadStatus: num('PORTAL_DOCUMENT_UPLOAD_STATUS'),
      uploadBody: portalDocumentUploadBody,
      portalAfterStatus: num('PORTAL_DOCUMENTS_AFTER_STATUS'),
      portalAfterBody: portalDocumentsAfterBody,
      cockpitStatus: num('COCKPIT_DOCUMENTS_STATUS'),
      cockpitBody: cockpitDocumentsBody,
      dbRow: documentRow
    }
  },
  sqliteProof: {
    inviteUsed: inviteRow,
    activeSession: sessionRow,
    checklistItem: checklistRow,
    recommendation: recommendationRow,
    pendingFlag: pendingFlagRow,
    latestDocument: documentRow
  },
  artifacts: {
    summaryPath: text('SUMMARY_JSON'),
    serverLog: text('SERVER_LOG')
  }
};

const portalBeforeRecommendations = Array.isArray(portalRecommendationsBeforeBody.recommendations)
  ? portalRecommendationsBeforeBody.recommendations
  : [];
const portalAfterRecommendations = Array.isArray(portalRecommendationsAfterBody.recommendations)
  ? portalRecommendationsAfterBody.recommendations
  : [];
const portalAfterDocuments = Array.isArray(portalDocumentsAfterBody.documents)
  ? portalDocumentsAfterBody.documents
  : [];
const cockpitDocuments = Array.isArray(cockpitDocumentsBody.documents)
  ? cockpitDocumentsBody.documents
  : [];

summary.ok = [
  num('INTAKE_STATUS') === 201,
  Boolean(intakeBody.leadId),
  num('INVITE_STATUS') === 200,
  Boolean(inviteBody?.invite?.code),
  num('REDEEM_STATUS') === 302,
  Boolean(text('SESSION_COOKIE')),
  num('CHECKLIST_CREATE_STATUS') === 201,
  num('CHECKLIST_COMPLETE_STATUS') === 303,
  num('CHECKLIST_LIST_STATUS') === 200,
  checklistRow?.status === 'completed',
  checklistRow?.completedBy === 'client',
  num('RECOMMENDATION_CREATE_STATUS') === 201,
  portalBeforeRecommendations.length === 0,
  num('RECOMMENDATION_PUBLISH_STATUS') === 200,
  num('PORTAL_RECOMMENDATIONS_AFTER_STATUS') === 200,
  portalAfterRecommendations.some((entry) => entry.recommendationId === recommendationId && entry.visibility === 'published'),
  recommendationRow?.visibility === 'published',
  Boolean(recommendationRow?.publishedAt),
  num('FLAG_CREATE_STATUS') === 201,
  Boolean(pendingFlagRow?.flagId),
  !summary.steps.pendingFlagHiddenFromPortal.dashboardLeaksPendingFlag,
  num('PORTAL_DOCUMENTS_BEFORE_STATUS') === 200,
  num('PORTAL_DOCUMENT_UPLOAD_STATUS') === 201,
  num('PORTAL_DOCUMENTS_AFTER_STATUS') === 200,
  num('COCKPIT_DOCUMENTS_STATUS') === 200,
  portalAfterDocuments.length === 1,
  cockpitDocuments.length === 1,
  portalAfterDocuments[0]?.documentId === documentRow?.documentId,
  cockpitDocuments[0]?.documentId === documentRow?.documentId,
  inviteRow?.status === 'used',
  Boolean(inviteRow?.usedAt),
  sessionRow?.leadId === leadId,
  sessionRow?.inviteId === text('INVITE_ID')
].every(Boolean);

fs.mkdirSync(path.dirname(text('SUMMARY_JSON')), { recursive: true });
fs.writeFileSync(text('SUMMARY_JSON'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (!summary.ok) process.exit(1);
NODE

echo "ok: $SUMMARY_JSON"