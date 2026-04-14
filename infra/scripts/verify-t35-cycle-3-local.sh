#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3.5-cycle-3}"
mkdir -p "$EVIDENCE_DIR"

if [ -f "apps/web/app/api/cockpit/leads/[leadId]/billing-settlements/route.ts" ]; then
  echo "legacy settlement route still exists" >&2
  exit 1
fi

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  npm run build >/dev/null
fi

node - "$ROOT" "$EVIDENCE_DIR" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const root = process.argv[2];
  const evidenceDir = path.resolve(root, process.argv[3]);
  const webDir = path.join(root, 'apps', 'web');
  const appRoutesManifestPath = path.join(webDir, '.next', 'app-path-routes-manifest.json');
  const appRoutes = JSON.parse(fs.readFileSync(appRoutesManifestPath, 'utf8'));
  const routeValues = Object.values(appRoutes);
  const leadDetailSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'page.tsx'), 'utf8');

  process.chdir(webDir);
  const intakeRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js')).routeModule.userland;
  const taskCreateRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', 'route.js')).routeModule.userland;
  const taskStatusRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', '[taskId]', 'status', 'route.js')).routeModule.userland;
  const stageRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'commercial-stage', 'route.js')).routeModule.userland;
  const billingRecordRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-record', 'route.js')).routeModule.userland;
  const billingChargeRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-charges', 'route.js')).routeModule.userland;
  const targetedSettlementRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-settlements', '[chargeId]', 'route.js')).routeModule.userland;

  async function json(res) { return { status: res.status, body: await res.json() }; }

  const intakeCreate = await json(await intakeRoute.POST(new Request('http://localhost/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'T3.5 Cycle 3 Verify',
      email: `t35-cycle3-${Date.now()}@example.com`,
      phone: '11988991172',
      city: 'Brasilia',
      state: 'DF',
      investableAssetsBand: '3m_a_10m',
      primaryChallenge: 'Remover settlement implicito por lead.',
      sourceLabel: 'verify_t35_cycle_3',
      privacyConsentAccepted: true,
      termsConsentAccepted: true
    })
  })));
  if (intakeCreate.status !== 201 || !intakeCreate.body.leadId) throw new Error('Intake failed');
  const leadId = intakeCreate.body.leadId;

  const taskCreate = await json(await taskCreateRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Checklist T3.5 C3', status: 'todo', dueDate: '2026-05-01' })
  }), { params: Promise.resolve({ leadId }) }));
  if (taskCreate.status !== 201 || !taskCreate.body.task?.taskId) throw new Error('Task create failed');
  const taskId = taskCreate.body.task.taskId;

  const taskDone = await json(await taskStatusRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks/${taskId}/status`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ toStatus: 'done', changedBy: 'verify_t35_cycle_3' })
  }), { params: Promise.resolve({ leadId, taskId }) }));
  if (taskDone.status !== 200 || !taskDone.body.ok) throw new Error('Task status failed');

  const stageChange = await json(await stageRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/commercial-stage`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ toStage: 'cliente_convertido', changedBy: 'verify_t35_cycle_3' })
  }), { params: Promise.resolve({ leadId }) }));
  if (stageChange.status !== 200 || !stageChange.body.ok) throw new Error('Stage change failed');

  const billingRecord = await json(await billingRecordRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-record`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actor: 'verify_t35_cycle_3' })
  }), { params: Promise.resolve({ leadId }) }));
  if (billingRecord.status !== 201 || !billingRecord.body.billingRecord?.billingRecordId) throw new Error('Billing record failed');

  const billingCharge = await json(await billingChargeRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actor: 'verify_t35_cycle_3' })
  }), { params: Promise.resolve({ leadId }) }));
  if (billingCharge.status !== 201 || !billingCharge.body.charge?.chargeId) throw new Error('Billing charge failed');
  const chargeId = billingCharge.body.charge.chargeId;

  const targetedSettlement = await json(await targetedSettlementRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-settlements/${chargeId}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actor: 'verify_t35_cycle_3', note: 'targeted settlement still works' })
  }), { params: Promise.resolve({ leadId, chargeId }) }));
  if (targetedSettlement.status !== 201 || !targetedSettlement.body.settlement?.settlementId) throw new Error('Targeted settlement failed');

  const routeChecks = {
    legacyRouteFilePresent: fs.existsSync(path.join(webDir, 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-settlements', 'route.ts')),
    manifestHasTargetedRoute: routeValues.includes('/api/cockpit/leads/[leadId]/billing-settlements/[chargeId]'),
    manifestHasLegacyRoute: routeValues.includes('/api/cockpit/leads/[leadId]/billing-settlements'),
    leadDetailUsesTargetedAction: leadDetailSource.includes('billing-settlements/${charge.chargeId}') || leadDetailSource.includes('billing-settlements/${eligibleChargeForSettlement.chargeId}')
  };

  if (routeChecks.legacyRouteFilePresent) throw new Error('Legacy route file still present');
  if (!routeChecks.manifestHasTargetedRoute) throw new Error('Targeted route missing from manifest');
  if (routeChecks.manifestHasLegacyRoute) throw new Error('Legacy route still present in manifest');
  if (!routeChecks.leadDetailUsesTargetedAction) throw new Error('Lead detail still does not use targeted settlement action');

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    note: 'HTTP bind is blocked in this sandbox (listen EPERM); verification executed by invoking compiled Next route handlers directly after next build.',
    removedLegacyRoute: true,
    leadId,
    chargeId,
    settlementId: targetedSettlement.body.settlement.settlementId,
    routeChecks,
    responses: {
      intakeCreate,
      taskCreate,
      taskDone,
      stageChange,
      billingRecord,
      billingCharge,
      targetedSettlement
    }
  };

  fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
NODE
