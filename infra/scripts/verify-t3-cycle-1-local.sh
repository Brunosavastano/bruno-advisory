#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T3-cycle-1}"
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
  const stageRoute = require(
    path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'commercial-stage', 'route.js')
  ).routeModule.userland;

  const testEmail = `t3-local-${Date.now()}@example.com`;
  const intakeRequest = new Request('http://localhost/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'T3 Local Verifier',
      email: testEmail,
      phone: '11988123456',
      city: 'Sao Paulo',
      state: 'SP',
      investableAssetsBand: '3m_a_10m',
      primaryChallenge: 'Preciso evoluir o acompanhamento comercial com trilha auditavel.',
      sourceLabel: 'verify_t3_cycle_1_local',
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
  const stageRequest = new Request(`http://localhost/api/cockpit/leads/${leadId}/commercial-stage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      toStage: 'contato_inicial',
      note: 'Stage changed by local verifier (no-http)',
      changedBy: 'verify_t3_cycle_1_local'
    })
  });

  const stageResponse = await stageRoute.POST(stageRequest, { params: Promise.resolve({ leadId }) });
  const stageBody = await stageResponse.json();
  if (stageResponse.status !== 200 || !stageBody.ok) {
    throw new Error(`Stage mutation route invocation failed: status=${stageResponse.status}`);
  }

  const db = new DatabaseSync(dbPath);
  const leadRow =
    db.prepare(
      `SELECT lead_id, full_name, email, status, commercial_stage, created_at, updated_at FROM intake_leads WHERE lead_id = ?`
    ).get(leadId) ?? null;
  const auditRows = db
    .prepare(
      `SELECT audit_id, lead_id, from_stage, to_stage, changed_at, changed_by, note
       FROM lead_stage_audit
       WHERE lead_id = ?
       ORDER BY changed_at DESC, audit_id DESC
       LIMIT 10`
    )
    .all(leadId);

  if (!leadRow) {
    throw new Error('Lead row not found after route invocation');
  }

  const matchingAudit = auditRows.find(
    (row) => row.to_stage === 'contato_inicial' && row.changed_by === 'verify_t3_cycle_1_local'
  );
  if (!matchingAudit) {
    throw new Error('Matching audit row not found');
  }

  const surfaceCheck = {
    appRoutesManifestPath,
    cockpitRoutePresent: Object.values(appRoutes).includes('/cockpit/leads'),
    leadDetailRoutePresent: Object.values(appRoutes).includes('/cockpit/leads/[leadId]'),
    cockpitLinksToDetail: cockpitSource.includes('href={`/cockpit/leads/${lead.leadId}`}'),
    leadDetailShowsAuditTrail: detailSource.includes('Auditoria de estágio comercial')
  };

  const dbInspection = {
    dbPath,
    leadId,
    leadRow,
    auditRows
  };

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadId,
    intakeRouteStatus: intakeResponse.status,
    stageRouteStatus: stageResponse.status,
    stageResponse: stageBody,
    surfaceCheck,
    dbInspection: {
      leadCommercialStage: leadRow.commercial_stage,
      auditCount: auditRows.length,
      matchingAuditId: matchingAudit.audit_id
    },
    note: 'HTTP bind is blocked in this sandbox (listen EPERM); verification executed by invoking compiled app route handlers directly.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'local-route-intake.json'), `${JSON.stringify(intakeBody, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(evidenceDir, 'local-route-stage-mutation.json'), `${JSON.stringify(stageBody, null, 2)}\n`, 'utf8');
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
