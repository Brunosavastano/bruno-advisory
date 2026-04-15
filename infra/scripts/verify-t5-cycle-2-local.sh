#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T5-cycle-2}"
mkdir -p "$EVIDENCE_DIR"

rm -rf apps/web/.next apps/web/.next.partial.* 2>/dev/null || true

build_ok=0
for attempt in 1 2 3; do
  if npm run build >/dev/null; then
    build_ok=1
    break
  fi
  if [ "$attempt" -lt 3 ]; then
    sleep 2
  fi
done

if [ "$build_ok" -ne 1 ]; then
  echo "Build failed after 3 attempts" >&2
  exit 1
fi

node - "$ROOT" "$EVIDENCE_DIR" <<'NODE'
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

async function json(res) {
  let body = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  }
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body };
}

function requireUserland(modulePath) {
  return require(modulePath).routeModule.userland;
}

async function main() {
  const root = process.argv[2];
  const evidenceDir = path.resolve(root, process.argv[3]);
  const webDir = path.join(root, 'apps', 'web');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t5-cycle2-'));
  fs.mkdirSync(path.join(tempRoot, 'data', 'dev'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
  fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
  fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
  process.chdir(tempRoot);
  process.on('exit', () => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const intakeRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js'));
  const createInviteRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'portal-invite-codes', 'route.js'));
  const portalSessionRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'session', 'route.js'));
  const cockpitResearchRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'research-workflows', 'route.js'));
  const cockpitMemosRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'memos', 'route.js'));
  const portalMemosRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'memos', 'route.js'));

  async function createLead(label, fullName, emailPrefix) {
    const response = await json(await intakeRoute.POST(new Request('http://localhost/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName,
        email: `${emailPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
        phone: '11988887777',
        city: 'Sao Paulo',
        state: 'SP',
        investableAssetsBand: '3m_a_10m',
        primaryChallenge: 'Quero memos manuais publicados no portal.',
        sourceLabel: label,
        privacyConsentAccepted: true,
        termsConsentAccepted: true
      })
    })));

    if (response.status !== 201 || !response.body?.leadId) {
      throw new Error(`Intake failed for ${label}: ${JSON.stringify(response)}`);
    }

    return response.body.leadId;
  }

  async function createWorkflow(leadId, title, topic) {
    const response = await json(await cockpitResearchRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/research-workflows`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title, topic })
    }), { params: Promise.resolve({ leadId }) }));

    if (response.status !== 201 || !response.body?.workflow?.id) {
      throw new Error(`Workflow create failed: ${JSON.stringify(response)}`);
    }

    return response.body.workflow;
  }

  async function createMemo(leadId, payload) {
    const response = await json(await cockpitMemosRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/memos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }), { params: Promise.resolve({ leadId }) }));

    if (response.status !== 201 || !response.body?.memo?.id) {
      throw new Error(`Memo create failed: ${JSON.stringify(response)}`);
    }

    return response.body.memo;
  }

  async function patchMemo(leadId, payload) {
    const response = await json(await cockpitMemosRoute.PATCH(new Request(`http://localhost/api/cockpit/leads/${leadId}/memos`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }), { params: Promise.resolve({ leadId }) }));

    if (response.status !== 200 || !response.body?.memo?.id) {
      throw new Error(`Memo patch failed: ${JSON.stringify(response)}`);
    }

    return response.body.memo;
  }

  async function listLeadMemos(leadId) {
    const response = await json(await cockpitMemosRoute.GET(
      new Request(`http://localhost/api/cockpit/leads/${leadId}/memos`, { method: 'GET' }),
      { params: Promise.resolve({ leadId }) }
    ));

    if (response.status !== 200 || !Array.isArray(response.body?.memos)) {
      throw new Error(`Memo list failed: ${JSON.stringify(response)}`);
    }

    return response.body.memos;
  }

  async function createPortalSession(leadId) {
    const inviteCreate = await json(await createInviteRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/portal-invite-codes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    }), { params: Promise.resolve({ leadId }) }));

    if (inviteCreate.status !== 200 || !inviteCreate.body?.invite?.code) {
      throw new Error(`Invite create failed: ${JSON.stringify(inviteCreate)}`);
    }

    const form = new FormData();
    form.set('code', inviteCreate.body.invite.code);
    const login = await json(await portalSessionRoute.POST(new Request('http://localhost/api/portal/session', {
      method: 'POST',
      body: form
    })));
    const setCookie = login.headers['set-cookie'] || '';

    if (login.status !== 302 || !setCookie.includes('portal_session=')) {
      throw new Error(`Portal login failed: ${JSON.stringify(login)}`);
    }

    return { invite: inviteCreate.body.invite, cookie: setCookie.split(';')[0] };
  }

  async function readPortalMemos(cookie) {
    const response = await json(await portalMemosRoute.GET(new Request('http://localhost/api/portal/memos', {
      method: 'GET',
      headers: { cookie }
    })));

    if (response.status !== 200 || !Array.isArray(response.body?.memos)) {
      throw new Error(`Portal memos read failed: ${JSON.stringify(response)}`);
    }

    return response.body.memos;
  }

  const leadA = await createLead('verify_t5_cycle_2_a', 'T5 Cycle 2 Lead A', 't5-cycle2-a');
  const leadB = await createLead('verify_t5_cycle_2_b', 'T5 Cycle 2 Lead B', 't5-cycle2-b');

  const researchA = await createWorkflow(leadA, 'Research base para memo linkado', 'Cenário macro e proteção de portfólio');
  const standaloneA = await createMemo(leadA, {
    title: 'Memo standalone publicado',
    body: 'Versão inicial do memo standalone.',
    researchWorkflowId: null
  });
  const standaloneAPublished = await patchMemo(leadA, {
    id: standaloneA.id,
    body: 'Memo standalone publicado para o cliente no portal.',
    status: 'published'
  });

  const linkedA = await createMemo(leadA, {
    title: 'Memo linkado ao research',
    body: 'Primeira versão do memo linkado.',
    researchWorkflowId: researchA.id
  });
  const linkedAUpdated = await patchMemo(leadA, {
    id: linkedA.id,
    body: 'Memo linkado atualizado, ainda não publicado.',
    status: 'pending_review'
  });

  const standaloneB = await createMemo(leadB, {
    title: 'Memo publicado lead B',
    body: 'Conteúdo do memo do lead B.',
    researchWorkflowId: null
  });
  const standaloneBPublished = await patchMemo(leadB, {
    id: standaloneB.id,
    body: 'Memo publicado do lead B.',
    status: 'published'
  });

  const leadAMemos = await listLeadMemos(leadA);
  if (leadAMemos.length !== 2) {
    throw new Error(`Expected 2 memos for lead A, got ${leadAMemos.length}`);
  }

  const linkedMemoFromList = leadAMemos.find((memo) => memo.id === linkedAUpdated.id);
  if (!linkedMemoFromList || linkedMemoFromList.researchWorkflowId !== researchA.id) {
    throw new Error(`Research workflow link did not persist: ${JSON.stringify(leadAMemos)}`);
  }

  const sessionA = await createPortalSession(leadA);
  const sessionB = await createPortalSession(leadB);
  const portalA = await readPortalMemos(sessionA.cookie);
  const portalB = await readPortalMemos(sessionB.cookie);

  if (portalA.length !== 1 || portalA[0].id !== standaloneAPublished.id) {
    throw new Error(`Lead A portal exposure mismatch: ${JSON.stringify(portalA)}`);
  }
  if (portalA.some((item) => item.id === linkedAUpdated.id)) {
    throw new Error('Lead A portal exposed a non-published memo');
  }
  if (portalA.some((item) => item.id === standaloneBPublished.id)) {
    throw new Error('Lead A portal exposed lead B memo');
  }
  if (portalB.length !== 1 || portalB[0].id !== standaloneBPublished.id) {
    throw new Error(`Lead B portal exposure mismatch: ${JSON.stringify(portalB)}`);
  }
  if (portalB.some((item) => item.id === standaloneAPublished.id || item.id === linkedAUpdated.id)) {
    throw new Error('Lead B portal exposed foreign memo');
  }

  const dbPath = path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3');
  const db = new DatabaseSync(dbPath);
  const dbRows = db.prepare(`
    SELECT id, lead_id AS leadId, research_workflow_id AS researchWorkflowId, title, body, status, created_at AS createdAt, updated_at AS updatedAt
    FROM memos
    ORDER BY lead_id ASC, created_at ASC, id ASC
  `).all();

  if (dbRows.length !== 3) {
    throw new Error(`Expected 3 memos rows, got ${dbRows.length}`);
  }

  const linkedDbRow = dbRows.find((row) => row.id === linkedAUpdated.id);
  if (!linkedDbRow || linkedDbRow.researchWorkflowId !== researchA.id) {
    throw new Error(`Linked memo DB row mismatch: ${JSON.stringify(linkedDbRow)}`);
  }

  const appRoutesManifestPath = path.join(webDir, '.next', 'app-path-routes-manifest.json');
  const appRoutes = JSON.parse(fs.readFileSync(appRoutesManifestPath, 'utf8'));
  const leadDetailSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'page.tsx'), 'utf8');
  const dashboardSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'dashboard', 'page.tsx'), 'utf8');
  const portalPageSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'memos', 'page.tsx'), 'utf8');
  const cockpitRouteSource = fs.readFileSync(path.join(webDir, 'app', 'api', 'cockpit', 'leads', '[leadId]', 'memos', 'route.ts'), 'utf8');

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadA,
    leadB,
    researchWorkflowLeadA: researchA,
    standaloneMemoLeadA: standaloneAPublished,
    linkedMemoLeadA: linkedAUpdated,
    standaloneMemoLeadB: standaloneBPublished,
    portalLeadAIds: portalA.map((item) => item.id),
    portalLeadBIds: portalB.map((item) => item.id),
    dbPath,
    dbRows,
    surfaceChecks: {
      cockpitSectionVisible: leadDetailSource.includes('MemosPanel') || leadDetailSource.includes('Memo container T5 cycle 2'),
      portalRoutePresent: Object.values(appRoutes).includes('/portal/memos'),
      portalDashboardLinksMemos: dashboardSource.includes('/portal/memos'),
      portalPageReadsPublishedOnly: portalPageSource.includes("listMemos(session.leadId, 'published')"),
      cockpitRouteHasCrudMethods: cockpitRouteSource.includes('export async function GET')
        && cockpitRouteSource.includes('export async function POST')
        && cockpitRouteSource.includes('export async function PATCH')
        && cockpitRouteSource.includes('export async function DELETE')
    },
    note: 'HTTP bind may be blocked in this sandbox (listen EPERM); verification ran by invoking compiled route handlers directly against an isolated temp-root SQLite database.'
  };

  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
NODE
