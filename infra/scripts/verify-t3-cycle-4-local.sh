#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3-cycle-4}"
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
  const taskCreateRoute = require(
    path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', 'route.js')
  ).routeModule.userland;
  const taskStatusRoute = require(
    path.join(
      webDir,
      '.next',
      'server',
      'app',
      'api',
      'cockpit',
      'leads',
      '[leadId]',
      'tasks',
      '[taskId]',
      'status',
      'route.js'
    )
  ).routeModule.userland;
  const stageRoute = require(
    path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'commercial-stage', 'route.js')
  ).routeModule.userland;
  const billingReadinessRoute = require(
    path.join(
      webDir,
      '.next',
      'server',
      'app',
      'api',
      'cockpit',
      'leads',
      '[leadId]',
      'billing-readiness',
      'route.js'
    )
  ).routeModule.userland;

  const testEmail = `t3-cycle-4-local-${Date.now()}@example.com`;
  const intakeRequest = new Request('http://localhost/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'T3 Cycle Four Local',
      email: testEmail,
      phone: '11988991144',
      city: 'Sao Paulo',
      state: 'SP',
      investableAssetsBand: '1m_a_3m',
      primaryChallenge: 'Quero determinismo para entrada em billing.',
      sourceLabel: 'verify_t3_cycle_4_local',
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

  const initialReadinessResponse = await billingReadinessRoute.GET(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-readiness`),
    { params: Promise.resolve({ leadId }) }
  );
  const initialReadinessBody = await initialReadinessResponse.json();
  if (initialReadinessResponse.status !== 200 || !initialReadinessBody.ok || initialReadinessBody.readiness.isBillingReady) {
    throw new Error(`Initial billing readiness must be unmet: status=${initialReadinessResponse.status}`);
  }

  const taskCreatePayload = {
    title: 'Fechar checklist de prontidao de billing',
    status: 'todo',
    dueDate: '2026-04-25'
  };
  const taskCreateRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(taskCreatePayload)
  });
  const taskCreateResponse = await taskCreateRoute.POST(taskCreateRequest, { params: Promise.resolve({ leadId }) });
  const taskCreateBody = await taskCreateResponse.json();
  if (taskCreateResponse.status !== 201 || !taskCreateBody.ok || !taskCreateBody.task?.taskId) {
    throw new Error(`Task create mutation route invocation failed: status=${taskCreateResponse.status}`);
  }
  const taskId = taskCreateBody.task.taskId;

  const stagePayload = {
    toStage: 'cliente_convertido',
    changedBy: 'verify_t3_cycle_4_local',
    note: 'advance to billing readiness check'
  };
  const stageRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/commercial-stage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(stagePayload)
  });
  const stageResponse = await stageRoute.POST(stageRequest, { params: Promise.resolve({ leadId }) });
  const stageBody = await stageResponse.json();
  if (stageResponse.status !== 200 || !stageBody.ok) {
    throw new Error(`Commercial stage mutation route invocation failed: status=${stageResponse.status}`);
  }

  const midReadinessResponse = await billingReadinessRoute.GET(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-readiness`),
    { params: Promise.resolve({ leadId }) }
  );
  const midReadinessBody = await midReadinessResponse.json();
  if (midReadinessResponse.status !== 200 || !midReadinessBody.ok || midReadinessBody.readiness.isBillingReady) {
    throw new Error(`Mid billing readiness must still be unmet: status=${midReadinessResponse.status}`);
  }

  const taskStatusPayload = {
    toStatus: 'done',
    changedBy: 'verify_t3_cycle_4_local'
  };
  const taskStatusRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks/${taskId}/status`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(taskStatusPayload)
  });
  const taskStatusResponse = await taskStatusRoute.POST(taskStatusRequest, {
    params: Promise.resolve({ leadId, taskId })
  });
  const taskStatusBody = await taskStatusResponse.json();
  if (taskStatusResponse.status !== 200 || !taskStatusBody.ok) {
    throw new Error(`Task status mutation route invocation failed: status=${taskStatusResponse.status}`);
  }

  const readyReadinessResponse = await billingReadinessRoute.GET(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/billing-readiness`),
    { params: Promise.resolve({ leadId }) }
  );
  const readyReadinessBody = await readyReadinessResponse.json();
  if (readyReadinessResponse.status !== 200 || !readyReadinessBody.ok || !readyReadinessBody.readiness.isBillingReady) {
    throw new Error(`Final billing readiness must be ready: status=${readyReadinessResponse.status}`);
  }

  const db = new DatabaseSync(dbPath);
  const leadRow =
    db.prepare(
      `SELECT lead_id, full_name, email, status, commercial_stage, created_at
       FROM intake_leads
       WHERE lead_id = ?`
    ).get(leadId) ?? null;
  const taskRows = db
    .prepare(
      `SELECT task_id, lead_id, title, status, due_date, created_at
       FROM lead_internal_tasks
       WHERE lead_id = ?
       ORDER BY created_at DESC, task_id DESC
       LIMIT 10`
    )
    .all(leadId);
  const stageAuditRows = db
    .prepare(
      `SELECT audit_id, lead_id, from_stage, to_stage, changed_at, changed_by, note
       FROM lead_stage_audit
       WHERE lead_id = ?
       ORDER BY changed_at DESC, audit_id DESC
       LIMIT 20`
    )
    .all(leadId);
  const taskAuditRows = db
    .prepare(
      `SELECT audit_id, lead_id, task_id, from_status, to_status, changed_at, changed_by
       FROM lead_internal_task_audit
       WHERE lead_id = ?
       ORDER BY changed_at DESC, audit_id DESC
       LIMIT 20`
    )
    .all(leadId);

  if (!leadRow) {
    throw new Error('Lead row not found after route invocation');
  }

  if (leadRow.commercial_stage !== stagePayload.toStage) {
    throw new Error(`Lead commercial_stage mismatch: expected ${stagePayload.toStage}, got ${leadRow.commercial_stage}`);
  }

  const matchingTask = taskRows.find((row) => row.task_id === taskId && row.status === taskStatusPayload.toStatus);
  if (!matchingTask) {
    throw new Error('Matching done task row not found');
  }

  const matchingStageAudit = stageAuditRows.find(
    (row) => row.to_stage === stagePayload.toStage && row.changed_by === stagePayload.changedBy
  );
  if (!matchingStageAudit) {
    throw new Error('Matching stage audit row not found');
  }

  const matchingTaskAudit = taskAuditRows.find(
    (row) =>
      row.task_id === taskId &&
      row.from_status === taskCreatePayload.status &&
      row.to_status === taskStatusPayload.toStatus &&
      row.changed_by === taskStatusPayload.changedBy
  );
  if (!matchingTaskAudit) {
    throw new Error('Matching task audit row not found');
  }

  const routeValues = Object.values(appRoutes);
  const surfaceCheck = {
    appRoutesManifestPath,
    cockpitRoutePresent: routeValues.includes('/cockpit/leads'),
    leadDetailRoutePresent: routeValues.includes('/cockpit/leads/[leadId]'),
    stageMutationRoutePresent: routeValues.includes('/api/cockpit/leads/[leadId]/commercial-stage'),
    billingReadinessRoutePresent: routeValues.includes('/api/cockpit/leads/[leadId]/billing-readiness'),
    tasksMutationRoutePresent: routeValues.includes('/api/cockpit/leads/[leadId]/tasks'),
    taskStatusMutationRoutePresent: routeValues.includes('/api/cockpit/leads/[leadId]/tasks/[taskId]/status'),
    cockpitLinksToDetail: cockpitSource.includes('href={`/cockpit/leads/${lead.leadId}`}'),
    leadDetailUsesBillingReadinessReadPath: detailSource.includes('getLeadBillingReadiness(lead.leadId)'),
    leadDetailRendersBillingSection:
      detailSource.includes('Billing readiness T3') &&
      detailSource.includes('Condicoes pendentes:') &&
      detailSource.includes('Billing ready:'),
    leadDetailRendersUnmetConditions: detailSource.includes('billingReadiness.unmetConditionLabels.map((label) =>'),
    leadDetailRendersCanonicalBillingArtifact: detailSource.includes('billingEntryModel.canonicalArtifact')
  };

  const dbInspection = {
    dbPath,
    leadId,
    taskId,
    leadRow,
    taskRows,
    stageAuditRows,
    taskAuditRows
  };

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadId,
    taskId,
    intakeRouteStatus: intakeResponse.status,
    initialBillingReadinessRouteStatus: initialReadinessResponse.status,
    taskCreateRouteStatus: taskCreateResponse.status,
    stageRouteStatus: stageResponse.status,
    midBillingReadinessRouteStatus: midReadinessResponse.status,
    taskStatusRouteStatus: taskStatusResponse.status,
    finalBillingReadinessRouteStatus: readyReadinessResponse.status,
    intakeResponse: intakeBody,
    initialReadinessResponse: initialReadinessBody,
    taskCreateResponse: taskCreateBody,
    stageResponse: stageBody,
    midReadinessResponse: midReadinessBody,
    taskStatusResponse: taskStatusBody,
    finalReadinessResponse: readyReadinessBody,
    surfaceCheck,
    dbInspection: {
      leadStage: leadRow.commercial_stage,
      totalTasks: taskRows.length,
      doneTasks: taskRows.filter((row) => row.status === 'done').length,
      pendingTasks: taskRows.filter((row) => row.status !== 'done').length,
      matchingStageAuditId: matchingStageAudit.audit_id,
      matchingTaskAuditId: matchingTaskAudit.audit_id
    },
    note: 'HTTP bind is blocked in this sandbox (listen EPERM); verification executed by invoking compiled app route handlers directly.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'local-route-intake.json'), `${JSON.stringify(intakeBody, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(evidenceDir, 'local-route-billing-readiness-initial.json'),
    `${JSON.stringify(initialReadinessBody, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(evidenceDir, 'local-route-task-create.json'),
    `${JSON.stringify(taskCreateBody, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(evidenceDir, 'local-route-stage-mutation.json'),
    `${JSON.stringify(stageBody, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(evidenceDir, 'local-route-billing-readiness-mid.json'),
    `${JSON.stringify(midReadinessBody, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(evidenceDir, 'local-route-task-status.json'),
    `${JSON.stringify(taskStatusBody, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(evidenceDir, 'local-route-billing-readiness-ready.json'),
    `${JSON.stringify(readyReadinessBody, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(path.join(evidenceDir, 'local-surface-check.json'), `${JSON.stringify(surfaceCheck, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(evidenceDir, 'local-db-inspection.json'), `${JSON.stringify(dbInspection, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
NODE
