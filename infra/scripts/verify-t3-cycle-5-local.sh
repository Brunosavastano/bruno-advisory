#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3-cycle-5}"
mkdir -p "$EVIDENCE_DIR"

node - "$ROOT" "$EVIDENCE_DIR" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

async function main() {
  const root = process.argv[2];
  const evidenceDir = path.resolve(root, process.argv[3]);
  const webDir = path.join(root, 'apps', 'web');
  const appRoutesManifestPath = path.join(webDir, '.next', 'app-path-routes-manifest.json');
  const cockpitSourcePath = path.join(webDir, 'app', 'cockpit', 'leads', 'page.tsx');
  const detailSourcePath = path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'page.tsx');
  const dbPath = path.join(root, 'data', 'dev', 'bruno-advisory-dev.sqlite3');
  const appRoutes = JSON.parse(fs.readFileSync(appRoutesManifestPath, 'utf8'));
  const cockpitSource = fs.readFileSync(cockpitSourcePath, 'utf8');
  const detailSource = fs.readFileSync(detailSourcePath, 'utf8');

  process.chdir(webDir);
  const intakeRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js')).routeModule.userland;
  const taskCreateRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', 'route.js')).routeModule.userland;
  const taskStatusRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', '[taskId]', 'status', 'route.js')).routeModule.userland;
  const stageRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'commercial-stage', 'route.js')).routeModule.userland;
  const billingReadinessRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-readiness', 'route.js')).routeModule.userland;
  const billingRecordRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-record', 'route.js')).routeModule.userland;

  const testEmail = `t3-cycle-5-local-${Date.now()}@example.com`;
  const intakeRequest = new Request('http://localhost/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'T3 Cycle Five Local',
      email: testEmail,
      phone: '11988991155',
      city: 'Sao Paulo',
      state: 'SP',
      investableAssetsBand: '3m_a_10m',
      primaryChallenge: 'Quero ativar billing local so quando estiver pronto.',
      sourceLabel: 'verify_t3_cycle_5_local',
      privacyConsentAccepted: true,
      termsConsentAccepted: true
    })
  });
  const intakeResponse = await intakeRoute.POST(intakeRequest);
  const intakeBody = await intakeResponse.json();
  if (intakeResponse.status !== 201 || !intakeBody.leadId) {
    throw new Error(`Intake route invocation failed: status=${intakeResponse.status}`);
  }
  const leadId = intakeBody.leadId;

  const initialReadinessResponse = await billingReadinessRoute.GET(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-readiness`), { params: Promise.resolve({ leadId }) });
  const initialReadinessBody = await initialReadinessResponse.json();
  if (initialReadinessResponse.status !== 200 || !initialReadinessBody.ok || initialReadinessBody.readiness.isBillingReady) {
    throw new Error('Initial readiness should be unmet');
  }

  const blockedBillingRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-record`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: 'verify_t3_cycle_5_local', note: 'should fail before readiness' })
  });
  const blockedBillingResponse = await billingRecordRoute.POST(blockedBillingRequest, { params: Promise.resolve({ leadId }) });
  const blockedBillingBody = await blockedBillingResponse.json();
  if (blockedBillingResponse.status !== 422 || blockedBillingBody.code !== 'BILLING_NOT_READY') {
    throw new Error(`Billing creation should fail truthfully before readiness: status=${blockedBillingResponse.status}`);
  }

  const taskCreateRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Checklist final para ativar billing local', status: 'todo', dueDate: '2026-04-25' })
  });
  const taskCreateResponse = await taskCreateRoute.POST(taskCreateRequest, { params: Promise.resolve({ leadId }) });
  const taskCreateBody = await taskCreateResponse.json();
  if (taskCreateResponse.status !== 201 || !taskCreateBody.ok || !taskCreateBody.task?.taskId) {
    throw new Error('Task creation failed');
  }
  const taskId = taskCreateBody.task.taskId;

  const stageRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/commercial-stage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ toStage: 'cliente_convertido', changedBy: 'verify_t3_cycle_5_local', note: 'advance to local billing activation' })
  });
  const stageResponse = await stageRoute.POST(stageRequest, { params: Promise.resolve({ leadId }) });
  const stageBody = await stageResponse.json();
  if (stageResponse.status !== 200 || !stageBody.ok) {
    throw new Error('Commercial stage mutation failed');
  }

  const midReadinessResponse = await billingReadinessRoute.GET(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-readiness`), { params: Promise.resolve({ leadId }) });
  const midReadinessBody = await midReadinessResponse.json();
  if (midReadinessResponse.status !== 200 || !midReadinessBody.ok || midReadinessBody.readiness.isBillingReady) {
    throw new Error('Mid readiness should still be unmet');
  }

  const taskStatusRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks/${taskId}/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ toStatus: 'done', changedBy: 'verify_t3_cycle_5_local' })
  });
  const taskStatusResponse = await taskStatusRoute.POST(taskStatusRequest, { params: Promise.resolve({ leadId, taskId }) });
  const taskStatusBody = await taskStatusResponse.json();
  if (taskStatusResponse.status !== 200 || !taskStatusBody.ok) {
    throw new Error('Task status mutation failed');
  }

  const readyReadinessResponse = await billingReadinessRoute.GET(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-readiness`), { params: Promise.resolve({ leadId }) });
  const readyReadinessBody = await readyReadinessResponse.json();
  if (readyReadinessResponse.status !== 200 || !readyReadinessBody.ok || !readyReadinessBody.readiness.isBillingReady) {
    throw new Error('Final readiness should be true');
  }

  const billingCreateRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-record`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: 'verify_t3_cycle_5_local', note: 'activate first local billing record' })
  });
  const billingCreateResponse = await billingRecordRoute.POST(billingCreateRequest, { params: Promise.resolve({ leadId }) });
  const billingCreateBody = await billingCreateResponse.json();
  if (billingCreateResponse.status !== 201 || !billingCreateBody.ok || !billingCreateBody.billingRecord?.billingRecordId) {
    throw new Error(`Billing creation failed after readiness: status=${billingCreateResponse.status}`);
  }

  const db = new DatabaseSync(dbPath);
  const billingRecordRow = db.prepare(`SELECT billing_record_id, lead_id, status, currency, entry_fee_cents, monthly_fee_cents, minimum_commitment_months, activated_at, created_at FROM lead_billing_records WHERE lead_id = ? LIMIT 1`).get(leadId);
  const billingEventRows = db.prepare(`SELECT billing_event_id, billing_record_id, lead_id, event_type, occurred_at, actor, note FROM lead_billing_events WHERE lead_id = ? ORDER BY occurred_at DESC, billing_event_id DESC LIMIT 20`).all(leadId);
  if (!billingRecordRow) {
    throw new Error('Billing record row not found');
  }
  if (billingRecordRow.status !== 'active_local') {
    throw new Error(`Unexpected billing record status: ${billingRecordRow.status}`);
  }
  if (billingRecordRow.entry_fee_cents !== 950000 || billingRecordRow.monthly_fee_cents !== 350000 || billingRecordRow.minimum_commitment_months !== 6) {
    throw new Error('Billing record pricing does not match T1 canon');
  }
  const eventTypes = billingEventRows.map((row) => row.event_type);
  if (!eventTypes.includes('billing_record_created') || !eventTypes.includes('billing_record_activated')) {
    throw new Error(`Missing expected billing events: ${eventTypes.join(', ')}`);
  }

  const routeValues = Object.values(appRoutes);
  const surfaceCheck = {
    appRoutesManifestPath,
    cockpitRoutePresent: routeValues.includes('/cockpit/leads'),
    leadDetailRoutePresent: routeValues.includes('/cockpit/leads/[leadId]'),
    billingReadinessRoutePresent: routeValues.includes('/api/cockpit/leads/[leadId]/billing-readiness'),
    billingRecordRoutePresent: routeValues.includes('/api/cockpit/leads/[leadId]/billing-record'),
    cockpitLinksToDetail: cockpitSource.includes('href={`/cockpit/leads/${lead.leadId}`}'),
    leadDetailUsesBillingReadinessReadPath: detailSource.includes('getLeadBillingReadiness(lead.leadId)'),
    leadDetailUsesBillingRecordReadPath: detailSource.includes('getLeadBillingRecord(lead.leadId)'),
    leadDetailUsesBillingEventsReadPath: detailSource.includes('listLeadBillingEvents(lead.leadId, 20)'),
    leadDetailRendersBillingActivationSection: detailSource.includes('Billing activation T3 cycle 5') && detailSource.includes('Billing state:') && detailSource.includes('Billing events persistidos:'),
    leadDetailRendersBillingCreateForm: detailSource.includes('action={`/api/cockpit/leads/${lead.leadId}/billing-record`}'),
    leadDetailRendersLocalBillingArtifact: detailSource.includes('localBillingModel.canonicalArtifact')
  };

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadId,
    taskId,
    billingRecordId: billingCreateBody.billingRecord.billingRecordId,
    intakeRouteStatus: intakeResponse.status,
    initialBillingReadinessRouteStatus: initialReadinessResponse.status,
    blockedBillingRecordRouteStatus: blockedBillingResponse.status,
    taskCreateRouteStatus: taskCreateResponse.status,
    stageRouteStatus: stageResponse.status,
    midBillingReadinessRouteStatus: midReadinessResponse.status,
    taskStatusRouteStatus: taskStatusResponse.status,
    finalBillingReadinessRouteStatus: readyReadinessResponse.status,
    billingCreateRouteStatus: billingCreateResponse.status,
    intakeResponse: intakeBody,
    initialReadinessResponse: initialReadinessBody,
    blockedBillingCreateResponse: blockedBillingBody,
    taskCreateResponse: taskCreateBody,
    stageResponse: stageBody,
    midReadinessResponse: midReadinessBody,
    taskStatusResponse: taskStatusBody,
    finalReadinessResponse: readyReadinessBody,
    billingCreateResponse: billingCreateBody,
    surfaceCheck,
    dbInspection: {
      dbPath,
      billingRecordRow,
      billingEventRows
    },
    note: 'HTTP bind is blocked in this sandbox (listen EPERM); verification executed by invoking compiled app route handlers directly.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'local-route-intake.json'), `${JSON.stringify(intakeBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-billing-readiness-initial.json'), `${JSON.stringify(initialReadinessBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-billing-record-blocked.json'), `${JSON.stringify(blockedBillingBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-task-create.json'), `${JSON.stringify(taskCreateBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-stage-mutation.json'), `${JSON.stringify(stageBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-billing-readiness-mid.json'), `${JSON.stringify(midReadinessBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-task-status.json'), `${JSON.stringify(taskStatusBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-billing-readiness-ready.json'), `${JSON.stringify(readyReadinessBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-billing-record-created.json'), `${JSON.stringify(billingCreateBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-surface-check.json'), `${JSON.stringify(surfaceCheck, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-db-inspection.json'), `${JSON.stringify(summary.dbInspection, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
NODE
