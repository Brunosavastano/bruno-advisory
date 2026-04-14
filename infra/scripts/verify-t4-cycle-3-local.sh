#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T4-cycle-3}"
mkdir -p "$EVIDENCE_DIR"

bash -lc 'build_ok=0; for attempt in 1 2 3; do if npm run build >/dev/null; then build_ok=1; break; fi; if [ "$attempt" -lt 3 ]; then sleep 2; fi; done; [ "$build_ok" -eq 1 ]'

node - "$ROOT" "$EVIDENCE_DIR" <<'NODE'
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { createRequire } = require('node:module');

async function json(res) {
  let body = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) body = await res.json();
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body };
}

async function main() {
  const root = process.argv[2];
  const evidenceDir = path.resolve(root, process.argv[3]);
  const webDir = path.join(root, 'apps', 'web');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t4-cycle3-'));
  const requireFromWeb = createRequire(path.join(webDir, 'package.json'));

  fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
  fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
  fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
  process.chdir(tempRoot);
  process.on('exit', () => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const intakeRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js')).routeModule.userland;
  const inviteRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'portal-invite-codes', 'route.js')).routeModule.userland;
  const cockpitDocumentsRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'documents', 'route.js')).routeModule.userland;
  const portalSessionRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'session', 'route.js')).routeModule.userland;
  const portalDocumentsRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'documents', 'route.js')).routeModule.userland;

  async function createLead(label) {
    const res = await json(await intakeRoute.POST(new Request('http://localhost/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: `T4 Cycle 3 ${label}`,
        email: `t4-cycle3-${label}-${randomUUID()}@example.com`,
        phone: '11999990000',
        city: 'Brasilia',
        state: 'DF',
        investableAssetsBand: '3m_a_10m',
        primaryChallenge: 'Enviar documentos pelo portal',
        sourceLabel: `verify_t4_cycle_3_${label}`,
        privacyConsentAccepted: true,
        termsConsentAccepted: true
      })
    })));
    if (res.status !== 201 || !res.body?.leadId) throw new Error('Lead creation failed');
    return res.body.leadId;
  }

  const leadA = await createLead('lead-a');
  const leadB = await createLead('lead-b');

  async function loginForLead(leadId) {
    const invite = await json(await inviteRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/portal-invite-codes`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({})
    }), { params: Promise.resolve({ leadId }) }));
    if (invite.status !== 200 || !invite.body?.invite?.code) throw new Error(`Invite creation failed for ${leadId}`);

    const loginForm = new FormData();
    loginForm.set('code', invite.body.invite.code);
    const login = await json(await portalSessionRoute.POST(new Request('http://localhost/api/portal/session', { method: 'POST', body: loginForm })));
    const sessionCookie = login.headers['set-cookie'] || '';
    if (login.status !== 302 || !sessionCookie.includes('portal_session=')) throw new Error(`Portal login failed for ${leadId}`);
    return { invite, login, sessionCookie };
  }

  const authA = await loginForLead(leadA);
  const authB = await loginForLead(leadB);

  const uploadForm = new FormData();
  uploadForm.set('file', new File(['documento portal A'], 'rg-frente.pdf', { type: 'application/pdf' }));
  const upload = await json(await portalDocumentsRoute.POST(new Request('http://localhost/api/portal/documents', {
    method: 'POST',
    headers: { cookie: authA.sessionCookie },
    body: uploadForm
  })));
  if (upload.status !== 201 || !upload.body?.document?.documentId) throw new Error('Document upload failed');

  const ownList = await json(await portalDocumentsRoute.GET(new Request('http://localhost/api/portal/documents', {
    method: 'GET',
    headers: { cookie: authA.sessionCookie }
  })));
  if (ownList.status !== 200 || !Array.isArray(ownList.body?.documents) || ownList.body.documents.length !== 1) {
    throw new Error('Portal own documents list failed');
  }

  const foreignList = await json(await portalDocumentsRoute.GET(new Request('http://localhost/api/portal/documents', {
    method: 'GET',
    headers: { cookie: authB.sessionCookie }
  })));
  if (foreignList.status !== 200 || !Array.isArray(foreignList.body?.documents) || foreignList.body.documents.length !== 0) {
    throw new Error('Portal foreign documents leakage detected');
  }

  const cockpitList = await json(await cockpitDocumentsRoute.GET(new Request(`http://localhost/api/cockpit/leads/${leadA}/documents`), {
    params: Promise.resolve({ leadId: leadA })
  }));
  if (cockpitList.status !== 200 || !Array.isArray(cockpitList.body?.documents) || cockpitList.body.documents.length !== 1) {
    throw new Error('Cockpit lead documents list failed');
  }

  const db = new DatabaseSync(path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3'));
  const persisted = db.prepare(`
    SELECT
      lead_id AS leadId,
      original_filename AS filename,
      size_bytes AS size,
      mime_type AS mimeType,
      uploaded_at AS uploadedAt,
      status,
      stored_filename AS storedFilename
    FROM lead_documents
    WHERE lead_id = ?
    LIMIT 1
  `).get(leadA);
  if (!persisted || persisted.leadId !== leadA || persisted.filename !== 'rg-frente.pdf') {
    throw new Error('Persisted metadata missing or invalid');
  }

  const diskPath = path.join(tempRoot, 'data', 'dev', 'uploads', leadA, persisted.storedFilename);
  if (!fs.existsSync(diskPath)) throw new Error('Uploaded file not materialized on disk');
  if (fs.readFileSync(diskPath, 'utf8') !== 'documento portal A') throw new Error('Uploaded file content mismatch');

  const portalDocumentsPageSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'documents', 'page.tsx'), 'utf8');
  const cockpitLeadPageSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'page.tsx'), 'utf8');

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadA,
    leadB,
    loginA: authA.login,
    loginB: authB.login,
    upload,
    ownList,
    foreignList,
    cockpitList,
    persisted,
    diskPath,
    surfaceChecks: {
      portalDocumentsPageExists: fs.existsSync(path.join(webDir, 'app', 'portal', 'documents', 'page.tsx')),
      portalDocumentsPageUsesSessionLead: portalDocumentsPageSource.includes('listDocuments(session.leadId)'),
      cockpitLeadShowsDocuments: cockpitLeadPageSource.includes('Documentos T4 cycle 3'),
      storedUnderLeadDirectory: diskPath.includes(path.join('data', 'dev', 'uploads', leadA))
    },
    note: 'Verification executed against compiled route handlers, SQLite inspection and direct file checks under data/dev/uploads/<leadId>/.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
NODE
