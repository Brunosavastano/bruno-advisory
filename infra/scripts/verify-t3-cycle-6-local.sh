#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3-cycle-6}"
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
  const billingRecordRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-record', 'route.js')).routeModule.userland;
  const billingChargeRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-charges', 'route.js')).routeModule.userland;

  const testEmail = `t3-cycle-6-local-${Date.now()}@example.com`;
  const intakeRequest = new Request('http://localhost/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'T3 Cycle Six Local',
      email: testEmail,
      phone: '11988991156',
      city: 'Sao Paulo',
      state: 'SP',
      investableAssetsBand: '3m_a_10m',
      primaryChallenge: 'Quero representar a cobranca local so depois do billing ativo.',
      sourceLabel: 'verify_t3_cycle_6_local',
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

  const blockedChargeRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: 'verify_t3_cycle_6_local', note: 'should fail before active billing record' })
  });
  const blockedChargeResponse = await billingChargeRoute.POST(blockedChargeRequest, { params: Promise.resolve({ leadId }) });
  const blockedChargeBody = await blockedChargeResponse.json();
  if (blockedChargeResponse.status !== 422 || blockedChargeBody.code !== 'ACTIVE_BILLING_RECORD_REQUIRED') {
    throw new Error(`Charge creation should fail truthfully before active billing record: status=${blockedChargeResponse.status}`);
  }

  const taskCreateRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Checklist final para gerar a primeira cobranca local', status: 'todo', dueDate: '2026-04-26' })
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
    body: JSON.stringify({ toStage: 'cliente_convertido', changedBy: 'verify_t3_cycle_6_local', note: 'advance to chargeable local billing' })
  });
  const stageResponse = await stageRoute.POST(stageRequest, { params: Promise.resolve({ leadId }) });
  const stageBody = await stageResponse.json();
  if (stageResponse.status !== 200 || !stageBody.ok) {
    throw new Error('Commercial stage mutation failed');
  }

  const taskStatusRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks/${taskId}/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ toStatus: 'done', changedBy: 'verify_t3_cycle_6_local' })
  });
  const taskStatusResponse = await taskStatusRoute.POST(taskStatusRequest, { params: Promise.resolve({ leadId, taskId }) });
  const taskStatusBody = await taskStatusResponse.json();
  if (taskStatusResponse.status !== 200 || !taskStatusBody.ok) {
    throw new Error('Task status mutation failed');
  }

  const billingRecordRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-record`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: 'verify_t3_cycle_6_local', note: 'activate billing before first charge' })
  });
  const billingRecordResponse = await billingRecordRoute.POST(billingRecordRequest, { params: Promise.resolve({ leadId }) });
  const billingRecordBody = await billingRecordResponse.json();
  if (billingRecordResponse.status !== 201 || !billingRecordBody.ok || !billingRecordBody.billingRecord?.billingRecordId) {
    throw new Error(`Billing record creation failed: status=${billingRecordResponse.status}`);
  }

  const chargeCreateRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: 'verify_t3_cycle_6_local', note: 'create first local recurring charge' })
  });
  const chargeCreateResponse = await billingChargeRoute.POST(chargeCreateRequest, { params: Promise.resolve({ leadId }) });
  const chargeCreateBody = await chargeCreateResponse.json();
  if (chargeCreateResponse.status !== 201 || !chargeCreateBody.ok || !chargeCreateBody.charge?.chargeId) {
    throw new Error(`Charge creation failed after active billing record: status=${chargeCreateResponse.status}`);
  }

  const db = new DatabaseSync(dbPath);
  const billingRecordRow = db.prepare(`SELECT billing_record_id, lead_id, status, currency, entry_fee_cents, monthly_fee_cents, minimum_commitment_months, activated_at, created_at FROM lead_billing_records WHERE lead_id = ? LIMIT 1`).get(leadId);
  const chargeRow = db.prepare(`SELECT charge_id, billing_record_id, lead_id, charge_sequence, charge_kind, status, currency, amount_cents, due_date, posted_at, created_at FROM lead_billing_charges WHERE lead_id = ? LIMIT 1`).get(leadId);
  const chargeEventRows = db.prepare(`SELECT charge_event_id, charge_id, billing_record_id, lead_id, event_type, occurred_at, actor, note FROM lead_billing_charge_events WHERE lead_id = ? ORDER BY occurred_at DESC, charge_event_id DESC LIMIT 20`).all(leadId);
  if (!billingRecordRow) {
    throw new Error('Billing record row not found');
  }
  if (!chargeRow) {
    throw new Error('Charge row not found');
  }
  if (billingRecordRow.status !== 'active_local') {
    throw new Error(`Unexpected billing record status: ${billingRecordRow.status}`);
  }
  if (chargeRow.charge_sequence !== 1 || chargeRow.charge_kind !== 'monthly_recurring' || chargeRow.status !== 'pending_local') {
    throw new Error(`Unexpected charge shape: ${JSON.stringify(chargeRow)}`);
  }
  if (chargeRow.amount_cents !== billingRecordRow.monthly_fee_cents) {
    throw new Error('Charge amount does not match active billing monthly fee');
  }
  const chargeEventTypes = chargeEventRows.map((row) => row.event_type);
  if (!chargeEventTypes.includes('charge_created') || !chargeEventTypes.includes('charge_posted')) {
    throw new Error(`Missing expected charge events: ${chargeEventTypes.join(', ')}`);
  }

  const routeValues = Object.values(appRoutes);
  const surfaceCheck = {
    appRoutesManifestPath,
    cockpitRoutePresent: routeValues.includes('/cockpit/leads'),
    leadDetailRoutePresent: routeValues.includes('/cockpit/leads/[leadId]'),
    billingRecordRoutePresent: routeValues.includes('/api/cockpit/leads/[leadId]/billing-record'),
    billingChargesRoutePresent: routeValues.includes('/api/cockpit/leads/[leadId]/billing-charges'),
    cockpitLinksToDetail: cockpitSource.includes('href={`/cockpit/leads/${lead.leadId}`}'),
    leadDetailUsesChargeReadPath: detailSource.includes('listLeadBillingCharges(lead.leadId, 20)'),
    leadDetailUsesChargeEventReadPath: detailSource.includes('listLeadBillingChargeEvents(lead.leadId, 20)'),
    leadDetailRendersChargeSection: detailSource.includes('Billing charge T3 cycle 6') && detailSource.includes('Charge events persistidos:'),
    leadDetailHasChargeCreateForm: detailSource.includes('action={`/api/cockpit/leads/${lead.leadId}/billing-charges`}'),
    leadDetailRendersChargeCanonicalArtifact: detailSource.includes('localBillingChargeModel.canonicalArtifact')
  };

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadId,
    taskId,
    billingRecordId: billingRecordBody.billingRecord.billingRecordId,
    chargeId: chargeCreateBody.charge.chargeId,
    intakeRouteStatus: intakeResponse.status,
    blockedChargeRouteStatus: blockedChargeResponse.status,
    taskCreateRouteStatus: taskCreateResponse.status,
    stageRouteStatus: stageResponse.status,
    taskStatusRouteStatus: taskStatusResponse.status,
    billingRecordRouteStatus: billingRecordResponse.status,
    chargeCreateRouteStatus: chargeCreateResponse.status,
    intakeResponse: intakeBody,
    blockedChargeResponse: blockedChargeBody,
    taskCreateResponse: taskCreateBody,
    stageResponse: stageBody,
    taskStatusResponse: taskStatusBody,
    billingRecordResponse: billingRecordBody,
    chargeCreateResponse: chargeCreateBody,
    surfaceCheck,
    dbInspection: {
      dbPath,
      billingRecordRow,
      chargeRow,
      chargeEventRows
    },
    note: 'HTTP bind is blocked in this sandbox (listen EPERM); verification executed by invoking compiled app route handlers directly.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'local-route-intake.json'), `${JSON.stringify(intakeBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-charge-blocked.json'), `${JSON.stringify(blockedChargeBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-task-create.json'), `${JSON.stringify(taskCreateBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-stage-mutation.json'), `${JSON.stringify(stageBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-task-status.json'), `${JSON.stringify(taskStatusBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-billing-record-created.json'), `${JSON.stringify(billingRecordBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-charge-created.json'), `${JSON.stringify(chargeCreateBody, null, 2)}\n`);
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
