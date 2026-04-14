#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3-cycle-9}"
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
  const targetedSettlementRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-settlements', '[chargeId]', 'route.js')).routeModule.userland;

  async function createIntakeLead(label, fullName, phone) {
    const response = await intakeRoute.POST(
      new Request('http://localhost/api/intake', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName,
          email: `${label}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
          phone,
          city: 'Sao Paulo',
          state: 'SP',
          investableAssetsBand: '3m_a_10m',
          primaryChallenge: 'Quero operacao recorrente local com liquidacao direcionada por chargeId.',
          sourceLabel: label,
          privacyConsentAccepted: true,
          termsConsentAccepted: true
        })
      })
    );
    const body = await response.json();
    if (response.status !== 201 || !body.leadId) {
      throw new Error(`Intake failed for ${label}: status=${response.status}`);
    }
    return body.leadId;
  }

  async function prepareActiveBillingLead(leadId, label, dueDate) {
    const taskCreateResponse = await taskCreateRoute.POST(
      new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: `Checklist ${label}`, status: 'todo', dueDate })
      }),
      { params: Promise.resolve({ leadId }) }
    );
    const taskCreateBody = await taskCreateResponse.json();
    if (taskCreateResponse.status !== 201 || !taskCreateBody.task?.taskId) {
      throw new Error(`Task create failed for ${label}`);
    }
    const taskId = taskCreateBody.task.taskId;

    const stageResponse = await stageRoute.POST(
      new Request(`http://localhost/api/cockpit/leads/${leadId}/commercial-stage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toStage: 'cliente_convertido', changedBy: label, note: `advance ${label}` })
      }),
      { params: Promise.resolve({ leadId }) }
    );
    const stageBody = await stageResponse.json();
    if (stageResponse.status !== 200 || !stageBody.ok) {
      throw new Error(`Stage change failed for ${label}`);
    }

    const taskStatusResponse = await taskStatusRoute.POST(
      new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks/${taskId}/status`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toStatus: 'done', changedBy: label })
      }),
      { params: Promise.resolve({ leadId, taskId }) }
    );
    const taskStatusBody = await taskStatusResponse.json();
    if (taskStatusResponse.status !== 200 || !taskStatusBody.ok) {
      throw new Error(`Task status failed for ${label}`);
    }

    const billingRecordResponse = await billingRecordRoute.POST(
      new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-record`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actor: label, note: `activate billing for ${label}` })
      }),
      { params: Promise.resolve({ leadId }) }
    );
    const billingRecordBody = await billingRecordResponse.json();
    if (billingRecordResponse.status !== 201 || !billingRecordBody.billingRecord?.billingRecordId) {
      throw new Error(`Billing record failed for ${label}`);
    }

    return { taskId, billingRecordId: billingRecordBody.billingRecord.billingRecordId };
  }

  const primaryLeadId = await createIntakeLead('verify_t3_cycle_9_primary', 'T3 Cycle Nine Primary', '11988991159');
  const noBillingChargeId = '00000000-0000-0000-0000-000000000009';
  const blockedNoBillingResponse = await targetedSettlementRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${primaryLeadId}/billing-settlements/${noBillingChargeId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_9_local', note: 'should fail before active billing exists' })
    }),
    { params: Promise.resolve({ leadId: primaryLeadId, chargeId: noBillingChargeId }) }
  );
  const blockedNoBillingBody = await blockedNoBillingResponse.json();
  if (blockedNoBillingResponse.status !== 422 || blockedNoBillingBody.code !== 'ACTIVE_BILLING_RECORD_REQUIRED') {
    throw new Error(`Expected ACTIVE_BILLING_RECORD_REQUIRED before billing: status=${blockedNoBillingResponse.status}`);
  }

  const primaryPrep = await prepareActiveBillingLead(primaryLeadId, 'verify_t3_cycle_9_local', '2026-04-29');

  const missingChargeId = '00000000-0000-0000-0000-000000000010';
  const blockedMissingChargeResponse = await targetedSettlementRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${primaryLeadId}/billing-settlements/${missingChargeId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_9_local', note: 'missing charge should fail' })
    }),
    { params: Promise.resolve({ leadId: primaryLeadId, chargeId: missingChargeId }) }
  );
  const blockedMissingChargeBody = await blockedMissingChargeResponse.json();
  if (blockedMissingChargeResponse.status !== 404 || blockedMissingChargeBody.code !== 'CHARGE_NOT_FOUND') {
    throw new Error(`Expected CHARGE_NOT_FOUND after billing exists: status=${blockedMissingChargeResponse.status}`);
  }

  const foreignLeadId = await createIntakeLead('verify_t3_cycle_9_foreign', 'T3 Cycle Nine Foreign', '11988991160');
  await prepareActiveBillingLead(foreignLeadId, 'verify_t3_cycle_9_foreign', '2026-04-30');
  const foreignChargeResponse = await billingChargeRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${foreignLeadId}/billing-charges`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_9_foreign', note: 'create foreign charge for ownership check' })
    }),
    { params: Promise.resolve({ leadId: foreignLeadId }) }
  );
  const foreignChargeBody = await foreignChargeResponse.json();
  if (foreignChargeResponse.status !== 201 || !foreignChargeBody.charge?.chargeId) {
    throw new Error('Foreign lead charge creation failed');
  }
  const foreignChargeId = foreignChargeBody.charge.chargeId;

  const blockedForeignChargeResponse = await targetedSettlementRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${primaryLeadId}/billing-settlements/${foreignChargeId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_9_local', note: 'foreign charge should fail ownership check' })
    }),
    { params: Promise.resolve({ leadId: primaryLeadId, chargeId: foreignChargeId }) }
  );
  const blockedForeignChargeBody = await blockedForeignChargeResponse.json();
  if (blockedForeignChargeResponse.status !== 422 || blockedForeignChargeBody.code !== 'CHARGE_NOT_OWNED_BY_LEAD') {
    throw new Error(`Expected CHARGE_NOT_OWNED_BY_LEAD for foreign charge: status=${blockedForeignChargeResponse.status}`);
  }

  const primaryChargeOneResponse = await billingChargeRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${primaryLeadId}/billing-charges`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_9_local', note: 'create primary charge sequence 1' })
    }),
    { params: Promise.resolve({ leadId: primaryLeadId }) }
  );
  const primaryChargeOneBody = await primaryChargeOneResponse.json();
  if (primaryChargeOneResponse.status !== 201 || !primaryChargeOneBody.charge?.chargeId) {
    throw new Error('Primary charge one creation failed');
  }
  const chargeOneId = primaryChargeOneBody.charge.chargeId;

  const chargeOneSettlementResponse = await targetedSettlementRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${primaryLeadId}/billing-settlements/${chargeOneId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_9_local', note: 'settle charge sequence 1 with explicit chargeId' })
    }),
    { params: Promise.resolve({ leadId: primaryLeadId, chargeId: chargeOneId }) }
  );
  const chargeOneSettlementBody = await chargeOneSettlementResponse.json();
  if (chargeOneSettlementResponse.status !== 201 || !chargeOneSettlementBody.settlement?.settlementId) {
    throw new Error('Charge one targeted settlement failed');
  }

  const blockedSettledChargeResponse = await targetedSettlementRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${primaryLeadId}/billing-settlements/${chargeOneId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_9_local', note: 'already settled charge should fail' })
    }),
    { params: Promise.resolve({ leadId: primaryLeadId, chargeId: chargeOneId }) }
  );
  const blockedSettledChargeBody = await blockedSettledChargeResponse.json();
  if (blockedSettledChargeResponse.status !== 409 || blockedSettledChargeBody.code !== 'CHARGE_ALREADY_SETTLED') {
    throw new Error(`Expected CHARGE_ALREADY_SETTLED for charge one: status=${blockedSettledChargeResponse.status}`);
  }

  const progressionResponse = await billingChargeNextRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${primaryLeadId}/billing-charges/next`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_9_local', note: 'progress to sequence 2 before targeted settlement' })
    }),
    { params: Promise.resolve({ leadId: primaryLeadId }) }
  );
  const progressionBody = await progressionResponse.json();
  if (progressionResponse.status !== 201 || !progressionBody.charge?.chargeId || progressionBody.charge.chargeSequence !== 2) {
    throw new Error('Progression to charge sequence 2 failed');
  }
  const chargeTwoId = progressionBody.charge.chargeId;

  const targetedChargeTwoSettlementResponse = await targetedSettlementRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${primaryLeadId}/billing-settlements/${chargeTwoId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_9_local', note: 'settle targeted pending sequence 2 charge' })
    }),
    { params: Promise.resolve({ leadId: primaryLeadId, chargeId: chargeTwoId }) }
  );
  const targetedChargeTwoSettlementBody = await targetedChargeTwoSettlementResponse.json();
  if (targetedChargeTwoSettlementResponse.status !== 201 || !targetedChargeTwoSettlementBody.settlement?.settlementId) {
    throw new Error('Targeted settlement for charge sequence 2 failed');
  }

  const db = new DatabaseSync(dbPath);
  const primaryBillingRecordRow = db.prepare(`SELECT billing_record_id, lead_id, status, currency, entry_fee_cents, monthly_fee_cents, minimum_commitment_months, activated_at, created_at FROM lead_billing_records WHERE lead_id = ? LIMIT 1`).get(primaryLeadId);
  const primaryChargeRows = db.prepare(`SELECT charge_id, billing_record_id, lead_id, charge_sequence, charge_kind, status, currency, amount_cents, due_date, posted_at, created_at FROM lead_billing_charges WHERE lead_id = ? ORDER BY charge_sequence ASC, created_at ASC`).all(primaryLeadId);
  const chargeTwoSettlementRow = db.prepare(`SELECT settlement_id, charge_id, billing_record_id, lead_id, status, settlement_kind, currency, amount_cents, settled_at, created_at FROM lead_billing_settlements WHERE charge_id = ? LIMIT 1`).get(chargeTwoId);
  const chargeTwoSettlementEventRows = db.prepare(`SELECT settlement_event_id, settlement_id, charge_id, billing_record_id, lead_id, event_type, occurred_at, actor, note FROM lead_billing_settlement_events WHERE charge_id = ? ORDER BY occurred_at DESC, settlement_event_id DESC LIMIT 20`).all(chargeTwoId);
  const primaryChargeEventRows = db.prepare(`SELECT charge_event_id, charge_id, billing_record_id, lead_id, event_type, occurred_at, actor, note FROM lead_billing_charge_events WHERE lead_id = ? ORDER BY occurred_at DESC, charge_event_id DESC LIMIT 50`).all(primaryLeadId);

  if (!primaryBillingRecordRow || primaryChargeRows.length !== 2 || !chargeTwoSettlementRow) {
    throw new Error('Expected primary billing row, two charges, and a charge-two settlement row');
  }
  const [primaryChargeOneRow, primaryChargeTwoRow] = primaryChargeRows;
  if (primaryChargeOneRow.charge_id !== chargeOneId || primaryChargeOneRow.status !== 'settled_local') {
    throw new Error(`Unexpected primary charge one row: ${JSON.stringify(primaryChargeOneRow)}`);
  }
  if (primaryChargeTwoRow.charge_id !== chargeTwoId || primaryChargeTwoRow.status !== 'settled_local') {
    throw new Error(`Unexpected primary charge two row: ${JSON.stringify(primaryChargeTwoRow)}`);
  }
  if (chargeTwoSettlementRow.charge_id !== chargeTwoId || chargeTwoSettlementRow.lead_id !== primaryLeadId) {
    throw new Error('Charge two settlement row is not linked to the intended chargeId and leadId');
  }
  const chargeTwoSettlementEventTypes = chargeTwoSettlementEventRows.map((row) => row.event_type);
  if (!chargeTwoSettlementEventTypes.includes('settlement_recorded') || !chargeTwoSettlementEventTypes.includes('charge_settled')) {
    throw new Error(`Missing targeted settlement event trail for charge two: ${chargeTwoSettlementEventTypes.join(', ')}`);
  }
  const chargeTwoChargeEventTypes = primaryChargeEventRows.filter((row) => row.charge_id === chargeTwoId).map((row) => row.event_type);
  if (!chargeTwoChargeEventTypes.includes('charge_settled')) {
    throw new Error(`Missing charge_settled event for charge two: ${chargeTwoChargeEventTypes.join(', ')}`);
  }

  const routeValues = Object.values(appRoutes);
  const surfaceCheck = {
    appRoutesManifestPath,
    leadDetailRoutePresent: routeValues.includes('/cockpit/leads/[leadId]'),
    targetedSettlementRoutePresent: routeValues.includes('/api/cockpit/leads/[leadId]/billing-settlements/[chargeId]'),
    leadDetailHasTargetedSettlementForm: detailSource.includes('action={`/api/cockpit/leads/${lead.leadId}/billing-settlements/${charge.chargeId}`}'),
    leadDetailRendersTargetedSettlementCanon: detailSource.includes('localBillingSettlementTargetingModel.canonicalArtifact'),
    leadDetailRendersChargeLevelAction: detailSource.includes('Liquidar chargeId {charge.chargeId}')
  };

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    primaryLeadId,
    foreignLeadId,
    primaryTaskId: primaryPrep.taskId,
    primaryBillingRecordId: primaryPrep.billingRecordId,
    foreignChargeId,
    chargeOneId,
    chargeTwoId,
    chargeTwoSettlementId: targetedChargeTwoSettlementBody.settlement.settlementId,
    blockedNoBillingStatus: blockedNoBillingResponse.status,
    blockedMissingChargeStatus: blockedMissingChargeResponse.status,
    blockedForeignChargeStatus: blockedForeignChargeResponse.status,
    blockedSettledChargeStatus: blockedSettledChargeResponse.status,
    targetedChargeTwoSettlementStatus: targetedChargeTwoSettlementResponse.status,
    blockedNoBillingResponse: blockedNoBillingBody,
    blockedMissingChargeResponse: blockedMissingChargeBody,
    blockedForeignChargeResponse: blockedForeignChargeBody,
    chargeOneSettlementResponse: chargeOneSettlementBody,
    blockedSettledChargeResponse: blockedSettledChargeBody,
    progressionResponse: progressionBody,
    targetedChargeTwoSettlementResponse: targetedChargeTwoSettlementBody,
    surfaceCheck,
    dbInspection: {
      dbPath,
      primaryBillingRecordRow,
      primaryChargeRows,
      chargeTwoSettlementRow,
      chargeTwoSettlementEventRows,
      primaryChargeEventRows
    },
    note: 'HTTP bind is blocked in this sandbox (listen EPERM); verification executed by invoking compiled app route handlers directly.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'local-route-targeted-settlement-blocked-no-billing.json'), `${JSON.stringify(blockedNoBillingBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-targeted-settlement-blocked-missing-charge.json'), `${JSON.stringify(blockedMissingChargeBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-targeted-settlement-blocked-foreign-charge.json'), `${JSON.stringify(blockedForeignChargeBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-targeted-settlement-charge-one.json'), `${JSON.stringify(chargeOneSettlementBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-targeted-settlement-blocked-settled-charge.json'), `${JSON.stringify(blockedSettledChargeBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-targeted-settlement-charge-two.json'), `${JSON.stringify(targetedChargeTwoSettlementBody, null, 2)}\n`);
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
