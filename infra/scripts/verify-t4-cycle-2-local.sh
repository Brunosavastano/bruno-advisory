#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T4-cycle-2}"
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
  if (contentType.includes('application/json')) {
    body = await res.json();
  }
  return { status: res.status, headers: Object.fromEntries(res.headers.entries()), body };
}

async function main() {
  const root = process.argv[2];
  const evidenceDir = path.resolve(root, process.argv[3]);
  const webDir = path.join(root, 'apps', 'web');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t4-cycle2-'));
  const requireFromWeb = createRequire(path.join(webDir, 'package.json'));

  fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
  fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
  fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
  process.chdir(tempRoot);
  process.on('exit', () => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const intakeRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js')).routeModule.userland;
  const crmRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'crm-fields', 'route.js')).routeModule.userland;
  const inviteRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'portal-invite-codes', 'route.js')).routeModule.userland;
  const checklistRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'checklist', 'route.js')).routeModule.userland;
  const portalSessionRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'session', 'route.js')).routeModule.userland;
  const portalChecklistRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'checklist', '[itemId]', 'route.js')).routeModule.userland;

  async function createLead(label) {
    const res = await json(await intakeRoute.POST(new Request('http://localhost/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: `T4 Cycle 2 ${label}`,
        email: `t4-cycle2-${label}-${randomUUID()}@example.com`,
        phone: '11999990000',
        city: 'Brasilia',
        state: 'DF',
        investableAssetsBand: '3m_a_10m',
        primaryChallenge: 'Acompanhar onboarding no portal',
        sourceLabel: `verify_t4_cycle_2_${label}`,
        privacyConsentAccepted: true,
        termsConsentAccepted: true
      })
    })));
    if (res.status !== 201 || !res.body?.leadId) throw new Error(`Lead create failed: ${label}`);
    return res.body.leadId;
  }

  const leadA = await createLead('lead-a');
  const leadB = await createLead('lead-b');

  const crmA = await json(await crmRoute.PATCH(new Request(`http://localhost/api/cockpit/leads/${leadA}/crm-fields`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      resumo_call: 'Cliente A pronto para onboarding.',
      proximo_passo: 'Assinar contrato do mandato.',
      cadencia_acordada: 'Semanal'
    })
  }), { params: Promise.resolve({ leadId: leadA }) }));
  if (crmA.status !== 200) throw new Error('CRM patch for lead A failed');

  const checklistA1 = await json(await checklistRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadA}/checklist`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Enviar documento de identidade', description: 'Documento com foto.' })
  }), { params: Promise.resolve({ leadId: leadA }) }));
  const checklistA2 = await json(await checklistRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadA}/checklist`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Preencher suitability', description: 'Questionário básico.' })
  }), { params: Promise.resolve({ leadId: leadA }) }));
  const checklistB1 = await json(await checklistRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadB}/checklist`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Checklist do outro lead', description: 'Não deve vazar.' })
  }), { params: Promise.resolve({ leadId: leadB }) }));
  if (checklistA1.status !== 201 || checklistA2.status !== 201 || checklistB1.status !== 201) throw new Error('Checklist creation failed');

  const inviteA = await json(await inviteRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadA}/portal-invite-codes`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({})
  }), { params: Promise.resolve({ leadId: leadA }) }));
  if (inviteA.status !== 200 || !inviteA.body?.invite?.code) throw new Error('Invite create failed');

  const loginForm = new FormData();
  loginForm.set('code', inviteA.body.invite.code);
  const login = await json(await portalSessionRoute.POST(new Request('http://localhost/api/portal/session', { method: 'POST', body: loginForm })));
  const sessionCookie = login.headers['set-cookie'] || '';
  if (login.status !== 302 || !sessionCookie.includes('portal_session=')) throw new Error('Portal login failed');

  const completeOwnForm = new FormData();
  completeOwnForm.set('returnTo', '/portal/dashboard');
  const completeOwn = await json(await portalChecklistRoute.POST(new Request(`http://localhost/api/portal/checklist/${checklistA1.body.item.itemId}`, {
    method: 'POST',
    headers: { cookie: sessionCookie },
    body: completeOwnForm
  }), { params: Promise.resolve({ itemId: checklistA1.body.item.itemId }) }));
  if (completeOwn.status !== 303 || completeOwn.headers.location !== 'http://localhost/portal/dashboard?checklistCompleted=' + checklistA1.body.item.itemId) {
    throw new Error('Own checklist completion failed');
  }

  const foreignAttempt = await json(await portalChecklistRoute.POST(new Request(`http://localhost/api/portal/checklist/${checklistB1.body.item.itemId}`, {
    method: 'POST',
    headers: { cookie: sessionCookie },
    body: new FormData()
  }), { params: Promise.resolve({ itemId: checklistB1.body.item.itemId }) }));
  if (foreignAttempt.status !== 403) throw new Error('Foreign checklist item should be blocked');

  const db = new DatabaseSync(path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3'));
  const persistedOwn = db.prepare(`SELECT lead_id AS leadId, status, completed_by AS completedBy FROM onboarding_checklist_items WHERE item_id = ? LIMIT 1`).get(checklistA1.body.item.itemId);
  const persistedForeign = db.prepare(`SELECT lead_id AS leadId, status, completed_by AS completedBy FROM onboarding_checklist_items WHERE item_id = ? LIMIT 1`).get(checklistB1.body.item.itemId);
  if (!persistedOwn || persistedOwn.status !== 'completed' || persistedOwn.completedBy !== 'client') throw new Error('Own checklist completion did not persist');
  if (!persistedForeign || persistedForeign.status !== 'pending' || persistedForeign.leadId !== leadB) throw new Error('Foreign checklist item mutated unexpectedly');

  const dashboardSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'dashboard', 'page.tsx'), 'utf8');
  const checklistSectionSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'page.tsx'), 'utf8');

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadA,
    leadB,
    login,
    checklist: {
      ownCreated: [checklistA1.body.item.itemId, checklistA2.body.item.itemId],
      foreignCreated: checklistB1.body.item.itemId,
      ownCompletionRedirect: completeOwn.headers.location,
      foreignAttemptStatus: foreignAttempt.status
    },
    persisted: {
      own: persistedOwn,
      foreign: persistedForeign
    },
    surfaceChecks: {
      dashboardShowsSummaryContext: dashboardSource.includes('Resumo call:') && dashboardSource.includes('Próximo passo:') && dashboardSource.includes('Contexto comercial:'),
      dashboardUsesSessionLead: dashboardSource.includes('listChecklistItems(session.leadId)') && dashboardSource.includes('getStoredLeadById(session.leadId)'),
      cockpitChecklistSection: checklistSectionSource.includes('Checklist de onboarding T4 cycle 2'),
      portalChecklistRouteExists: fs.existsSync(path.join(webDir, 'app', 'api', 'portal', 'checklist', '[itemId]', 'route.ts'))
    },
    note: 'Verification executed against compiled route handlers and direct DB inspection. Isolation proof uses two leads and a blocked foreign completion attempt.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
NODE
