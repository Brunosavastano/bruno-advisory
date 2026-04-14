#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3-cycle-8}"
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
  const billingChargeNextRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-charges', 'next', 'route.js')).routeModule.userland;
  const billingSettlementRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-settlements', 'route.js')).routeModule.userland;

  const testEmail = `t3-cycle-8-local-${Date.now()}@example.com`;
  const intakeResponse = await intakeRoute.POST(
    new Request('http://localhost/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: 'T3 Cycle Eight Local',
        email: testEmail,
        phone: '11988991158',
        city: 'Sao Paulo',
        state: 'SP',
        investableAssetsBand: '3m_a_10m',
        primaryChallenge: 'Quero ver a progressao recorrente sair da sequencia 1 liquidada para a sequencia 2 pendente.',
        sourceLabel: 'verify_t3_cycle_8_local',
        privacyConsentAccepted: true,
        termsConsentAccepted: true
      })
    })
  );
  const intakeBody = await intakeResponse.json();
  if (intakeResponse.status !== 201 || !intakeBody.leadId) {
    throw new Error(`Intake route invocation failed: status=${intakeResponse.status}`);
  }
  const leadId = intakeBody.leadId;

  const blockedBeforeBillingResponse = await billingChargeNextRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges/next`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_8_local', note: 'should fail before active billing exists' })
    }),
    { params: Promise.resolve({ leadId }) }
  );
  const blockedBeforeBillingBody = await blockedBeforeBillingResponse.json();
  if (blockedBeforeBillingResponse.status !== 422 || blockedBeforeBillingBody.code !== 'ACTIVE_BILLING_RECORD_REQUIRED') {
    throw new Error(`Expected ACTIVE_BILLING_RECORD_REQUIRED before billing: status=${blockedBeforeBillingResponse.status}`);
  }

  const taskCreateResponse = await taskCreateRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'Checklist final para progressao da segunda cobranca local', status: 'todo', dueDate: '2026-04-28' })
    }),
    { params: Promise.resolve({ leadId }) }
  );
  const taskCreateBody = await taskCreateResponse.json();
  if (taskCreateResponse.status !== 201 || !taskCreateBody.task?.taskId) {
    throw new Error('Task creation failed');
  }
  const taskId = taskCreateBody.task.taskId;

  const stageResponse = await stageRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/commercial-stage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ toStage: 'cliente_convertido', changedBy: 'verify_t3_cycle_8_local', note: 'advance to recurring progression' })
    }),
    { params: Promise.resolve({ leadId }) }
  );
  const stageBody = await stageResponse.json();
  if (stageResponse.status !== 200 || !stageBody.ok) {
    throw new Error('Commercial stage mutation failed');
  }

  const taskStatusResponse = await taskStatusRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks/${taskId}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ toStatus: 'done', changedBy: 'verify_t3_cycle_8_local' })
    }),
    { params: Promise.resolve({ leadId, taskId }) }
  );
  const taskStatusBody = await taskStatusResponse.json();
  if (taskStatusResponse.status !== 200 || !taskStatusBody.ok) {
    throw new Error('Task status mutation failed');
  }

  const billingRecordResponse = await billingRecordRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-record`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_8_local', note: 'activate billing before progression' })
    }),
    { params: Promise.resolve({ leadId }) }
  );
  const billingRecordBody = await billingRecordResponse.json();
  if (billingRecordResponse.status !== 201 || !billingRecordBody.billingRecord?.billingRecordId) {
    throw new Error('Billing record creation failed');
  }

  const blockedBeforeSettledResponse = await billingChargeNextRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges/next`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_8_local', note: 'should fail before any settled prior charge exists' })
    }),
    { params: Promise.resolve({ leadId }) }
  );
  const blockedBeforeSettledBody = await blockedBeforeSettledResponse.json();
  if (blockedBeforeSettledResponse.status !== 422 || blockedBeforeSettledBody.code !== 'SETTLED_PRIOR_CHARGE_REQUIRED') {
    throw new Error(`Expected SETTLED_PRIOR_CHARGE_REQUIRED before settled prior charge: status=${blockedBeforeSettledResponse.status}`);
  }

  const chargeOneResponse = await billingChargeRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_8_local', note: 'create first local recurring charge' })
    }),
    { params: Promise.resolve({ leadId }) }
  );
  const chargeOneBody = await chargeOneResponse.json();
  if (chargeOneResponse.status !== 201 || !chargeOneBody.charge?.chargeId) {
    throw new Error('First charge creation failed');
  }

  const blockedWhilePendingResponse = await billingChargeNextRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges/next`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_8_local', note: 'should fail while charge one is still pending' })
    }),
    { params: Promise.resolve({ leadId }) }
  );
  const blockedWhilePendingBody = await blockedWhilePendingResponse.json();
  if (blockedWhilePendingResponse.status !== 422 || blockedWhilePendingBody.code !== 'PENDING_RECURRING_CHARGE_EXISTS') {
    throw new Error(`Expected PENDING_RECURRING_CHARGE_EXISTS while latest charge is pending: status=${blockedWhilePendingResponse.status}`);
  }

  const settlementResponse = await billingSettlementRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-settlements`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_8_local', note: 'settle first recurring charge before progression' })
    }),
    { params: Promise.resolve({ leadId }) }
  );
  const settlementBody = await settlementResponse.json();
  if (settlementResponse.status !== 201 || !settlementBody.settlement?.settlementId) {
    throw new Error('Settlement creation failed');
  }

  const progressionResponse = await billingChargeNextRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges/next`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_8_local', note: 'progress to recurring charge sequence 2' })
    }),
    { params: Promise.resolve({ leadId }) }
  );
  const progressionBody = await progressionResponse.json();
  if (progressionResponse.status !== 201 || !progressionBody.charge?.chargeId || progressionBody.charge.chargeSequence !== 2) {
    throw new Error(`Recurring progression failed: status=${progressionResponse.status}`);
  }

  const blockedDuplicateProgressionResponse = await billingChargeNextRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges/next`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_8_local', note: 'should fail while charge two is pending' })
    }),
    { params: Promise.resolve({ leadId }) }
  );
  const blockedDuplicateProgressionBody = await blockedDuplicateProgressionResponse.json();
  if (blockedDuplicateProgressionResponse.status !== 422 || blockedDuplicateProgressionBody.code !== 'PENDING_RECURRING_CHARGE_EXISTS') {
    throw new Error(`Expected duplicate progression to fail while sequence 2 is pending: status=${blockedDuplicateProgressionResponse.status}`);
  }

  const db = new DatabaseSync(dbPath);
  const billingRecordRow = db.prepare(`SELECT billing_record_id, lead_id, status, currency, entry_fee_cents, monthly_fee_cents, minimum_commitment_months, activated_at, created_at FROM lead_billing_records WHERE lead_id = ? LIMIT 1`).get(leadId);
  const chargeRows = db.prepare(`SELECT charge_id, billing_record_id, lead_id, charge_sequence, charge_kind, status, currency, amount_cents, due_date, posted_at, created_at FROM lead_billing_charges WHERE lead_id = ? ORDER BY charge_sequence ASC, created_at ASC`).all(leadId);
  const chargeEventRows = db.prepare(`SELECT charge_event_id, charge_id, billing_record_id, lead_id, event_type, occurred_at, actor, note FROM lead_billing_charge_events WHERE lead_id = ? ORDER BY occurred_at DESC, charge_event_id DESC LIMIT 50`).all(leadId);
  if (!billingRecordRow || chargeRows.length !== 2) {
    throw new Error('Expected active billing row and two recurring charges');
  }
  const [chargeOneRow, chargeTwoRow] = chargeRows;
  if (chargeOneRow.charge_sequence !== 1 || chargeOneRow.status !== 'settled_local') {
    throw new Error(`Unexpected charge one state: ${JSON.stringify(chargeOneRow)}`);
  }
  if (chargeTwoRow.charge_sequence !== 2 || chargeTwoRow.status !== 'pending_local') {
    throw new Error(`Unexpected charge two state: ${JSON.stringify(chargeTwoRow)}`);
  }
  if (chargeTwoRow.amount_cents !== billingRecordRow.monthly_fee_cents) {
    throw new Error('Charge two amount does not match monthly fee');
  }
  const chargeTwoEvents = chargeEventRows.filter((row) => row.charge_id === chargeTwoRow.charge_id).map((row) => row.event_type);
  if (!chargeTwoEvents.includes('charge_created') || !chargeTwoEvents.includes('charge_posted')) {
    throw new Error(`Missing expected sequence 2 event trail: ${chargeTwoEvents.join(', ')}`);
  }

  const routeValues = Object.values(appRoutes);
  const surfaceCheck = {
    appRoutesManifestPath,
    leadDetailRoutePresent: routeValues.includes('/cockpit/leads/[leadId]'),
    billingChargeNextRoutePresent: routeValues.includes('/api/cockpit/leads/[leadId]/billing-charges/next'),
    leadDetailUsesChargeReadPath: detailSource.includes('listLeadBillingCharges(lead.leadId, 20)') && detailSource.includes('latestBillingCharge = billingCharges[0] ?? null'),
    leadDetailRendersMultipleCharges: detailSource.includes('billingCharges.map((charge) =>') && detailSource.includes('chargeSequence'),
    leadDetailHasProgressionForm: detailSource.includes('action={`/api/cockpit/leads/${lead.leadId}/billing-charges/next`}'),
    leadDetailRendersProgressionCanon: detailSource.includes('localBillingChargeProgressionModel.canonicalArtifact')
  };

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadId,
    taskId,
    billingRecordId: billingRecordBody.billingRecord.billingRecordId,
    chargeOneId: chargeOneBody.charge.chargeId,
    chargeTwoId: progressionBody.charge.chargeId,
    intakeRouteStatus: intakeResponse.status,
    blockedBeforeBillingStatus: blockedBeforeBillingResponse.status,
    blockedBeforeSettledStatus: blockedBeforeSettledResponse.status,
    chargeOneCreateStatus: chargeOneResponse.status,
    blockedWhilePendingStatus: blockedWhilePendingResponse.status,
    settlementStatus: settlementResponse.status,
    progressionStatus: progressionResponse.status,
    blockedDuplicateProgressionStatus: blockedDuplicateProgressionResponse.status,
    blockedBeforeBillingResponse: blockedBeforeBillingBody,
    blockedBeforeSettledResponse: blockedBeforeSettledBody,
    chargeOneCreateResponse: chargeOneBody,
    blockedWhilePendingResponse: blockedWhilePendingBody,
    settlementResponse: settlementBody,
    progressionResponse: progressionBody,
    blockedDuplicateProgressionResponse: blockedDuplicateProgressionBody,
    surfaceCheck,
    dbInspection: {
      dbPath,
      billingRecordRow,
      chargeRows,
      chargeEventRows
    },
    note: 'HTTP bind is blocked in this sandbox (listen EPERM); verification executed by invoking compiled app route handlers directly.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'local-route-progression-blocked-before-billing.json'), `${JSON.stringify(blockedBeforeBillingBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-progression-blocked-before-settled.json'), `${JSON.stringify(blockedBeforeSettledBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-charge-one-created.json'), `${JSON.stringify(chargeOneBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-progression-blocked-while-pending.json'), `${JSON.stringify(blockedWhilePendingBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-charge-one-settled.json'), `${JSON.stringify(settlementBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-charge-two-created.json'), `${JSON.stringify(progressionBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-progression-blocked-after-sequence-two.json'), `${JSON.stringify(blockedDuplicateProgressionBody, null, 2)}\n`);
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
