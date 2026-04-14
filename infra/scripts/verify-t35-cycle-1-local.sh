#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3.5-cycle-1}"
mkdir -p "$EVIDENCE_DIR"

npm run build >/dev/null

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
  const storageBarrelSource = fs.readFileSync(path.join(root, 'apps', 'web', 'lib', 'intake-storage.ts'), 'utf8');

  process.chdir(webDir);
  const intakeRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js')).routeModule.userland;
  const intakeEventsRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'intake-events', 'route.js')).routeModule.userland;
  const notesRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'notes', 'route.js')).routeModule.userland;
  const tasksRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', 'route.js')).routeModule.userland;
  const taskStatusRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', '[taskId]', 'status', 'route.js')).routeModule.userland;
  const stageRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'commercial-stage', 'route.js')).routeModule.userland;
  const billingReadinessRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-readiness', 'route.js')).routeModule.userland;
  const billingRecordRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-record', 'route.js')).routeModule.userland;
  const billingChargeRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-charges', 'route.js')).routeModule.userland;
  const nextBillingChargeRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-charges', 'next', 'route.js')).routeModule.userland;
  const billingSettlementRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-settlements', 'route.js')).routeModule.userland;
  const targetedSettlementRoute = require(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'billing-settlements', '[chargeId]', 'route.js')).routeModule.userland;

  async function json(res) { return { status: res.status, body: await res.json() }; }

  const intakeCreate = await json(await intakeRoute.POST(new Request('http://localhost/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'T3.5 Cycle 1 Verify',
      email: `t35-cycle1-${Date.now()}@example.com`,
      phone: '11988991170',
      city: 'Brasilia',
      state: 'DF',
      investableAssetsBand: '3m_a_10m',
      primaryChallenge: 'Preservar rotas intactas apos split estrutural de storage.',
      sourceLabel: 'verify_t35_cycle_1',
      privacyConsentAccepted: true,
      termsConsentAccepted: true
    })
  })));
  if (intakeCreate.status !== 201 || !intakeCreate.body.leadId) throw new Error('Intake POST failed');
  const leadId = intakeCreate.body.leadId;

  const intakeEventCreate = await json(await intakeEventsRoute.POST(new Request('http://localhost/api/intake-events', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventName: 't2_landing_viewed', metadata: { source: 'verify_t35_cycle_1' } })
  })));
  if (intakeEventCreate.status !== 200 || intakeEventCreate.body.ok !== true) throw new Error('Intake events POST failed');

  const noteCreate = await json(await notesRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/notes`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ content: 'nota estrutural', authorMarker: 'verify_t35_cycle_1' })
  }), { params: Promise.resolve({ leadId }) }));
  if (noteCreate.status !== 201 || !noteCreate.body.note?.noteId) throw new Error('Notes POST failed');

  const taskCreate = await json(await tasksRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Checklist T3.5', status: 'todo', dueDate: '2026-05-01' })
  }), { params: Promise.resolve({ leadId }) }));
  if (taskCreate.status !== 201 || !taskCreate.body.task?.taskId) throw new Error('Tasks POST failed');
  const taskId = taskCreate.body.task.taskId;

  const billingReadinessBefore = await json(await billingReadinessRoute.GET(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-readiness`), { params: Promise.resolve({ leadId }) }));
  if (billingReadinessBefore.status !== 200 || billingReadinessBefore.body.readiness?.isBillingReady !== false) throw new Error('Billing readiness before gating failed');

  const taskDone = await json(await taskStatusRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks/${taskId}/status`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ toStatus: 'done', changedBy: 'verify_t35_cycle_1' })
  }), { params: Promise.resolve({ leadId, taskId }) }));
  if (taskDone.status !== 200 || !taskDone.body.ok) throw new Error('Task status POST failed');

  const stageChange = await json(await stageRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/commercial-stage`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ toStage: 'cliente_convertido', changedBy: 'verify_t35_cycle_1', note: 'advance for verifier' })
  }), { params: Promise.resolve({ leadId }) }));
  if (stageChange.status !== 200 || !stageChange.body.ok) throw new Error('Commercial stage POST failed');

  const billingReadinessAfter = await json(await billingReadinessRoute.GET(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-readiness`), { params: Promise.resolve({ leadId }) }));
  if (billingReadinessAfter.status !== 200 || billingReadinessAfter.body.readiness?.isBillingReady !== true) throw new Error('Billing readiness after gating failed');

  const billingRecord = await json(await billingRecordRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-record`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actor: 'verify_t35_cycle_1', note: 'activate billing' })
  }), { params: Promise.resolve({ leadId }) }));
  if (billingRecord.status !== 201 || !billingRecord.body.billingRecord?.billingRecordId) throw new Error('Billing record POST failed');

  const billingCharge = await json(await billingChargeRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actor: 'verify_t35_cycle_1', note: 'create first charge' })
  }), { params: Promise.resolve({ leadId }) }));
  if (billingCharge.status !== 201 || !billingCharge.body.charge?.chargeId) throw new Error('Billing charge POST failed');
  const chargeId = billingCharge.body.charge.chargeId;

  const nextBillingChargeBlocked = await json(await nextBillingChargeRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges/next`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actor: 'verify_t35_cycle_1', note: 'should stay blocked before settlement' })
  }), { params: Promise.resolve({ leadId }) }));
  if (nextBillingChargeBlocked.status !== 422) throw new Error('Next billing charge blocker changed unexpectedly');

  const targetedSettlement = await json(await targetedSettlementRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-settlements/${chargeId}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actor: 'verify_t35_cycle_1', note: 'settle first charge' })
  }), { params: Promise.resolve({ leadId, chargeId }) }));
  if (targetedSettlement.status !== 201 || !targetedSettlement.body.settlement?.settlementId) throw new Error('Targeted settlement POST failed');

  const legacySettlementBlocked = await json(await billingSettlementRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-settlements`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actor: 'verify_t35_cycle_1', note: 'legacy settlement should now fail without eligible charge' })
  }), { params: Promise.resolve({ leadId }) }));
  if (legacySettlementBlocked.status !== 409 && legacySettlementBlocked.status !== 422) throw new Error('Legacy settlement route behavior changed');

  const nextBillingCharge = await json(await nextBillingChargeRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-charges/next`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actor: 'verify_t35_cycle_1', note: 'create second charge after settlement' })
  }), { params: Promise.resolve({ leadId }) }));
  if (nextBillingCharge.status !== 201 || !nextBillingCharge.body.charge?.chargeId) throw new Error('Next billing charge POST failed');

  const surfaceCheck = {
    routeManifestHasIntake: routeValues.includes('/api/intake'),
    routeManifestHasIntakeEvents: routeValues.includes('/api/intake-events'),
    routeManifestHasLeadsPage: routeValues.includes('/cockpit/leads'),
    routeManifestHasLeadDetailPage: routeValues.includes('/cockpit/leads/[leadId]'),
    routeManifestHasBillingPage: routeValues.includes('/cockpit/billing'),
    routeManifestHasAllStorageRoutes: [
      '/api/cockpit/leads/[leadId]/notes',
      '/api/cockpit/leads/[leadId]/tasks',
      '/api/cockpit/leads/[leadId]/tasks/[taskId]/status',
      '/api/cockpit/leads/[leadId]/commercial-stage',
      '/api/cockpit/leads/[leadId]/billing-readiness',
      '/api/cockpit/leads/[leadId]/billing-record',
      '/api/cockpit/leads/[leadId]/billing-charges',
      '/api/cockpit/leads/[leadId]/billing-charges/next',
      '/api/cockpit/leads/[leadId]/billing-settlements',
      '/api/cockpit/leads/[leadId]/billing-settlements/[chargeId]'
    ].every((route) => routeValues.includes(route)),
    barrelExportsStorageModules: ["./storage/types", "./storage/db", "./storage/leads", "./storage/notes", "./storage/tasks", "./storage/billing", "./storage/intake"].every((entry) => storageBarrelSource.includes(entry))
  };

  if (!Object.values(surfaceCheck).every(Boolean)) throw new Error(`Surface check failed: ${JSON.stringify(surfaceCheck)}`);

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    note: 'HTTP bind is blocked in this sandbox (listen EPERM); verification executed by invoking compiled Next app route handlers directly after next build.',
    leadId,
    taskId,
    chargeId,
    nextChargeId: nextBillingCharge.body.charge.chargeId,
    responses: {
      intakeCreate,
      intakeEventCreate,
      noteCreate,
      taskCreate,
      billingReadinessBefore,
      taskDone,
      stageChange,
      billingReadinessAfter,
      billingRecord,
      billingCharge,
      nextBillingChargeBlocked,
      targetedSettlement,
      legacySettlementBlocked,
      nextBillingCharge
    },
    surfaceCheck
  };

  fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
NODE
