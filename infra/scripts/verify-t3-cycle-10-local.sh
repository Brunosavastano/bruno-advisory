#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3-cycle-10}"
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
  const billingPageSourcePath = path.join(webDir, 'app', 'cockpit', 'billing', 'page.tsx');
  const leadsPageSourcePath = path.join(webDir, 'app', 'cockpit', 'leads', 'page.tsx');
  const leadDetailSourcePath = path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'page.tsx');
  const dbPath = path.join(root, 'data', 'dev', 'bruno-advisory-dev.sqlite3');
  const appRoutes = JSON.parse(fs.readFileSync(appRoutesManifestPath, 'utf8'));
  const billingPageSource = fs.readFileSync(billingPageSourcePath, 'utf8');
  const leadsPageSource = fs.readFileSync(leadsPageSourcePath, 'utf8');
  const leadDetailSource = fs.readFileSync(leadDetailSourcePath, 'utf8');

  process.chdir(webDir);
  const intakeRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js')).routeModule.userland;
  const taskCreateRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', 'route.js')).routeModule.userland;
  const taskStatusRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', '[taskId]', 'status', 'route.js')).routeModule.userland;
  const stageRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'commercial-stage', 'route.js')).routeModule.userland;
  const billingRecordRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-record', 'route.js')).routeModule.userland;
  const billingChargeRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-charges', 'route.js')).routeModule.userland;
  const targetedSettlementRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-settlements', '[chargeId]', 'route.js')).routeModule.userland;

  async function createIntakeLead(label, fullName, phone, challenge) {
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
          primaryChallenge: challenge,
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

  const settledLeadId = await createIntakeLead(
    'verify_t3_cycle_10_settled',
    'T3 Cycle Ten Settled',
    '11988991161',
    'Quero visibilidade cruzada de billing com liquidacoes persistidas.'
  );
  const pendingLeadId = await createIntakeLead(
    'verify_t3_cycle_10_pending',
    'T3 Cycle Ten Pending',
    '11988991162',
    'Quero visibilidade cruzada de cobrancas pendentes no cockpit.'
  );

  const settledPrep = await prepareActiveBillingLead(settledLeadId, 'verify_t3_cycle_10_settled', '2026-05-01');
  const pendingPrep = await prepareActiveBillingLead(pendingLeadId, 'verify_t3_cycle_10_pending', '2026-05-02');

  const settledChargeResponse = await billingChargeRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${settledLeadId}/billing-charges`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_10_settled', note: 'create settled lead charge sequence 1' })
    }),
    { params: Promise.resolve({ leadId: settledLeadId }) }
  );
  const settledChargeBody = await settledChargeResponse.json();
  if (settledChargeResponse.status !== 201 || !settledChargeBody.charge?.chargeId) {
    throw new Error('Settled lead charge creation failed');
  }

  const settledSettlementResponse = await targetedSettlementRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${settledLeadId}/billing-settlements/${settledChargeBody.charge.chargeId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_10_settled', note: 'settle sequence 1 for overview evidence' })
    }),
    { params: Promise.resolve({ leadId: settledLeadId, chargeId: settledChargeBody.charge.chargeId }) }
  );
  const settledSettlementBody = await settledSettlementResponse.json();
  if (settledSettlementResponse.status !== 201 || !settledSettlementBody.settlement?.settlementId) {
    throw new Error('Settled lead settlement failed');
  }

  const pendingChargeResponse = await billingChargeRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${pendingLeadId}/billing-charges`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'verify_t3_cycle_10_pending', note: 'create pending overview charge sequence 1' })
    }),
    { params: Promise.resolve({ leadId: pendingLeadId }) }
  );
  const pendingChargeBody = await pendingChargeResponse.json();
  if (pendingChargeResponse.status !== 201 || !pendingChargeBody.charge?.chargeId) {
    throw new Error('Pending lead charge creation failed');
  }

  const db = new DatabaseSync(dbPath);
  const overviewRows = db.prepare(`
    SELECT
      leads.lead_id AS leadId,
      leads.full_name AS fullName,
      leads.commercial_stage AS commercialStage,
      records.status AS billingRecordStatus,
      latest_charge.charge_sequence AS latestChargeSequence,
      latest_charge.status AS latestChargeStatus,
      latest_charge.due_date AS latestChargeDueDate,
      latest_settlement.status AS latestSettlementStatus,
      latest_settlement.settled_at AS latestSettlementAt,
      COALESCE(pending_charge_totals.pendingChargeCount, 0) AS pendingChargeCount
    FROM lead_billing_records records
    INNER JOIN intake_leads leads ON leads.lead_id = records.lead_id
    LEFT JOIN lead_billing_charges latest_charge
      ON latest_charge.charge_id = (
        SELECT charges.charge_id
        FROM lead_billing_charges charges
        WHERE charges.lead_id = records.lead_id
        ORDER BY charges.charge_sequence DESC, charges.created_at DESC, charges.charge_id DESC
        LIMIT 1
      )
    LEFT JOIN lead_billing_settlements latest_settlement
      ON latest_settlement.settlement_id = (
        SELECT settlements.settlement_id
        FROM lead_billing_settlements settlements
        WHERE settlements.lead_id = records.lead_id
        ORDER BY settlements.settled_at DESC, settlements.created_at DESC, settlements.settlement_id DESC
        LIMIT 1
      )
    LEFT JOIN (
      SELECT lead_id, COUNT(*) AS pendingChargeCount
      FROM lead_billing_charges
      WHERE status = 'pending_local'
      GROUP BY lead_id
    ) pending_charge_totals
      ON pending_charge_totals.lead_id = records.lead_id
    WHERE records.lead_id IN (?, ?)
    ORDER BY leads.lead_id ASC
  `).all(settledLeadId, pendingLeadId);

  if (overviewRows.length !== 2) {
    throw new Error(`Expected 2 overview rows, got ${overviewRows.length}`);
  }

  const settledOverview = overviewRows.find((row) => row.leadId === settledLeadId);
  const pendingOverview = overviewRows.find((row) => row.leadId === pendingLeadId);
  if (!settledOverview || !pendingOverview) {
    throw new Error('Missing expected overview rows');
  }
  if (settledOverview.billingRecordStatus !== 'active_local' || settledOverview.latestChargeStatus !== 'settled_local' || !settledOverview.latestSettlementAt || settledOverview.pendingChargeCount !== 0) {
    throw new Error(`Unexpected settled overview row: ${JSON.stringify(settledOverview)}`);
  }
  if (pendingOverview.billingRecordStatus !== 'active_local' || pendingOverview.latestChargeStatus !== 'pending_local' || pendingOverview.pendingChargeCount < 1) {
    throw new Error(`Unexpected pending overview row: ${JSON.stringify(pendingOverview)}`);
  }

  const routeValues = Object.values(appRoutes);
  const surfaceCheck = {
    appRoutesManifestPath,
    billingRoutePresent: routeValues.includes('/cockpit/billing'),
    leadDetailRoutePresent: routeValues.includes('/cockpit/leads/[leadId]'),
    billingPageReadsOverviewRows: billingPageSource.includes('listLeadBillingOverviewRows'),
    billingPageShowsNoBillingYetMessage: billingPageSource.includes('localBillingOverviewModel.noBillingYetMessage'),
    billingPageLinksToLeadDetail: billingPageSource.includes('href={`/cockpit/leads/${row.leadId}`}'),
    leadsPageLinksToBillingOverview: leadsPageSource.includes('href="/cockpit/billing"'),
    leadDetailLinksToBillingOverview: leadDetailSource.includes('href="/cockpit/billing"')
  };

  if (!surfaceCheck.billingRoutePresent || !surfaceCheck.billingPageReadsOverviewRows || !surfaceCheck.billingPageLinksToLeadDetail) {
    throw new Error(`Surface check failed: ${JSON.stringify(surfaceCheck)}`);
  }

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    settledLeadId,
    pendingLeadId,
    settledTaskId: settledPrep.taskId,
    pendingTaskId: pendingPrep.taskId,
    settledBillingRecordId: settledPrep.billingRecordId,
    pendingBillingRecordId: pendingPrep.billingRecordId,
    settledChargeId: settledChargeBody.charge.chargeId,
    pendingChargeId: pendingChargeBody.charge.chargeId,
    settledSettlementId: settledSettlementBody.settlement.settlementId,
    overviewRows,
    surfaceCheck,
    note: 'HTTP bind is blocked in this sandbox (listen EPERM); verification executed by invoking compiled app route handlers directly and inspecting persisted SQLite state.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'local-route-billing-overview-settled.json'), `${JSON.stringify(settledSettlementBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-route-billing-overview-pending.json'), `${JSON.stringify(pendingChargeBody, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-db-billing-overview.json'), `${JSON.stringify(overviewRows, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'local-billing-surface-check.json'), `${JSON.stringify(surfaceCheck, null, 2)}\n`);
  fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
NODE
