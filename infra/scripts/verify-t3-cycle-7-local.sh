#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3-cycle-7}"
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
  const detailSourcePath = path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'page.tsx');
  const dbPath = path.join(root, 'data', 'dev', 'bruno-advisory-dev.sqlite3');
  const appRoutes = JSON.parse(fs.readFileSync(appRoutesManifestPath, 'utf8'));
  const detailSource = fs.readFileSync(detailSourcePath, 'utf8');

  process.chdir(webDir);
  const intakeRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js')).routeModule.userland;
  const taskCreateRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', 'route.js')).routeModule.userland;
  const taskStatusRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', '[taskId]', 'status', 'route.js')).routeModule.userland;
  const stageRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'commercial-stage', 'route.js')).routeModule.userland;
  const billingRecordRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-record', 'route.js')).routeModule.userland;
  const billingChargeRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-charges', 'route.js')).routeModule.userland;
  const billingSettlementRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-settlements', 'route.js')).routeModule.userland;

  const testEmail = `t3-cycle-7-local-${Date.now()}@example.com`;
  const intakeRequest = new Request('http://localhost/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'T3 Cycle Seven Local',
      email: testEmail,
      phone: '11988991157',
      city: 'Sao Paulo',
      state: 'SP',
      investableAssetsBand: '3m_a_10m',
      primaryChallenge: 'Quero ver a cobranca local sair de emitida para liquidada com trilha auditavel.',
      sourceLabel: 'verify_t3_cycle_7_local',
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

  const blockedSettlementBeforeChargeRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-settlements`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: 'verify_t3_cycle_7_local', note: 'should fail before any charge exists' })
  });
  const blockedSettlementBeforeChargeResponse = await billingSettlementRoute.POST(blockedSettlementBeforeChargeRequest, { params: Promise.resolve({ leadId }) });
  const blockedSettlementBeforeChargeBody = await blockedSettlementBeforeChargeResponse.json();
  if (blockedSettlementBeforeChargeResponse.status !== 422 || blockedSettlementBeforeChargeBody.code !== 'ELIGIBLE_CHARGE_REQUIRED') {
    throw new Error(`Settlement should fail truthfully before eligible charge: status=${blockedSettlementBeforeChargeResponse.status}`);
  }

  const taskCreateRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Checklist final para liquidar a primeira cobranca local', status: 'todo', dueDate: '2026-04-27' })
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
    body: JSON.stringify({ toStage: 'cliente_convertido', changedBy: 'verify_t3_cycle_7_local', note: 'advance to local billing + settlement' })
  });
  const stageResponse = await stageRoute.POST(stageRequest, { params: Promise.resolve({ leadId }) });
  const stageBody = await stageResponse.json();
  if (stageResponse.status !== 200 || !stageBody.ok) {
    throw new Error('Commercial stage mutation failed');
  }

  const taskStatusRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks/${taskId}/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ toStatus: 'done', changedBy: 'verify_t3_cycle_7_local' })
  });
  const taskStatusResponse = await taskStatusRoute.POST(taskStatusRequest, { params: Promise.resolve({ leadId, taskId }) });
  const taskStatusBody = await taskStatusResponse.json();
  if (taskStatusResponse.status !== 200 || !taskStatusBody.ok) {
    throw new Error('Task status mutation failed');
  }

  const billingRecordRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-record`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: 'verify_t3_cycle_7_local', note: 'activate billing before charge + settlement' })
  });
  const billingRecordResponse = await billingRecordRoute.POST(billingRecordRequest, { params: Promise.resolve({ leadId }) });
  const billingRecordBody = await billingRecordResponse.json();
  if (billingRecordResponse.status !== 201 || !billingRecordBody.ok || !billingRecordBody.billingRecord?.billingRecordId) {
    throw new Error(`Billing record creation failed: status=${billingRecordResponse.status}`);
  }

  const blockedSettlementBeforeEligibleRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-settlements`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: 'verify_t3_cycle_7_local', note: 'should fail before charge exists even with billing active' })
  });
  const blockedSettlementBeforeEligibleResponse = await billingSettlementRoute.POST(blockedSettlementBeforeEligibleRequest, { params: Promise.resolve({ leadId }) });
  const blockedSettlementBeforeEligibleBody = await blockedSettlementBeforeEligibleResponse.json();
  if (blockedSettlementBeforeEligibleResponse.status !== 422 || blockedSettlementBeforeEligibleBody.code !== 'ELIGIBLE_CHARGE_REQUIRED') {
    throw new Error(`Settlement should fail truthfully before charge creation: status=${blockedSettlementBeforeEligibleResponse.status}`);
  }

  const chargeCreateRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: 'verify_t3_cycle_7_local', note: 'create first local recurring charge' })
  });
  const chargeCreateResponse = await billingChargeRoute.POST(chargeCreateRequest, { params: Promise.resolve({ leadId }) });
  const chargeCreateBody = await chargeCreateResponse.json();
  if (chargeCreateResponse.status !== 201 || !chargeCreateBody.ok || !chargeCreateBody.charge?.chargeId) {
    throw new Error(`Charge creation failed after active billing record: status=${chargeCreateResponse.status}`);
  }

  const settlementCreateRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-settlements`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: 'verify_t3_cycle_7_local', note: 'settle first local recurring charge' })
  });
  const settlementCreateResponse = await billingSettlementRoute.POST(settlementCreateRequest, { params: Promise.resolve({ leadId }) });
  const settlementCreateBody = await settlementCreateResponse.json();
  if (settlementCreateResponse.status !== 201 || !settlementCreateBody.ok || !settlementCreateBody.settlement?.settlementId) {
    throw new Error(`Settlement creation failed after eligible charge: status=${settlementCreateResponse.status}`);
  }

  const blockedDuplicateSettlementRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-settlements`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actor: 'verify_t3_cycle_7_local', note: 'should fail after settlement already exists' })
  });
  const blockedDuplicateSettlementResponse = await billingSettlementRoute.POST(blockedDuplicateSettlementRequest, { params: Promise.resolve({ leadId }) });
  const blockedDuplicateSettlementBody = await blockedDuplicateSettlementResponse.json();
  if (blockedDuplicateSettlementResponse.status !== 422 || blockedDuplicateSettlementBody.code !== 'ELIGIBLE_CHARGE_REQUIRED') {
    throw new Error(`Duplicate settlement should fail truthfully because no eligible charge remains: status=${blockedDuplicateSettlementResponse.status}`);
  }

  const db = new DatabaseSync(dbPath);
  const billingRecordRow = db.prepare(`SELECT billing_record_id, lead_id, status, currency, entry_fee_cents, monthly_fee_cents, minimum_commitment_months, activated_at, created_at FROM lead_billing_records WHERE lead_id = ? LIMIT 1`).get(leadId);
  const chargeRow = db.prepare(`SELECT charge_id, billing_record_id, lead_id, charge_sequence, charge_kind, status, currency, amount_cents, due_date, posted_at, created_at FROM lead_billing_charges WHERE lead_id = ? LIMIT 1`).get(leadId);
  const chargeEventRows = db.prepare(`SELECT charge_event_id, charge_id, billing_record_id, lead_id, event_type, occurred_at, actor, note FROM lead_billing_charge_events WHERE lead_id = ? ORDER BY occurred_at DESC, charge_event_id DESC LIMIT 20`).all(leadId);
  const settlementRow = db.prepare(`SELECT settlement_id, charge_id, billing_record_id, lead_id, status, settlement_kind, currency, amount_cents, settled_at, created_at FROM lead_billing_settlements WHERE lead_id = ? LIMIT 1`).get(leadId);
  const settlementEventRows = db.prepare(`SELECT settlement_event_id, settlement_id, charge_id, billing_record_id, lead_id, event_type, occurred_at, actor, note FROM lead_billing_settlement_events WHERE lead_id = ? ORDER BY occurred_at DESC, settlement_event_id DESC LIMIT 20`).all(leadId);
  if (!billingRecordRow || !chargeRow || !settlementRow) {
    throw new Error('Expected billing record, charge, and settlement rows to exist');
  }
  if (chargeRow.status !== 'settled_local' || settlementRow.status !== 'settled_local') {
    throw new Error(`Unexpected settled state: charge=${chargeRow.status} settlement=${settlementRow.status}`);
  }
  const chargeEventTypes = chargeEventRows.map((row) => row.event_type);
  const settlementEventTypes = settlementEventRows.map((row) => row.event_type);
  if (!chargeEventTypes.includes('charge_settled')) {
    throw new Error(`Missing charge_settled event: ${chargeEventTypes.join(', ')}`);
  }
  if (!settlementEventTypes.includes('settlement_recorded') || !settlementEventTypes.includes('charge_settled')) {
    throw new Error(`Missing settlement events: ${settlementEventTypes.join(', ')}`);
  }

  const routeValues = Object.values(appRoutes);
  const surfaceCheck = {
    appRoutesManifestPath,
    leadDetailRoutePresent: routeValues.includes('/cockpit/leads/[leadId]'),
    billingSettlementsRoutePresent: routeValues.includes('/api/cockpit/leads/[leadId]/billing-settlements'),
    leadDetailUsesSettlementReadPath: detailSource.includes('listLeadBillingSettlements(lead.leadId, 20)') && detailSource.includes('listLeadBillingSettlementEvents(lead.leadId, 20)'),
    leadDetailRendersSettlementSection: detailSource.includes('Billing settlement T3 cycle 7') && detailSource.includes('Settlement events persistidos:'),
    leadDetailHasSettlementForm: detailSource.includes('action={`/api/cockpit/leads/${lead.leadId}/billing-settlements`}'),
    leadDetailRendersSettlementCanonicalArtifact: detailSource.includes('localBillingSettlementModel.canonicalArtifact')
  };

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadId,
    taskId,
    billingRecordId: billingRecordBody.billingRecord.billingRecordId,
    chargeId: chargeCreateBody.charge.chargeId,
    settlementId: settlementCreateBody.settlement.settlementId,
    intakeRouteStatus: intakeResponse.status,
    blockedSettlementBeforeChargeStatus: blockedSettlementBeforeChargeResponse.status,
    blockedSettlementBeforeEligibleStatus: blockedSettlementBeforeEligibleResponse.status,
    billingRecordRouteStatus: billingRecordResponse.status,
    chargeCreateRouteStatus: chargeCreateResponse.status,
    settlementCreateRouteStatus: settlementCreateResponse.status,
    blockedDuplicateSettlementStatus: blockedDuplicateSettlementResponse.status,
    blockedSettlementBeforeChargeResponse: blockedSettlementBeforeChargeBody,
    blockedSettlementBeforeEligibleResponse: blockedSettlementBeforeEligibleBody,
    settlementCreateResponse: settlementCreateBody,
    blockedDuplicateSettlementResponse: blockedDuplicateSettlementBody,
    surfaceCheck,
    dbInspection: {
      dbPath,
      billingRecordRow,
      chargeRow,
      chargeEventRows,
      settlementRow,
      settlementEventRows
    },
    note: 'HTTP bind is blocked in this sandbox (listen EPERM); verification executed by invoking compiled app route handlers directly.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'local-route-settlement-blocked-before-charge.json'), `${JSON.stringify(blockedSettlementBeforeChargeBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-settlement-blocked-before-eligible-charge.json'), `${JSON.stringify(blockedSettlementBeforeEligibleBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-settlement-created.json'), `${JSON.stringify(settlementCreateBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-settlement-blocked-after-settled.json'), `${JSON.stringify(blockedDuplicateSettlementBody, null, 2)}\n`);
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
