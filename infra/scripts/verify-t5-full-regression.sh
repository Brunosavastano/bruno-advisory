#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T5-cycle-6}"
mkdir -p "$EVIDENCE_DIR"

export PORT="${PORT:-3000}"
export APP_BASE_URL="${APP_BASE_URL:-http://127.0.0.1:3000}"
export COCKPIT_SECRET="${COCKPIT_SECRET:-test-secret-t5-cycle6}"
export DATABASE_PROVIDER="${DATABASE_PROVIDER:-sqlite}"
export DATABASE_URL="${DATABASE_URL:-$ROOT/data/dev/bruno-advisory-dev.sqlite3}"
export BACKUP_ARCHIVE="${BACKUP_ARCHIVE:-$ROOT/infra/backups/t5-cycle-6-local-latest.tar.gz}"

RESULTS_JSONL="$EVIDENCE_DIR/results.jsonl"
: > "$RESULTS_JSONL"

record_result() {
  local name="$1"
  local exit_code="$2"
  local log_path="$3"
  local evidence_path="${4:-}"

  python3 - "$RESULTS_JSONL" "$name" "$exit_code" "$log_path" "$evidence_path" <<'PY'
import json, os, sys
results_path, name, exit_code, log_path, evidence_path = sys.argv[1:6]
row = {
    "name": name,
    "exitCode": int(exit_code),
    "ok": int(exit_code) == 0,
    "logPath": os.path.relpath(log_path),
    "evidencePath": os.path.relpath(evidence_path) if evidence_path else None,
}
with open(results_path, 'a', encoding='utf-8') as fh:
    fh.write(json.dumps(row) + "\n")
PY
}

run_check() {
  local name="$1"
  local command="$2"
  local evidence_path="${3:-}"
  local log_path="$EVIDENCE_DIR/${name}.log"

  set +e
  bash -lc "$command" >"$log_path" 2>&1
  local exit_code=$?
  set -e

  record_result "$name" "$exit_code" "$log_path" "$evidence_path"
  return 0
}

rm -rf apps/web/.next apps/web/.next.partial.* 2>/dev/null || true

run_check "typecheck" "cd '$ROOT' && npm run typecheck"
run_check "build" "cd '$ROOT' && NODE_ENV=production npm run build"

cat > "$EVIDENCE_DIR/end-to-end.cjs" <<'NODE'
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

async function json(res) {
  let body = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body };
}

function requireUserland(modulePath) {
  return require(modulePath).routeModule.userland;
}

function assert(condition, message, payload) {
  if (!condition) {
    const suffix = payload === undefined ? '' : ` ${JSON.stringify(payload)}`;
    throw new Error(`${message}${suffix}`);
  }
}

async function main() {
  const root = process.argv[2];
  const evidenceDir = path.resolve(root, process.argv[3]);
  const webDir = path.join(root, 'apps', 'web');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t5-full-regression-'));
  fs.mkdirSync(path.join(tempRoot, 'data', 'dev'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
  fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
  fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
  process.chdir(tempRoot);
  process.on('exit', () => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const intakeRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js'));
  const taskRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', 'route.js'));
  const taskStatusRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', '[taskId]', 'status', 'route.js'));
  const stageRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'commercial-stage', 'route.js'));
  const billingReadinessRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-readiness', 'route.js'));
  const billingRecordRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-record', 'route.js'));
  const billingChargeRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-charges', 'route.js'));
  const inviteRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'portal-invite-codes', 'route.js'));
  const portalSessionRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'session', 'route.js'));
  const checklistRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'checklist', 'route.js'));
  const portalChecklistItemRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'checklist', '[itemId]', 'route.js'));
  const portalDocumentsRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'documents', 'route.js'));
  const cockpitDocumentsRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'documents', 'route.js'));
  const cockpitDocumentItemRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'documents', '[documentId]', 'route.js'));
  const recommendationRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'recommendations', 'route.js'));
  const recommendationActionRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'recommendations', '[recommendationId]', 'route.js'));
  const portalRecommendationsRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'recommendations', 'route.js'));
  const researchRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'research-workflows', 'route.js'));
  const portalResearchRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'research-workflows', 'route.js'));
  const memoRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'memos', 'route.js'));
  const portalMemosRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'memos', 'route.js'));
  const reviewQueueRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'review-queue', 'route.js'));
  const auditLogRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'audit-log', 'route.js'));
  const leadAuditLogRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'audit-log', 'route.js'));

  async function createLead(label, fullName, emailPrefix) {
    const response = await json(await intakeRoute.POST(new Request('http://localhost/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName,
        email: `${emailPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
        phone: '11988887777',
        city: 'Sao Paulo',
        state: 'SP',
        investableAssetsBand: '3m_a_10m',
        primaryChallenge: 'Executar regressão completa do operador ao portal.',
        sourceLabel: label,
        privacyConsentAccepted: true,
        termsConsentAccepted: true
      })
    })));
    assert(response.status === 201 && response.body?.leadId, 'Intake failed.', response);
    return response.body.leadId;
  }

  async function createTask(leadId, title) {
    const response = await json(await taskRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, status: 'todo', dueDate: '2026-05-01' })
    }), { params: Promise.resolve({ leadId }) }));
    assert(response.status === 201 && response.body?.task?.taskId, 'Task creation failed.', response);
    return response.body.task.taskId;
  }

  async function markTaskDone(leadId, taskId) {
    const response = await json(await taskStatusRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks/${taskId}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ toStatus: 'done', changedBy: 'verify_t5_full_regression' })
    }), { params: Promise.resolve({ leadId, taskId }) }));
    assert(response.status === 200 && response.body?.ok, 'Task completion failed.', response);
    return response.body;
  }

  async function setClientConverted(leadId) {
    const response = await json(await stageRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/commercial-stage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        toStage: 'cliente_convertido',
        changedBy: 'verify_t5_full_regression',
        note: 'Lead pronto para regressão full.'
      })
    }), { params: Promise.resolve({ leadId }) }));
    assert(response.status === 200 && response.body?.ok, 'Stage update failed.', response);
    return response.body;
  }

  async function getReadiness(leadId) {
    const response = await json(await billingReadinessRoute.GET(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-readiness`), {
      params: Promise.resolve({ leadId })
    }));
    assert(response.status === 200 && response.body?.readiness, 'Billing readiness read failed.', response);
    return response.body.readiness;
  }

  async function createBillingRecord(leadId) {
    const response = await json(await billingRecordRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-record`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t5_full_regression', note: 'Ativação de billing na regressão full.' })
    }), { params: Promise.resolve({ leadId }) }));
    assert(response.status === 201 && response.body?.billingRecord?.billingRecordId, 'Billing record creation failed.', response);
    return response.body.billingRecord;
  }

  async function createCharge(leadId) {
    const response = await json(await billingChargeRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t5_full_regression', note: 'Primeira cobrança da regressão full.' })
    }), { params: Promise.resolve({ leadId }) }));
    assert(response.status === 201 && response.body?.charge?.chargeId, 'Billing charge creation failed.', response);
    return response.body.charge;
  }

  async function createInvite(leadId) {
    const response = await json(await inviteRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/portal-invite-codes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    }), { params: Promise.resolve({ leadId }) }));
    assert(response.status === 200 && response.body?.invite?.inviteId && response.body?.invite?.code, 'Portal invite creation failed.', response);
    return response.body.invite;
  }

  async function login(code) {
    const form = new FormData();
    form.set('code', code);
    const response = await json(await portalSessionRoute.POST(new Request('http://localhost/api/portal/session', {
      method: 'POST',
      body: form
    })));
    const setCookie = response.headers['set-cookie'] || '';
    assert(response.status === 302 && setCookie.includes('portal_session='), 'Portal login failed.', response);
    return { response, cookie: setCookie.split(';')[0] };
  }

  async function createChecklistItem(leadId, title, description) {
    const response = await json(await checklistRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/checklist`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, description })
    }), { params: Promise.resolve({ leadId }) }));
    assert(response.status === 201 && response.body?.item?.itemId, 'Checklist creation failed.', response);
    return response.body.item;
  }

  async function completeChecklist(itemId, cookie) {
    const form = new FormData();
    form.set('returnTo', '/portal/dashboard');
    const response = await json(await portalChecklistItemRoute.POST(new Request(`http://localhost/api/portal/checklist/${itemId}`, {
      method: 'POST',
      headers: { cookie },
      body: form
    }), { params: Promise.resolve({ itemId }) }));
    assert(response.status === 303, 'Checklist completion failed.', response);
    return response;
  }

  async function completeChecklistForeign(itemId, cookie) {
    return json(await portalChecklistItemRoute.POST(new Request(`http://localhost/api/portal/checklist/${itemId}`, {
      method: 'POST',
      headers: { cookie },
      body: new FormData()
    }), { params: Promise.resolve({ itemId }) }));
  }

  async function uploadDocument(cookie, filename, content) {
    const form = new FormData();
    form.set('file', new File([content], filename, { type: 'application/pdf' }));
    const response = await json(await portalDocumentsRoute.POST(new Request('http://localhost/api/portal/documents', {
      method: 'POST',
      headers: { cookie },
      body: form
    })));
    assert(response.status === 201 && response.body?.document?.documentId, 'Document upload failed.', response);
    return response.body.document;
  }

  async function listPortalDocuments(cookie) {
    const response = await json(await portalDocumentsRoute.GET(new Request('http://localhost/api/portal/documents', {
      method: 'GET',
      headers: { cookie }
    })));
    assert(response.status === 200 && Array.isArray(response.body?.documents), 'Portal document list failed.', response);
    return response.body.documents;
  }

  async function listCockpitDocuments(leadId) {
    const response = await json(await cockpitDocumentsRoute.GET(new Request(`http://localhost/api/cockpit/leads/${leadId}/documents`), {
      params: Promise.resolve({ leadId })
    }));
    assert(response.status === 200 && Array.isArray(response.body?.documents), 'Cockpit document list failed.', response);
    return response.body.documents;
  }

  async function reviewDocument(leadId, documentId, status) {
    const response = await json(await cockpitDocumentItemRoute.PATCH(new Request(`http://localhost/api/cockpit/leads/${leadId}/documents/${documentId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status, reviewedBy: 'verify_t5_full_regression', reviewNote: 'Documento validado na regressão full.' })
    }), { params: Promise.resolve({ leadId, documentId }) }));
    assert(response.status === 200 && response.body?.document?.status === status, 'Document review failed.', response);
    return response.body.document;
  }

  async function createRecommendation(leadId, title) {
    const response = await json(await recommendationRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/recommendations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title,
        body: 'Ajuste tático e leitura de risco para o cliente.',
        category: 'general',
        createdBy: 'verify_t5_full_regression'
      })
    }), { params: Promise.resolve({ leadId }) }));
    assert(response.status === 201 && response.body?.recommendation?.recommendationId, 'Recommendation creation failed.', response);
    return response.body.recommendation;
  }

  async function publishRecommendation(leadId, recommendationId) {
    const response = await json(await recommendationActionRoute.PATCH(new Request(`http://localhost/api/cockpit/leads/${leadId}/recommendations/${recommendationId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    }), { params: Promise.resolve({ leadId, recommendationId }) }));
    assert(response.status === 200 && response.body?.recommendation?.visibility === 'published', 'Recommendation publish failed.', response);
    return response.body.recommendation;
  }

  async function listPortalRecommendations(cookie) {
    const response = await json(await portalRecommendationsRoute.GET(new Request('http://localhost/api/portal/recommendations', {
      method: 'GET',
      headers: { cookie }
    })));
    assert(response.status === 200 && Array.isArray(response.body?.recommendations), 'Portal ledger read failed.', response);
    return response.body.recommendations;
  }

  async function createWorkflow(leadId, title, topic) {
    const response = await json(await researchRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/research-workflows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, topic })
    }), { params: Promise.resolve({ leadId }) }));
    assert(response.status === 201 && response.body?.workflow?.id, 'Workflow creation failed.', response);
    return response.body.workflow;
  }

  async function updateWorkflow(leadId, id, status, rejectionReason) {
    const response = await json(await researchRoute.PATCH(new Request(`http://localhost/api/cockpit/leads/${leadId}/research-workflows`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, status, rejectionReason: rejectionReason || '' })
    }), { params: Promise.resolve({ leadId }) }));
    assert(response.status === 200 && response.body?.workflow?.status === status, 'Workflow update failed.', response);
    return response.body.workflow;
  }

  async function listPortalResearch(cookie) {
    const response = await json(await portalResearchRoute.GET(new Request('http://localhost/api/portal/research-workflows', {
      method: 'GET',
      headers: { cookie }
    })));
    assert(response.status === 200 && Array.isArray(response.body?.workflows), 'Portal research read failed.', response);
    return response.body.workflows;
  }

  async function createMemo(leadId, title, body, researchWorkflowId) {
    const response = await json(await memoRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/memos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, body, researchWorkflowId })
    }), { params: Promise.resolve({ leadId }) }));
    assert(response.status === 201 && response.body?.memo?.id, 'Memo creation failed.', response);
    return response.body.memo;
  }

  async function updateMemo(leadId, id, body, status, rejectionReason) {
    const payload = { id };
    if (typeof body === 'string') payload.body = body;
    if (typeof status === 'string') payload.status = status;
    if (typeof rejectionReason === 'string') payload.rejectionReason = rejectionReason;
    const response = await json(await memoRoute.PATCH(new Request(`http://localhost/api/cockpit/leads/${leadId}/memos`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }), { params: Promise.resolve({ leadId }) }));
    assert(response.status === 200 && response.body?.memo?.id, 'Memo update failed.', response);
    return response.body.memo;
  }

  async function listPortalMemos(cookie) {
    const response = await json(await portalMemosRoute.GET(new Request('http://localhost/api/portal/memos', {
      method: 'GET',
      headers: { cookie }
    })));
    assert(response.status === 200 && Array.isArray(response.body?.memos), 'Portal memos read failed.', response);
    return response.body.memos;
  }

  async function getReviewQueue() {
    const response = await json(await reviewQueueRoute.GET(new Request('http://localhost/api/cockpit/review-queue')));
    assert(response.status === 200 && Array.isArray(response.body?.items), 'Review queue read failed.', response);
    return response.body.items;
  }

  async function getAudit(url) {
    const response = await json(await auditLogRoute.GET(new Request(url)));
    assert(response.status === 200 && Array.isArray(response.body?.entries), 'Audit log read failed.', response);
    return response.body;
  }

  async function getLeadAudit(leadId, url) {
    const response = await json(await leadAuditLogRoute.GET(new Request(url), { params: Promise.resolve({ leadId }) }));
    assert(response.status === 200 && Array.isArray(response.body?.entries), 'Lead audit log read failed.', response);
    return response.body;
  }

  const leadA = await createLead('verify_t5_full_regression_a', 'T5 Full Regression Lead A', 't5-full-a');
  const leadB = await createLead('verify_t5_full_regression_b', 'T5 Full Regression Lead B', 't5-full-b');

  const taskId = await createTask(leadA, 'Concluir checklist interno para liberar billing');
  await markTaskDone(leadA, taskId);
  await setClientConverted(leadA);
  const readiness = await getReadiness(leadA);
  assert(readiness.isBillingReady === true, 'Billing readiness should be true for lead A.', readiness);
  const billingRecord = await createBillingRecord(leadA);
  const charge = await createCharge(leadA);

  const inviteA = await createInvite(leadA);
  const inviteB = await createInvite(leadB);
  const loginA = await login(inviteA.code);
  const loginB = await login(inviteB.code);

  const checklistA1 = await createChecklistItem(leadA, 'Enviar documentos principais', 'Usado no walkthrough do cliente.');
  const checklistA2 = await createChecklistItem(leadA, 'Ler o memo publicado', 'Validação do conteúdo no portal.');
  const checklistB1 = await createChecklistItem(leadB, 'Checklist do outro lead', 'Não deve ser manipulável pelo lead A.');
  const checklistCompleted = await completeChecklist(checklistA1.itemId, loginA.cookie);
  const foreignChecklistAttempt = await completeChecklistForeign(checklistB1.itemId, loginA.cookie);
  assert(foreignChecklistAttempt.status === 403, 'Foreign checklist isolation failed.', foreignChecklistAttempt);

  const uploadedDocument = await uploadDocument(loginA.cookie, 'regression-proof.pdf', 'pdf-bytes-regression');
  const portalDocumentsA = await listPortalDocuments(loginA.cookie);
  const portalDocumentsB = await listPortalDocuments(loginB.cookie);
  assert(portalDocumentsA.length === 1 && portalDocumentsA[0].documentId === uploadedDocument.documentId, 'Lead A portal docs mismatch.', portalDocumentsA);
  assert(portalDocumentsB.length === 0, 'Lead B should not see lead A documents.', portalDocumentsB);
  const cockpitDocumentsA = await listCockpitDocuments(leadA);
  const reviewedDocument = await reviewDocument(leadA, uploadedDocument.documentId, 'accepted');

  const recommendationA = await createRecommendation(leadA, 'Recomendação publicada lead A');
  const publishedRecommendationA = await publishRecommendation(leadA, recommendationA.recommendationId);
  const recommendationB = await createRecommendation(leadB, 'Recomendação publicada lead B');
  const publishedRecommendationB = await publishRecommendation(leadB, recommendationB.recommendationId);
  const portalLedgerA = await listPortalRecommendations(loginA.cookie);
  const portalLedgerB = await listPortalRecommendations(loginB.cookie);
  assert(portalLedgerA.length === 1 && portalLedgerA[0].recommendationId === publishedRecommendationA.recommendationId, 'Lead A ledger mismatch.', portalLedgerA);
  assert(portalLedgerB.length === 1 && portalLedgerB[0].recommendationId === publishedRecommendationB.recommendationId, 'Lead B ledger mismatch.', portalLedgerB);

  const deliveredWorkflowA = await createWorkflow(leadA, 'Research entregue lead A', 'Cenário macro para o cliente A.');
  const deliveredWorkflowAUpdated = await updateWorkflow(leadA, deliveredWorkflowA.id, 'delivered');
  const reviewWorkflowA = await createWorkflow(leadA, 'Research em revisão', 'Hipótese ainda pendente de aprovação.');
  const reviewWorkflowAUpdated = await updateWorkflow(leadA, reviewWorkflowA.id, 'review');
  const deliveredWorkflowB = await createWorkflow(leadB, 'Research entregue lead B', 'Cenário macro para o cliente B.');
  const deliveredWorkflowBUpdated = await updateWorkflow(leadB, deliveredWorkflowB.id, 'delivered');
  const portalResearchA = await listPortalResearch(loginA.cookie);
  const portalResearchB = await listPortalResearch(loginB.cookie);
  assert(portalResearchA.length === 1 && portalResearchA[0].id === deliveredWorkflowAUpdated.id, 'Lead A portal research mismatch.', portalResearchA);
  assert(portalResearchB.length === 1 && portalResearchB[0].id === deliveredWorkflowBUpdated.id, 'Lead B portal research mismatch.', portalResearchB);

  const publishedMemoA = await createMemo(leadA, 'Memo publicado lead A', 'Primeira versão do memo para o cliente A.', deliveredWorkflowAUpdated.id);
  const publishedMemoAUpdated = await updateMemo(leadA, publishedMemoA.id, 'Memo publicado e linkado ao research entregue do lead A.', 'published');
  const reviewMemoA = await createMemo(leadA, 'Memo em revisão', 'Texto aguardando aprovação.', null);
  const reviewMemoAUpdated = await updateMemo(leadA, reviewMemoA.id, 'Texto final aguardando aprovação.', 'pending_review');
  const publishedMemoB = await createMemo(leadB, 'Memo publicado lead B', 'Primeira versão do memo para o cliente B.', deliveredWorkflowBUpdated.id);
  const publishedMemoBUpdated = await updateMemo(leadB, publishedMemoB.id, 'Memo publicado e linkado ao research entregue do lead B.', 'published');
  const portalMemosA = await listPortalMemos(loginA.cookie);
  const portalMemosB = await listPortalMemos(loginB.cookie);
  assert(portalMemosA.length === 1 && portalMemosA[0].id === publishedMemoAUpdated.id, 'Lead A portal memos mismatch.', portalMemosA);
  assert(portalMemosB.length === 1 && portalMemosB[0].id === publishedMemoBUpdated.id, 'Lead B portal memos mismatch.', portalMemosB);

  const queueBefore = await getReviewQueue();
  const queueTypes = queueBefore.map((item) => item.type).sort().join(',');
  assert(queueBefore.length === 2 && queueTypes === 'memo,research_workflow', 'Review queue contents mismatch before actions.', queueBefore);
  const approvedMemo = await updateMemo(leadA, reviewMemoAUpdated.id, undefined, 'approved');
  const rejectedWorkflow = await updateWorkflow(leadA, reviewWorkflowAUpdated.id, 'rejected', 'Hipótese central insuficientemente suportada na regressão full.');
  const queueAfter = await getReviewQueue();
  assert(queueAfter.length === 0, 'Review queue should be empty after actions.', queueAfter);

  const auditAll = await getAudit('http://localhost/api/cockpit/audit-log?limit=50');
  const auditLeadA = await getAudit(`http://localhost/api/cockpit/audit-log?leadId=${leadA}&limit=50`);
  const leadAudit = await getLeadAudit(leadA, `http://localhost/api/cockpit/leads/${leadA}/audit-log?limit=50`);
  const leadAActions = auditLeadA.entries.map((entry) => entry.action);
  const requiredLeadAActions = [
    'commercial_stage_changed',
    'billing_record_created',
    'billing_record_activated',
    'charge_created',
    'portal_invite_created',
    'portal_session_created',
    'checklist_item_completed',
    'document_uploaded',
    'document_reviewed',
    'recommendation_published',
    'memo_approved',
    'research_workflow_rejected'
  ];
  for (const action of requiredLeadAActions) {
    assert(leadAActions.includes(action), `Audit log missing lead A action ${action}.`, leadAActions);
  }
  assert(auditLeadA.entries.every((entry) => entry.leadId === leadA), 'Filtered audit log leaked foreign lead entries.', auditLeadA.entries);
  assert(leadAudit.entries.every((entry) => entry.leadId === leadA), 'Per-lead audit log leaked foreign lead entries.', leadAudit.entries);

  const dbPath = path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3');
  const db = new DatabaseSync(dbPath);
  const checklistRow = db.prepare(`SELECT item_id AS itemId, lead_id AS leadId, status, completed_by AS completedBy FROM onboarding_checklist_items WHERE item_id = ? LIMIT 1`).get(checklistA1.itemId);
  const documentRow = db.prepare(`SELECT document_id AS documentId, lead_id AS leadId, status, reviewed_by AS reviewedBy FROM lead_documents WHERE document_id = ? LIMIT 1`).get(uploadedDocument.documentId);
  const billingRow = db.prepare(`SELECT billing_record_id AS billingRecordId, lead_id AS leadId, status FROM lead_billing_records WHERE billing_record_id = ? LIMIT 1`).get(billingRecord.billingRecordId);
  const chargeRow = db.prepare(`SELECT charge_id AS chargeId, lead_id AS leadId, status FROM lead_billing_charges WHERE charge_id = ? LIMIT 1`).get(charge.chargeId);
  const recommendationRow = db.prepare(`SELECT recommendation_id AS recommendationId, lead_id AS leadId, visibility FROM lead_recommendations WHERE recommendation_id = ? LIMIT 1`).get(publishedRecommendationA.recommendationId);
  const workflowRow = db.prepare(`SELECT id, lead_id AS leadId, status FROM research_workflows WHERE id = ? LIMIT 1`).get(deliveredWorkflowAUpdated.id);
  const memoRow = db.prepare(`SELECT id, lead_id AS leadId, status, research_workflow_id AS researchWorkflowId FROM memos WHERE id = ? LIMIT 1`).get(publishedMemoAUpdated.id);

  const dashboardSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'dashboard', 'page.tsx'), 'utf8');
  const ledgerSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'ledger', 'page.tsx'), 'utf8');
  const memosSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'memos', 'page.tsx'), 'utf8');
  const researchSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'research', 'page.tsx'), 'utf8');
  const reviewQueueSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'review-queue', 'page.tsx'), 'utf8');
  const auditPageSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'audit-log', 'page.tsx'), 'utf8');

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadA,
    leadB,
    billing: {
      readiness,
      billingRecord,
      charge
    },
    portal: {
      inviteA,
      inviteB,
      loginAStatus: loginA.response.status,
      loginBStatus: loginB.response.status
    },
    checklist: {
      ownCompletionStatus: checklistCompleted.status,
      foreignAttemptStatus: foreignChecklistAttempt.status
    },
    documents: {
      uploadedDocument,
      reviewedDocument,
      portalDocumentsA: portalDocumentsA.map((item) => item.documentId),
      portalDocumentsB: portalDocumentsB.map((item) => item.documentId),
      cockpitDocumentsA: cockpitDocumentsA.map((item) => item.documentId)
    },
    ledger: {
      leadARecommendationIds: portalLedgerA.map((item) => item.recommendationId),
      leadBRecommendationIds: portalLedgerB.map((item) => item.recommendationId)
    },
    research: {
      leadAPortalIds: portalResearchA.map((item) => item.id),
      leadBPortalIds: portalResearchB.map((item) => item.id),
      rejectedWorkflowId: rejectedWorkflow.id
    },
    memos: {
      leadAPortalIds: portalMemosA.map((item) => item.id),
      leadBPortalIds: portalMemosB.map((item) => item.id),
      approvedMemoId: approvedMemo.id
    },
    reviewQueue: {
      queueBefore,
      queueAfter
    },
    audit: {
      totalEntries: auditAll.entries.length,
      leadAEntries: auditLeadA.entries.length,
      requiredLeadAActions,
      leadAActions
    },
    persisted: {
      checklistRow,
      documentRow,
      billingRow,
      chargeRow,
      recommendationRow,
      workflowRow,
      memoRow
    },
    surfaceChecks: {
      dashboardLinksLedger: dashboardSource.includes('/portal/ledger'),
      dashboardLinksMemos: dashboardSource.includes('/portal/memos'),
      dashboardLinksResearch: dashboardSource.includes('/portal/research'),
      ledgerReadsPublishedRecommendations: ledgerSource.includes("listRecommendations(session.leadId, 'published')"),
      portalMemosReadPublishedOnly: memosSource.includes("listMemos(session.leadId, 'published')"),
      portalResearchReadsDeliveredOnly: researchSource.includes("listWorkflows(session.leadId, 'delivered')"),
      reviewQueuePagePresent: reviewQueueSource.includes('ReviewQueuePanel'),
      auditLogPagePresent: auditPageSource.includes('Audit log') || auditPageSource.includes('Audit')
    },
    note: 'Full regression executed via compiled route handlers against an isolated temp-root SQLite database to stay truthful when raw HTTP bind is blocked in sandboxed environments.'
  };

  assert(checklistRow?.status === 'completed' && checklistRow?.completedBy === 'client', 'Checklist persistence mismatch.', checklistRow);
  assert(documentRow?.status === 'accepted' && documentRow?.reviewedBy === 'verify_t5_full_regression', 'Document review persistence mismatch.', documentRow);
  assert(billingRow?.status === 'active_local', 'Billing record persistence mismatch.', billingRow);
  assert(chargeRow?.status === 'pending_local', 'Billing charge persistence mismatch.', chargeRow);
  assert(recommendationRow?.visibility === 'published', 'Recommendation persistence mismatch.', recommendationRow);
  assert(workflowRow?.status === 'delivered', 'Delivered workflow persistence mismatch.', workflowRow);
  assert(memoRow?.status === 'published' && memoRow?.researchWorkflowId === deliveredWorkflowAUpdated.id, 'Published memo persistence mismatch.', memoRow);

  fs.writeFileSync(path.join(evidenceDir, 'end-to-end-summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
NODE

build_exit_code=$(python3 - "$RESULTS_JSONL" <<'PY'
import json, sys
rows=[json.loads(line) for line in open(sys.argv[1], encoding='utf-8') if line.strip()]
row=next((row for row in rows if row['name']=='build'), None)
print(row['exitCode'] if row else 1)
PY
)

if [ "$build_exit_code" -eq 0 ]; then
  run_check "end-to-end" "cd '$ROOT' && node '$EVIDENCE_DIR/end-to-end.cjs' '$ROOT' '$EVIDENCE_DIR'" "$EVIDENCE_DIR/end-to-end-summary.json"
  run_check "billing-tests" "cd '$ROOT' && node --experimental-strip-types --test apps/web/lib/storage/__tests__/billing.test.ts"
  run_check "verify-t5-cycle1-local" "cd '$ROOT' && npm run verify:t5:cycle1:local" "$ROOT/state/evidence/T5-cycle-1/summary-local.json"
  run_check "verify-t5-cycle2-local" "cd '$ROOT' && npm run verify:t5:cycle2:local" "$ROOT/state/evidence/T5-cycle-2/summary-local.json"
  run_check "verify-t5-cycle3-local" "cd '$ROOT' && npm run verify:t5:cycle3:local" "$ROOT/state/evidence/T5-cycle-3/summary-local.json"
  run_check "verify-t5-cycle4-local" "cd '$ROOT' && npm run verify:t5:cycle4:local" "$ROOT/state/evidence/T5-cycle-4/summary-local.json"
  run_check "verify-t5-cycle5-local" "cd '$ROOT' && npm run verify:t5:cycle5:local" "$ROOT/state/evidence/T5-cycle-5/summary-local.json"
else
  for skipped in end-to-end billing-tests verify-t5-cycle1-local verify-t5-cycle2-local verify-t5-cycle3-local verify-t5-cycle4-local verify-t5-cycle5-local; do
    log_path="$EVIDENCE_DIR/${skipped}.log"
    printf 'skipped because build failed\n' > "$log_path"
    record_result "$skipped" 1 "$log_path" ""
  done
fi

node - "$ROOT" "$EVIDENCE_DIR" "$RESULTS_JSONL" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
const evidenceDir = path.resolve(root, process.argv[3]);
const jsonlPath = path.resolve(root, process.argv[4]);
const rows = fs.readFileSync(jsonlPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));

const results = rows.map((row) => {
  let evidence = null;
  if (row.evidencePath) {
    const resolvedEvidencePath = path.resolve(root, row.evidencePath);
    if (fs.existsSync(resolvedEvidencePath)) {
      try {
        evidence = JSON.parse(fs.readFileSync(resolvedEvidencePath, 'utf8'));
      } catch {
        evidence = { parseError: true };
      }
    }
  }

  return {
    name: row.name,
    ok: row.ok,
    exitCode: row.exitCode,
    logPath: row.logPath,
    evidencePath: row.evidencePath,
    evidenceOk: evidence && typeof evidence.ok === 'boolean' ? evidence.ok : null
  };
});

const overallOk = results.every((row) => row.ok);
const summary = {
  ok: overallOk,
  checkedAt: new Date().toISOString(),
  results
};

fs.writeFileSync(path.join(evidenceDir, 'regression-results.json'), `${JSON.stringify(summary, null, 2)}\n`);
fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify({ ok: overallOk }, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
if (!overallOk) {
  process.exit(1);
}
NODE
