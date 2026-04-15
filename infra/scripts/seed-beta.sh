#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

provider="$(printf '%s' "${DATABASE_PROVIDER:-sqlite}" | tr '[:upper:]' '[:lower:]')"
if [ "$provider" != "sqlite" ]; then
  echo "seed-beta.sh currently supports the repo-local SQLite runtime only. See docs/postgres-migration.md for the PostgreSQL cutover plan." >&2
  exit 1
fi

route_module="apps/web/.next/server/app/api/intake/route.js"
if [ ! -f "$route_module" ]; then
  rm -rf apps/web/.next apps/web/.next.partial.* 2>/dev/null || true
  NODE_ENV=production npm run build >/dev/null
fi

node - "$ROOT" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

async function json(res) {
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : await res.text();
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
  const webDir = path.join(root, 'apps', 'web');
  process.chdir(root);

  const intakeRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js'));
  const taskRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', 'route.js'));
  const taskStatusRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', '[taskId]', 'status', 'route.js'));
  const stageRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'commercial-stage', 'route.js'));
  const billingRecordRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-record', 'route.js'));
  const billingChargeRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-charges', 'route.js'));
  const inviteRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'portal-invite-codes', 'route.js'));
  const checklistRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'checklist', 'route.js'));
  const recommendationRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'recommendations', 'route.js'));
  const recommendationActionRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'recommendations', '[recommendationId]', 'route.js'));
  const researchRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'research-workflows', 'route.js'));
  const memoRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'memos', 'route.js'));

  const actor = process.env.BETA_SEED_ACTOR?.trim() || 'seed_beta';
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  const fullName = process.env.BETA_LEAD_NAME?.trim() || 'Beta Walkthrough Lead';
  const email = process.env.BETA_LEAD_EMAIL?.trim() || `beta-walkthrough-${unique}@example.com`;
  const sourceLabel = process.env.BETA_SOURCE_LABEL?.trim() || 'beta_walkthrough_local';

  const intakeResponse = await json(await intakeRoute.POST(new Request('http://localhost/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName,
      email,
      phone: '11988887777',
      city: 'Sao Paulo',
      state: 'SP',
      investableAssetsBand: '3m_a_10m',
      primaryChallenge: 'Quero validar o walkthrough beta completo antes do go-live.',
      sourceLabel,
      privacyConsentAccepted: true,
      termsConsentAccepted: true
    })
  })));
  assert(intakeResponse.status === 201 && intakeResponse.body?.leadId, 'Lead intake creation failed.', intakeResponse);
  const leadId = intakeResponse.body.leadId;

  const taskResponse = await json(await taskRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Checklist interno concluído para liberar billing beta',
      status: 'todo',
      dueDate: '2026-04-30'
    })
  }), { params: Promise.resolve({ leadId }) }));
  assert(taskResponse.status === 201 && taskResponse.body?.task?.taskId, 'Task creation failed.', taskResponse);
  const taskId = taskResponse.body.task.taskId;

  const taskDoneResponse = await json(await taskStatusRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks/${taskId}/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ toStatus: 'done', changedBy: actor })
  }), { params: Promise.resolve({ leadId, taskId }) }));
  assert(taskDoneResponse.status === 200 && taskDoneResponse.body?.ok, 'Task completion failed.', taskDoneResponse);

  const stageResponse = await json(await stageRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/commercial-stage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      toStage: 'cliente_convertido',
      changedBy: actor,
      note: 'Lead beta preparado para walkthrough completo.'
    })
  }), { params: Promise.resolve({ leadId }) }));
  assert(stageResponse.status === 200 && stageResponse.body?.ok, 'Commercial stage update failed.', stageResponse);

  const billingRecordResponse = await json(await billingRecordRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-record`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor, note: 'Ativação do billing para walkthrough beta.' })
  }), { params: Promise.resolve({ leadId }) }));
  assert(billingRecordResponse.status === 201 && billingRecordResponse.body?.billingRecord?.billingRecordId, 'Billing record creation failed.', billingRecordResponse);
  const billingRecordId = billingRecordResponse.body.billingRecord.billingRecordId;

  const chargeResponse = await json(await billingChargeRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor, note: 'Primeira cobrança local para walkthrough beta.' })
  }), { params: Promise.resolve({ leadId }) }));
  assert(chargeResponse.status === 201 && chargeResponse.body?.charge?.chargeId, 'Billing charge creation failed.', chargeResponse);
  const firstChargeId = chargeResponse.body.charge.chargeId;

  const inviteResponse = await json(await inviteRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/portal-invite-codes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  }), { params: Promise.resolve({ leadId }) }));
  assert(inviteResponse.status === 200 && inviteResponse.body?.invite?.inviteId && inviteResponse.body?.invite?.code, 'Portal invite creation failed.', inviteResponse);
  const inviteId = inviteResponse.body.invite.inviteId;
  const inviteCode = inviteResponse.body.invite.code;

  const checklistDefinitions = [
    { title: 'Assinar checklist de onboarding', description: 'Confirmação inicial para o walkthrough beta.' },
    { title: 'Enviar documentos base', description: 'Usar a área de upload do portal durante o teste.' },
    { title: 'Validar leitura de memos e research', description: 'Conferir os artefatos publicados no portal.' }
  ];

  const checklistItems = [];
  for (const definition of checklistDefinitions) {
    const checklistResponse = await json(await checklistRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/checklist`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(definition)
    }), { params: Promise.resolve({ leadId }) }));
    assert(checklistResponse.status === 201 && checklistResponse.body?.item?.itemId, 'Checklist item creation failed.', checklistResponse);
    checklistItems.push(checklistResponse.body.item);
  }

  const recommendationResponse = await json(await recommendationRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/recommendations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Recomendação beta publicada',
      body: 'Manter caixa tático e revisar alocação antes da próxima janela.',
      category: 'general',
      createdBy: actor
    })
  }), { params: Promise.resolve({ leadId }) }));
  assert(recommendationResponse.status === 201 && recommendationResponse.body?.recommendation?.recommendationId, 'Recommendation creation failed.', recommendationResponse);
  const recommendationId = recommendationResponse.body.recommendation.recommendationId;

  const recommendationPublishResponse = await json(await recommendationActionRoute.PATCH(new Request(`http://localhost/api/cockpit/leads/${leadId}/recommendations/${recommendationId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  }), { params: Promise.resolve({ leadId, recommendationId }) }));
  assert(recommendationPublishResponse.status === 200 && recommendationPublishResponse.body?.recommendation?.visibility === 'published', 'Recommendation publish failed.', recommendationPublishResponse);

  const researchResponse = await json(await researchRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/research-workflows`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Research beta entregue',
      topic: 'Cenário macro para o walkthrough de beta.'
    })
  }), { params: Promise.resolve({ leadId }) }));
  assert(researchResponse.status === 201 && researchResponse.body?.workflow?.id, 'Research workflow creation failed.', researchResponse);
  const researchWorkflowId = researchResponse.body.workflow.id;

  const researchDeliveredResponse = await json(await researchRoute.PATCH(new Request(`http://localhost/api/cockpit/leads/${leadId}/research-workflows`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: researchWorkflowId, status: 'delivered' })
  }), { params: Promise.resolve({ leadId }) }));
  assert(researchDeliveredResponse.status === 200 && researchDeliveredResponse.body?.workflow?.status === 'delivered', 'Research workflow delivery failed.', researchDeliveredResponse);

  const memoResponse = await json(await memoRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/memos`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Memo beta publicado',
      body: 'Resumo executivo do walkthrough beta, linkado ao research entregue.',
      researchWorkflowId
    })
  }), { params: Promise.resolve({ leadId }) }));
  assert(memoResponse.status === 201 && memoResponse.body?.memo?.id, 'Memo creation failed.', memoResponse);
  const memoId = memoResponse.body.memo.id;

  const memoPublishedResponse = await json(await memoRoute.PATCH(new Request(`http://localhost/api/cockpit/leads/${leadId}/memos`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: memoId, status: 'published' })
  }), { params: Promise.resolve({ leadId }) }));
  assert(memoPublishedResponse.status === 200 && memoPublishedResponse.body?.memo?.status === 'published', 'Memo publish failed.', memoPublishedResponse);

  const dbPath = path.join(root, 'data', 'dev', 'bruno-advisory-dev.sqlite3');
  assert(fs.existsSync(dbPath), 'Expected seeded SQLite database to exist.', { dbPath });
  const db = new DatabaseSync(dbPath);

  const inviteRow = db.prepare(`SELECT invite_id AS inviteId, lead_id AS leadId, code, status FROM portal_invites WHERE invite_id = ? LIMIT 1`).get(inviteId);
  assert(inviteRow && inviteRow.code === inviteCode && inviteRow.leadId === leadId, 'Seeded invite was not persisted correctly.', inviteRow);

  const checklistCount = db.prepare(`SELECT COUNT(*) AS count FROM onboarding_checklist_items WHERE lead_id = ?`).get(leadId);
  assert(checklistCount && Number(checklistCount.count) >= 3, 'Expected at least 3 checklist items for seeded lead.', checklistCount);

  const result = {
    ok: true,
    seededAt: new Date().toISOString(),
    leadId,
    fullName,
    email,
    taskId,
    commercialStage: 'cliente_convertido',
    billingRecordId,
    firstChargeId,
    inviteId,
    inviteCode,
    checklistItemIds: checklistItems.map((item) => item.itemId),
    recommendationId,
    researchWorkflowId,
    memoId,
    databasePath: dbPath,
    note: 'cliente_convertido is the current canonical T3/T5 code value for a converted client.'
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
NODE
