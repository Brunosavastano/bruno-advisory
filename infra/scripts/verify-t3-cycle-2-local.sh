#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3-cycle-2}"
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
  const noteRoute = require(
    path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'notes', 'route.js')
  ).routeModule.userland;
  const taskRoute = require(
    path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'tasks', 'route.js')
  ).routeModule.userland;

  const testEmail = `t3-cycle-2-local-${Date.now()}@example.com`;
  const intakeRequest = new Request('http://localhost/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'T3 Cycle Two Local',
      email: testEmail,
      phone: '11988776655',
      city: 'Sao Paulo',
      state: 'SP',
      investableAssetsBand: '1m_a_3m',
      primaryChallenge: 'Preciso organizar pipeline operacional de leads.',
      sourceLabel: 'verify_t3_cycle_2_local',
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

  const notePayload = {
    content: 'Nota operacional criada pelo verificador local de ciclo 2.',
    authorMarker: 'verify_t3_cycle_2_local'
  };
  const noteRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/notes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(notePayload)
  });
  const noteResponse = await noteRoute.POST(noteRequest, { params: Promise.resolve({ leadId }) });
  const noteBody = await noteResponse.json();
  if (noteResponse.status !== 201 || !noteBody.ok) {
    throw new Error(`Note mutation route invocation failed: status=${noteResponse.status}`);
  }

  const taskPayload = {
    title: 'Ligar para lead para confirmar documentos',
    status: 'todo',
    dueDate: '2026-04-20'
  };
  const taskRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(taskPayload)
  });
  const taskResponse = await taskRoute.POST(taskRequest, { params: Promise.resolve({ leadId }) });
  const taskBody = await taskResponse.json();
  if (taskResponse.status !== 201 || !taskBody.ok) {
    throw new Error(`Task mutation route invocation failed: status=${taskResponse.status}`);
  }

  const db = new DatabaseSync(dbPath);
  const leadRow =
    db.prepare(
      `SELECT lead_id, full_name, email, status, commercial_stage, created_at
       FROM intake_leads
       WHERE lead_id = ?`
    ).get(leadId) ?? null;
  const noteRows = db
    .prepare(
      `SELECT note_id, lead_id, content, author_marker, created_at
       FROM lead_internal_notes
       WHERE lead_id = ?
       ORDER BY created_at DESC, note_id DESC
       LIMIT 10`
    )
    .all(leadId);
  const taskRows = db
    .prepare(
      `SELECT task_id, lead_id, title, status, due_date, created_at
       FROM lead_internal_tasks
       WHERE lead_id = ?
       ORDER BY created_at DESC, task_id DESC
       LIMIT 10`
    )
    .all(leadId);

  if (!leadRow) {
    throw new Error('Lead row not found after route invocation');
  }

  const matchingNote = noteRows.find(
    (row) => row.content === notePayload.content && row.author_marker === notePayload.authorMarker
  );
  if (!matchingNote) {
    throw new Error('Matching note row not found');
  }

  const matchingTask = taskRows.find(
    (row) => row.title === taskPayload.title && row.status === taskPayload.status && row.due_date === taskPayload.dueDate
  );
  if (!matchingTask) {
    throw new Error('Matching task row not found');
  }

  const routeValues = Object.values(appRoutes);
  const surfaceCheck = {
    appRoutesManifestPath,
    cockpitRoutePresent: routeValues.includes('/cockpit/leads'),
    leadDetailRoutePresent: routeValues.includes('/cockpit/leads/[leadId]'),
    notesMutationRoutePresent: routeValues.includes('/api/cockpit/leads/[leadId]/notes'),
    tasksMutationRoutePresent: routeValues.includes('/api/cockpit/leads/[leadId]/tasks'),
    cockpitLinksToDetail: cockpitSource.includes('href={`/cockpit/leads/${lead.leadId}`}'),
    leadDetailRendersNotes: detailSource.includes('Notas internas') && detailSource.includes('notes.map((note)'),
    leadDetailRendersTasks: detailSource.includes('Tarefas internas') && detailSource.includes('tasks.map((task)'),
    leadDetailHasNotesFormAction: detailSource.includes('action={`/api/cockpit/leads/${lead.leadId}/notes`}'),
    leadDetailHasTasksFormAction: detailSource.includes('action={`/api/cockpit/leads/${lead.leadId}/tasks`}')
  };

  const dbInspection = {
    dbPath,
    leadId,
    leadRow,
    noteRows,
    taskRows
  };

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadId,
    intakeRouteStatus: intakeResponse.status,
    noteRouteStatus: noteResponse.status,
    taskRouteStatus: taskResponse.status,
    noteResponse: noteBody,
    taskResponse: taskBody,
    surfaceCheck,
    dbInspection: {
      noteCount: noteRows.length,
      taskCount: taskRows.length,
      matchingNoteId: matchingNote.note_id,
      matchingTaskId: matchingTask.task_id
    },
    note: 'HTTP bind is blocked in this sandbox (listen EPERM); verification executed by invoking compiled app route handlers directly.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'local-route-intake.json'), `${JSON.stringify(intakeBody, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(evidenceDir, 'local-route-note-mutation.json'), `${JSON.stringify(noteBody, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(evidenceDir, 'local-route-task-mutation.json'), `${JSON.stringify(taskBody, null, 2)}\n`, 'utf8');
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
