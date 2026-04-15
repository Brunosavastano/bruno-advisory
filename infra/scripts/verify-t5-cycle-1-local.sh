#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T5-cycle-1}"
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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t5-cycle1-'));
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
  const portalResearchRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'research-workflows', 'route.js'));

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
        primaryChallenge: 'Quero research estruturado no portal sem IA.',
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

  async function updateWorkflowStatus(leadId, id, status) {
    const response = await json(await cockpitResearchRoute.PATCH(new Request(`http://localhost/api/cockpit/leads/${leadId}/research-workflows`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, status })
    }), { params: Promise.resolve({ leadId }) }));

    if (response.status !== 200 || response.body?.workflow?.status !== status) {
      throw new Error(`Workflow status update failed: ${JSON.stringify(response)}`);
    }

    return response.body.workflow;
  }

  async function listLeadWorkflows(leadId) {
    const response = await json(await cockpitResearchRoute.GET(
      new Request(`http://localhost/api/cockpit/leads/${leadId}/research-workflows`, { method: 'GET' }),
      { params: Promise.resolve({ leadId }) }
    ));

    if (response.status !== 200 || !Array.isArray(response.body?.workflows)) {
      throw new Error(`Workflow list failed: ${JSON.stringify(response)}`);
    }

    return response.body.workflows;
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

  async function readPortalResearch(cookie) {
    const response = await json(await portalResearchRoute.GET(new Request('http://localhost/api/portal/research-workflows', {
      method: 'GET',
      headers: { cookie }
    })));

    if (response.status !== 200 || !Array.isArray(response.body?.workflows)) {
      throw new Error(`Portal research read failed: ${JSON.stringify(response)}`);
    }

    return response.body.workflows;
  }

  const leadA = await createLead('verify_t5_cycle_1_a', 'T5 Cycle 1 Lead A', 't5-cycle1-a');
  const leadB = await createLead('verify_t5_cycle_1_b', 'T5 Cycle 1 Lead B', 't5-cycle1-b');

  const deliveredA = await createWorkflow(leadA, 'Research macro abril', 'Juros globais e rebalanceamento');
  const hiddenA = await createWorkflow(leadA, 'Research interno maio', 'Checklist de hipóteses ainda em revisão');
  const deliveredB = await createWorkflow(leadB, 'Research beta lead B', 'Carteira internacional defensiva');

  const updatedA = await updateWorkflowStatus(leadA, deliveredA.id, 'delivered');
  const updatedB = await updateWorkflowStatus(leadB, deliveredB.id, 'delivered');
  const leadAList = await listLeadWorkflows(leadA);

  if (leadAList.length !== 2) {
    throw new Error(`Expected 2 workflows for lead A, got ${leadAList.length}`);
  }

  const sessionA = await createPortalSession(leadA);
  const sessionB = await createPortalSession(leadB);
  const portalA = await readPortalResearch(sessionA.cookie);
  const portalB = await readPortalResearch(sessionB.cookie);

  if (portalA.length !== 1 || portalA[0].id !== updatedA.id) {
    throw new Error(`Lead A portal exposure mismatch: ${JSON.stringify(portalA)}`);
  }
  if (portalA.some((item) => item.id === hiddenA.id)) {
    throw new Error('Lead A portal exposed a non-delivered workflow');
  }
  if (portalA.some((item) => item.id === updatedB.id)) {
    throw new Error('Lead A portal exposed lead B workflow');
  }
  if (portalB.length !== 1 || portalB[0].id !== updatedB.id) {
    throw new Error(`Lead B portal exposure mismatch: ${JSON.stringify(portalB)}`);
  }
  if (portalB.some((item) => item.id === updatedA.id || item.id === hiddenA.id)) {
    throw new Error('Lead B portal exposed foreign workflow');
  }

  const dbPath = path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3');
  const db = new DatabaseSync(dbPath);
  const dbRows = db.prepare(`
    SELECT id, lead_id AS leadId, title, topic, status, created_at AS createdAt, updated_at AS updatedAt
    FROM research_workflows
    ORDER BY lead_id ASC, created_at ASC, id ASC
  `).all();

  if (dbRows.length !== 3) {
    throw new Error(`Expected 3 research_workflows rows, got ${dbRows.length}`);
  }

  const appRoutesManifestPath = path.join(webDir, '.next', 'app-path-routes-manifest.json');
  const appRoutes = JSON.parse(fs.readFileSync(appRoutesManifestPath, 'utf8'));
  const leadDetailSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'page.tsx'), 'utf8');
  const dashboardSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'dashboard', 'page.tsx'), 'utf8');
  const portalPageSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'research', 'page.tsx'), 'utf8');
  const cockpitRouteSource = fs.readFileSync(path.join(webDir, 'app', 'api', 'cockpit', 'leads', '[leadId]', 'research-workflows', 'route.ts'), 'utf8');

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadA,
    leadB,
    deliveredWorkflowLeadA: updatedA,
    hiddenWorkflowLeadA: hiddenA,
    deliveredWorkflowLeadB: updatedB,
    portalLeadAIds: portalA.map((item) => item.id),
    portalLeadBIds: portalB.map((item) => item.id),
    dbPath,
    dbRows,
    surfaceChecks: {
      cockpitSectionVisible: leadDetailSource.includes('ResearchWorkflowsPanel') || leadDetailSource.includes('Research workflow T5 cycle 1'),
      portalRoutePresent: Object.values(appRoutes).includes('/portal/research'),
      portalDashboardLinksResearch: dashboardSource.includes('/portal/research'),
      portalPageReadsDeliveredOnly: portalPageSource.includes("listWorkflows(session.leadId, 'delivered')"),
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
