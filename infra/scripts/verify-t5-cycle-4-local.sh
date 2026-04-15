#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T5-cycle-4}"
mkdir -p "$EVIDENCE_DIR"

rm -rf apps/web/.next apps/web/.next.partial.* 2>/dev/null || true
npm run typecheck >/dev/null

build_ok=0
for attempt in 1 2 3; do
  if npm run build >/dev/null; then
    build_ok=1
    break
  fi
  if [ "$attempt" -lt 3 ]; then
    sleep 2
  fi
done

if [ "$build_ok" -ne 1 ]; then
  echo "Build failed after 3 attempts" >&2
  exit 1
fi

node - "$ROOT" "$EVIDENCE_DIR" <<'NODE'
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

async function json(res) {
  let body = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  }
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body };
}

function requireUserland(modulePath) {
  return require(modulePath).routeModule.userland;
}

async function main() {
  const root = process.argv[2];
  const evidenceDir = path.resolve(root, process.argv[3]);
  const webDir = path.join(root, 'apps', 'web');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t5-cycle4-'));
  fs.mkdirSync(path.join(tempRoot, 'data', 'dev'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
  fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
  fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
  process.chdir(tempRoot);
  process.on('exit', () => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const intakeRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js'));
  const taskCreateRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', 'route.js'));
  const taskStatusRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', '[taskId]', 'status', 'route.js'));
  const stageRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'commercial-stage', 'route.js'));
  const billingRecordRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-record', 'route.js'));
  const billingChargeRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-charges', 'route.js'));
  const billingProgressionRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-charges', 'next', 'route.js'));
  const billingSettlementRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-settlements', '[chargeId]', 'route.js'));
  const inviteRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'portal-invite-codes', 'route.js'));
  const portalSessionRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'session', 'route.js'));
  const portalLogoutRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'portal', 'logout', 'route.js'));
  const memoRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'memos', 'route.js'));
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
        primaryChallenge: 'Quero trilha crítica com auditoria unificada.',
        sourceLabel: label,
        privacyConsentAccepted: true,
        termsConsentAccepted: true
      })
    })));

    if (response.status !== 201 || !response.body?.leadId) {
      throw new Error(`Intake failed for ${label}: ${JSON.stringify(response)}`);
    }

    return response.body.leadId;
  }

  async function createTask(leadId) {
    const response = await json(await taskCreateRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Checklist auditável para billing local', status: 'todo', dueDate: '2026-04-25' })
    }), { params: Promise.resolve({ leadId }) }));

    if (response.status !== 201 || !response.body?.task?.taskId) {
      throw new Error(`Task create failed: ${JSON.stringify(response)}`);
    }

    return response.body.task.taskId;
  }

  async function setTaskDone(leadId, taskId) {
    const response = await json(await taskStatusRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks/${taskId}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ toStatus: 'done', changedBy: 'verify_t5_cycle_4_local' })
    }), { params: Promise.resolve({ leadId, taskId }) }));

    if (response.status !== 200 || !response.body?.ok) {
      throw new Error(`Task status failed: ${JSON.stringify(response)}`);
    }
  }

  async function changeStage(leadId) {
    const response = await json(await stageRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/commercial-stage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ toStage: 'cliente_convertido', changedBy: 'verify_t5_cycle_4_local', note: 'pronto para billing auditado' })
    }), { params: Promise.resolve({ leadId }) }));

    if (response.status !== 200 || !response.body?.ok) {
      throw new Error(`Stage change failed: ${JSON.stringify(response)}`);
    }
  }

  async function createBillingRecord(leadId) {
    const response = await json(await billingRecordRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-record`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t5_cycle_4_local', note: 'ativar billing auditado' })
    }), { params: Promise.resolve({ leadId }) }));

    if (response.status !== 201 || !response.body?.billingRecord?.billingRecordId) {
      throw new Error(`Billing record failed: ${JSON.stringify(response)}`);
    }

    return response.body.billingRecord;
  }

  async function createCharge(leadId) {
    const response = await json(await billingChargeRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t5_cycle_4_local', note: 'primeira cobrança auditada' })
    }), { params: Promise.resolve({ leadId }) }));

    if (response.status !== 201 || !response.body?.charge?.chargeId) {
      throw new Error(`Charge create failed: ${JSON.stringify(response)}`);
    }

    return response.body.charge;
  }

  async function settleCharge(leadId, chargeId) {
    const response = await json(await billingSettlementRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-settlements/${chargeId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t5_cycle_4_local', note: 'liquidação auditada' })
    }), { params: Promise.resolve({ leadId, chargeId }) }));

    if (response.status !== 201 || !response.body?.settlement?.settlementId) {
      throw new Error(`Settlement failed: ${JSON.stringify(response)}`);
    }

    return response.body.settlement;
  }

  async function progressCharge(leadId) {
    const response = await json(await billingProgressionRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges/next`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t5_cycle_4_local', note: 'progressão auditada' })
    }), { params: Promise.resolve({ leadId }) }));

    if (response.status !== 201 || !response.body?.charge?.chargeId) {
      throw new Error(`Charge progression failed: ${JSON.stringify(response)}`);
    }

    return response.body.charge;
  }

  async function createInvite(leadId) {
    const response = await json(await inviteRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/portal-invite-codes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    }), { params: Promise.resolve({ leadId }) }));

    if (response.status !== 200 || !response.body?.invite?.inviteId || !response.body?.invite?.code) {
      throw new Error(`Invite create failed: ${JSON.stringify(response)}`);
    }

    return response.body.invite;
  }

  async function redeemInvite(code) {
    const form = new FormData();
    form.set('code', code);
    const response = await json(await portalSessionRoute.POST(new Request('http://localhost/api/portal/session', {
      method: 'POST',
      body: form
    })));
    const setCookie = response.headers['set-cookie'] || '';

    if (response.status !== 302 || !setCookie.includes('portal_session=')) {
      throw new Error(`Portal redeem failed: ${JSON.stringify(response)}`);
    }

    return setCookie.split(';')[0];
  }

  async function logout(cookie) {
    const response = await json(await portalLogoutRoute.POST(new Request('http://localhost/portal/logout', {
      method: 'POST',
      headers: { cookie }
    })));

    if (response.status !== 303) {
      throw new Error(`Portal logout failed: ${JSON.stringify(response)}`);
    }
  }

  async function createMemo(leadId) {
    const response = await json(await memoRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/memos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Memo auditado', body: 'Versão inicial do memo para aprovação.' })
    }), { params: Promise.resolve({ leadId }) }));

    if (response.status !== 201 || !response.body?.memo?.id) {
      throw new Error(`Memo create failed: ${JSON.stringify(response)}`);
    }

    return response.body.memo;
  }

  async function patchMemo(leadId, payload) {
    const response = await json(await memoRoute.PATCH(new Request(`http://localhost/api/cockpit/leads/${leadId}/memos`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }), { params: Promise.resolve({ leadId }) }));

    if (response.status !== 200 || !response.body?.memo?.id) {
      throw new Error(`Memo patch failed: ${JSON.stringify(response)}`);
    }

    return response.body.memo;
  }

  async function getAuditLog(url) {
    const response = await json(await auditLogRoute.GET(new Request(url)));
    if (response.status !== 200 || !Array.isArray(response.body?.entries)) {
      throw new Error(`Audit log GET failed: ${JSON.stringify(response)}`);
    }
    return response.body;
  }

  async function getLeadAuditLog(leadId, url) {
    const response = await json(await leadAuditLogRoute.GET(new Request(url), { params: Promise.resolve({ leadId }) }));
    if (response.status !== 200 || !Array.isArray(response.body?.entries)) {
      throw new Error(`Lead audit log GET failed: ${JSON.stringify(response)}`);
    }
    return response.body;
  }

  const leadA = await createLead('verify_t5_cycle_4_a', 'T5 Cycle 4 Lead A', 't5-cycle4-a');
  const leadB = await createLead('verify_t5_cycle_4_b', 'T5 Cycle 4 Lead B', 't5-cycle4-b');

  const taskId = await createTask(leadA);
  await changeStage(leadA);
  await setTaskDone(leadA, taskId);
  const billingRecord = await createBillingRecord(leadA);
  const firstCharge = await createCharge(leadA);
  const settlement = await settleCharge(leadA, firstCharge.chargeId);
  const progressedCharge = await progressCharge(leadA);

  const inviteA = await createInvite(leadA);
  const portalCookie = await redeemInvite(inviteA.code);
  await logout(portalCookie);

  const inviteB = await createInvite(leadB);

  const memo = await createMemo(leadA);
  const memoInReview = await patchMemo(leadA, { id: memo.id, body: 'Memo pronto para revisão.', status: 'pending_review' });
  const approvedMemo = await patchMemo(leadA, { id: memo.id, status: 'approved' });

  const dbPath = path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3');
  const db = new DatabaseSync(dbPath);
  const leadAAuditRows = db.prepare(`
    SELECT id, action, entity_type AS entityType, entity_id AS entityId, lead_id AS leadId, actor_type AS actorType, detail, created_at AS createdAt
    FROM audit_log
    WHERE lead_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(leadA);
  const leadBAuditRows = db.prepare(`
    SELECT id, action, entity_type AS entityType, entity_id AS entityId, lead_id AS leadId, actor_type AS actorType, detail, created_at AS createdAt
    FROM audit_log
    WHERE lead_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(leadB);

  const leadAActions = leadAAuditRows.map((row) => row.action);
  const requiredLeadAActions = [
    'commercial_stage_changed',
    'billing_record_created',
    'billing_record_activated',
    'charge_created',
    'charge_settled',
    'charge_progressed',
    'portal_invite_created',
    'portal_session_created',
    'portal_session_deleted',
    'memo_approved'
  ];

  for (const action of requiredLeadAActions) {
    if (!leadAActions.includes(action)) {
      throw new Error(`Missing lead A audit action: ${action}. Present=${leadAActions.join(',')}`);
    }
  }

  if (!leadBAuditRows.some((row) => row.action === 'portal_invite_created')) {
    throw new Error(`Lead B expected portal_invite_created entry: ${JSON.stringify(leadBAuditRows)}`);
  }

  const allAuditLog = await getAuditLog('http://localhost/api/cockpit/audit-log?limit=100');
  const filteredAuditLog = await getAuditLog(`http://localhost/api/cockpit/audit-log?leadId=${leadA}&limit=100`);
  const leadAuditLog = await getLeadAuditLog(leadA, `http://localhost/api/cockpit/leads/${leadA}/audit-log?limit=100`);

  if (!allAuditLog.entries.some((entry) => entry.leadId === leadA) || !allAuditLog.entries.some((entry) => entry.leadId === leadB)) {
    throw new Error(`Full audit log should include both leads: ${JSON.stringify(allAuditLog)}`);
  }
  if (filteredAuditLog.entries.length < 3) {
    throw new Error(`Filtered audit log should include 3+ entries for lead A: ${JSON.stringify(filteredAuditLog)}`);
  }
  if (filteredAuditLog.entries.some((entry) => entry.leadId !== leadA)) {
    throw new Error(`Global audit log filter leaked foreign lead entries: ${JSON.stringify(filteredAuditLog.entries)}`);
  }
  if (leadAuditLog.entries.some((entry) => entry.leadId !== leadA)) {
    throw new Error(`Lead audit log route leaked foreign lead entries: ${JSON.stringify(leadAuditLog.entries)}`);
  }
  if (filteredAuditLog.entries.some((entry) => entry.leadId === leadB) || leadAuditLog.entries.some((entry) => entry.leadId === leadB)) {
    throw new Error('Lead B must not appear in lead A filtered queries');
  }
  if (!filteredAuditLog.entries.some((entry) => entry.action === 'memo_approved')) {
    throw new Error(`Memo approval entry missing from filtered audit route: ${JSON.stringify(filteredAuditLog.entries)}`);
  }
  if (!filteredAuditLog.entries.some((entry) => entry.action === 'portal_session_created')) {
    throw new Error(`Portal session entry missing from filtered audit route: ${JSON.stringify(filteredAuditLog.entries)}`);
  }

  const appRoutesManifestPath = path.join(webDir, '.next', 'app-path-routes-manifest.json');
  const appRoutes = JSON.parse(fs.readFileSync(appRoutesManifestPath, 'utf8'));
  const leadDetailSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'page.tsx'), 'utf8');
  const auditLogPageSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'audit-log', 'page.tsx'), 'utf8');
  const auditLogRouteSource = fs.readFileSync(path.join(webDir, 'app', 'api', 'cockpit', 'audit-log', 'route.ts'), 'utf8');
  const leadAuditLogRouteSource = fs.readFileSync(path.join(webDir, 'app', 'api', 'cockpit', 'leads', '[leadId]', 'audit-log', 'route.ts'), 'utf8');

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadA,
    leadB,
    taskId,
    billingRecordId: billingRecord.billingRecordId,
    firstChargeId: firstCharge.chargeId,
    settlementId: settlement.settlementId,
    progressedChargeId: progressedCharge.chargeId,
    inviteAId: inviteA.inviteId,
    inviteBId: inviteB.inviteId,
    memoInReview,
    approvedMemo,
    dbPath,
    leadAAuditActionCount: leadAActions.length,
    leadAActions,
    leadBAuditActions: leadBAuditRows.map((row) => row.action),
    routeChecks: {
      fullAuditEntryCount: allAuditLog.entries.length,
      filteredAuditEntryCount: filteredAuditLog.entries.length,
      leadAuditEntryCount: leadAuditLog.entries.length,
      filteredAuditOnlyLeadA: filteredAuditLog.entries.every((entry) => entry.leadId === leadA),
      leadAuditOnlyLeadA: leadAuditLog.entries.every((entry) => entry.leadId === leadA)
    },
    surfaceChecks: {
      auditLogApiRoutePresent: Object.values(appRoutes).includes('/api/cockpit/audit-log'),
      leadAuditLogApiRoutePresent: Object.values(appRoutes).includes('/api/cockpit/leads/[leadId]/audit-log'),
      auditLogPagePresent: Object.values(appRoutes).includes('/cockpit/audit-log'),
      auditLogPageHasFilter: auditLogPageSource.includes('Filtrar por leadId') && auditLogPageSource.includes('Próxima página'),
      leadDetailUsesUnifiedAuditLog: leadDetailSource.includes('Unified audit log T5 cycle 4') && leadDetailSource.includes('listAuditLog({ leadId: lead.leadId, limit: 20 })'),
      auditLogRouteSupportsLeadFilter: auditLogRouteSource.includes("url.searchParams.get('leadId')") && auditLogRouteSource.includes('listAllAuditLog'),
      leadAuditLogRouteUsesLeadId: leadAuditLogRouteSource.includes('const { leadId } = await context.params') && leadAuditLogRouteSource.includes('listAuditLog({ leadId, limit, offset })')
    },
    note: 'HTTP bind may be blocked in this sandbox (listen EPERM); verification ran by invoking compiled route handlers directly against an isolated temp-root SQLite database.'
  };

  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
NODE
