#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T4-cycle-4}"
mkdir -p "$EVIDENCE_DIR"

rm -rf apps/web/.next
bash -lc 'build_ok=0; for attempt in 1 2 3; do if npm run build >/dev/null; then build_ok=1; break; fi; if [ "$attempt" -lt 3 ]; then rm -rf apps/web/.next; sleep 2; fi; done; [ "$build_ok" -eq 1 ]'

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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t4-cycle4-'));
  const requireFromWeb = createRequire(path.join(webDir, 'package.json'));

  fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
  fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
  fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
  process.chdir(tempRoot);
  process.on('exit', () => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const intakeRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js')).routeModule.userland;
  const inviteRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'portal-invite-codes', 'route.js')).routeModule.userland;
  const createListRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'recommendations', 'route.js')).routeModule.userland;
  const itemRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'recommendations', '[recommendationId]', 'route.js')).routeModule.userland;
  const portalSessionRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'session', 'route.js')).routeModule.userland;
  const portalRecommendationsRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'recommendations', 'route.js')).routeModule.userland;

  const leadRes = await json(await intakeRoute.POST(new Request('http://localhost/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'T4 Cycle 4 Ledger',
      email: `t4-cycle4-${randomUUID()}@example.com`,
      phone: '11999990000',
      city: 'Brasilia',
      state: 'DF',
      investableAssetsBand: '3m_a_10m',
      primaryChallenge: 'Receber recomendacoes no portal',
      sourceLabel: 'verify_t4_cycle_4',
      privacyConsentAccepted: true,
      termsConsentAccepted: true
    })
  })));
  if (leadRes.status !== 201 || !leadRes.body?.leadId) throw new Error('Lead creation failed');
  const leadId = leadRes.body.leadId;

  const createDraft = await json(await createListRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/recommendations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Recomendação inicial',
      body: 'Manter reserva tática e revisar risco global.',
      category: 'risk_management',
      createdBy: 'verifier_local'
    })
  }), { params: Promise.resolve({ leadId }) }));
  if (createDraft.status !== 201 || createDraft.body?.recommendation?.visibility !== 'draft') {
    throw new Error('Recommendation draft creation failed');
  }
  const recommendationId = createDraft.body.recommendation.recommendationId;

  const cockpitListWithDraft = await json(await createListRoute.GET(new Request(`http://localhost/api/cockpit/leads/${leadId}/recommendations`), {
    params: Promise.resolve({ leadId })
  }));
  if (cockpitListWithDraft.status !== 200 || !cockpitListWithDraft.body?.recommendations?.some((item) => item.recommendationId === recommendationId && item.visibility === 'draft')) {
    throw new Error('Cockpit recommendation list missing draft');
  }

  const portalUnauthorized = await json(await portalRecommendationsRoute.GET(new Request('http://localhost/api/portal/recommendations')));
  if (portalUnauthorized.status !== 401) throw new Error('Portal recommendations should require session');

  const invite = await json(await inviteRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/portal-invite-codes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  }), { params: Promise.resolve({ leadId }) }));
  if (invite.status !== 200 || !invite.body?.invite?.code) throw new Error('Invite creation failed');

  const loginForm = new FormData();
  loginForm.set('code', invite.body.invite.code);
  const login = await json(await portalSessionRoute.POST(new Request('http://localhost/api/portal/session', { method: 'POST', body: loginForm })));
  const sessionCookie = login.headers['set-cookie'] || '';
  if (login.status !== 302 || !sessionCookie.includes('portal_session=')) throw new Error('Portal login failed');

  const portalBeforePublish = await json(await portalRecommendationsRoute.GET(new Request('http://localhost/api/portal/recommendations', {
    method: 'GET',
    headers: { cookie: sessionCookie }
  })));
  if (portalBeforePublish.status !== 200 || !Array.isArray(portalBeforePublish.body?.recommendations) || portalBeforePublish.body.recommendations.length !== 0) {
    throw new Error('Portal should not expose draft recommendations');
  }

  const publish = await json(await itemRoute.PATCH(new Request(`http://localhost/api/cockpit/leads/${leadId}/recommendations/${recommendationId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  }), { params: Promise.resolve({ leadId, recommendationId }) }));
  if (publish.status !== 200 || publish.body?.recommendation?.visibility !== 'published') {
    throw new Error('Recommendation publish failed');
  }

  const portalAfterPublish = await json(await portalRecommendationsRoute.GET(new Request('http://localhost/api/portal/recommendations', {
    method: 'GET',
    headers: { cookie: sessionCookie }
  })));
  if (portalAfterPublish.status !== 200 || !portalAfterPublish.body?.recommendations?.some((item) => item.recommendationId === recommendationId && item.visibility === 'published')) {
    throw new Error('Portal published recommendation fetch failed');
  }

  const deleted = await json(await itemRoute.DELETE(new Request(`http://localhost/api/cockpit/leads/${leadId}/recommendations/${recommendationId}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  }), { params: Promise.resolve({ leadId, recommendationId }) }));
  if (deleted.status !== 200 || deleted.body?.ok !== true) {
    throw new Error('Recommendation delete failed');
  }

  const cockpitListAfterDelete = await json(await createListRoute.GET(new Request(`http://localhost/api/cockpit/leads/${leadId}/recommendations`), {
    params: Promise.resolve({ leadId })
  }));
  if (cockpitListAfterDelete.status !== 200 || cockpitListAfterDelete.body?.recommendations?.some((item) => item.recommendationId === recommendationId)) {
    throw new Error('Recommendation still visible after delete');
  }

  const db = new DatabaseSync(path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3'));
  const persistedCount = db.prepare('SELECT COUNT(*) AS count FROM lead_recommendations WHERE lead_id = ?').get(leadId).count;

  const portalLedgerPageSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'ledger', 'page.tsx'), 'utf8');
  const cockpitLeadPageSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'page.tsx'), 'utf8');
  const dashboardPageSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'dashboard', 'page.tsx'), 'utf8');

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadId,
    createDraft,
    cockpitListWithDraft,
    portalUnauthorized,
    portalBeforePublish,
    publish,
    portalAfterPublish,
    deleted,
    cockpitListAfterDelete,
    persistedCount,
    surfaceChecks: {
      portalLedgerPageExists: fs.existsSync(path.join(webDir, 'app', 'portal', 'ledger', 'page.tsx')),
      portalLedgerUsesPublishedOnly: portalLedgerPageSource.includes("listRecommendations(session.leadId, 'published')"),
      cockpitLeadShowsRecommendations: cockpitLeadPageSource.includes('Recommendation ledger T4 cycle 4'),
      dashboardLinksLedger: dashboardPageSource.includes('/portal/ledger')
    },
    note: 'Verification executed against compiled route handlers, portal session auth, SQLite inspection and source-surface checks.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
NODE
