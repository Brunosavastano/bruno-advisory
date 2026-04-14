#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3-cycle-3}"
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

  const testEmail = `t3-cycle-3-local-${Date.now()}@example.com`;
  const intakeRequest = new Request('http://localhost/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'T3 Cycle Three Local',
      email: testEmail,
      phone: '11988333222',
      city: 'Sao Paulo',
      state: 'SP',
      investableAssetsBand: '1m_a_3m',
      primaryChallenge: 'Preciso operar tarefas com transicao auditavel no detalhe do lead.',
      sourceLabel: 'verify_t3_cycle_3_local',
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

  const taskPayload = {
    title: 'Validar checklist de onboarding financeiro',
    status: 'todo',
    dueDate: '2026-04-22'
  };
  const taskRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(taskPayload)
  });
  const taskResponse = await taskCreateRoute.POST(taskRequest, { params: Promise.resolve({ leadId }) });
  const taskBody = await taskResponse.json();
  if (taskResponse.status !== 201 || !taskBody.ok || !taskBody.task?.taskId) {
    throw new Error(`Task create mutation route invocation failed: status=${taskResponse.status}`);
  }

  const taskId = taskBody.task.taskId;

  const taskStatusPayload = {
    toStatus: 'in_progress',
    changedBy: 'verify_t3_cycle_3_local'
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

  const matchingTask = taskRows.find((row) => row.task_id === taskId && row.status === taskStatusPayload.toStatus);
  if (!matchingTask) {
    throw new Error('Matching task row not found with expected status');
  }

  const matchingTaskAudit = taskAuditRows.find(
    (row) =>
      row.task_id === taskId &&
      row.from_status === taskPayload.status &&
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
    tasksMutationRoutePresent: routeValues.includes('/api/cockpit/leads/[leadId]/tasks'),
    taskStatusMutationRoutePresent: routeValues.includes('/api/cockpit/leads/[leadId]/tasks/[taskId]/status'),
    cockpitLinksToDetail: cockpitSource.includes('href={`/cockpit/leads/${lead.leadId}`}'),
    leadDetailRendersTasks: detailSource.includes('Tarefas internas') && detailSource.includes('tasks.map((task)'),
    leadDetailHasTasksFormAction: detailSource.includes('action={`/api/cockpit/leads/${lead.leadId}/tasks`}'),
    leadDetailHasTaskStatusFormAction: detailSource.includes(
      'action={`/api/cockpit/leads/${lead.leadId}/tasks/${task.taskId}/status`}'
    ),
    leadDetailRendersTaskAudit: detailSource.includes('Auditoria da tarefa')
  };

  const dbInspection = {
    dbPath,
    leadId,
    taskId,
    leadRow,
    taskRows,
    taskAuditRows
  };

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadId,
    taskId,
    intakeRouteStatus: intakeResponse.status,
    taskCreateRouteStatus: taskResponse.status,
    taskStatusRouteStatus: taskStatusResponse.status,
    taskCreateResponse: taskBody,
    taskStatusResponse: taskStatusBody,
    surfaceCheck,
    dbInspection: {
      taskCount: taskRows.length,
      taskAuditCount: taskAuditRows.length,
      matchingTaskId: matchingTask.task_id,
      matchingTaskAuditId: matchingTaskAudit.audit_id
    },
    note: 'HTTP bind is blocked in this sandbox (listen EPERM); verification executed by invoking compiled app route handlers directly.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'local-route-intake.json'), `${JSON.stringify(intakeBody, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(evidenceDir, 'local-route-task-create.json'), `${JSON.stringify(taskBody, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(evidenceDir, 'local-route-task-status.json'), `${JSON.stringify(taskStatusBody, null, 2)}\n`, 'utf8');
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
