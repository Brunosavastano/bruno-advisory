#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T4-cycle-4}"
mkdir -p "$EVIDENCE_DIR"

if [ ! -f "apps/web/.next/server/app/api/intake/route.js" ] || [ ! -f "apps/web/.next/server/app/api/portal/recommendations/route.js" ]; then
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
  [ "$build_ok" -eq 1 ]
fi

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
  const portalSessionRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'session', 'route.js')).routeModule.userland;
  const cockpitRecommendationsRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'recommendations', 'route.js')).routeModule.userland;
  const cockpitRecommendationItemRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'recommendations', '[recommendationId]', 'route.js')).routeModule.userland;
  const portalRecommendationsRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'recommendations', 'route.js')).routeModule.userland;

  async function createLead(label) {
    const response = await json(await intakeRoute.POST(new Request('http://localhost/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: `T4 Cycle 4 ${label}`,
        email: `t4-cycle4-${label}-${randomUUID()}@example.com`,
        phone: '11999990000',
        city: 'Brasilia',
        state: 'DF',
        investableAssetsBand: '3m_a_10m',
        primaryChallenge: 'Acompanhar recommendation ledger',
        sourceLabel: `verify_t4_cycle_4_${label}`,
        privacyConsentAccepted: true,
        termsConsentAccepted: true
      })
    })));
    if (response.status !== 201 || !response.body?.leadId) throw new Error(`Lead creation failed for ${label}`);
    return response.body.leadId;
  }

  async function loginForLead(leadId) {
    const invite = await json(await inviteRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/portal-invite-codes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    }), { params: Promise.resolve({ leadId }) }));
    if (invite.status !== 200 || !invite.body?.invite?.code) throw new Error(`Invite creation failed for ${leadId}`);

    const loginForm = new FormData();
    loginForm.set('code', invite.body.invite.code);
    const login = await json(await portalSessionRoute.POST(new Request('http://localhost/api/portal/session', { method: 'POST', body: loginForm })));
    const sessionCookie = login.headers['set-cookie'] || '';
    if (login.status !== 302 || !sessionCookie.includes('portal_session=')) throw new Error(`Portal login failed for ${leadId}`);
    return { invite, login, sessionCookie };
  }

  const leadA = await createLead('lead-a');
  const leadB = await createLead('lead-b');
  const authA = await loginForLead(leadA);
  const authB = await loginForLead(leadB);

  const createRecommendation = await json(await cockpitRecommendationsRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadA}/recommendations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Ajuste tático de caixa',
      body: 'Elevar reserva tática para 12 meses e reduzir duration no bloco prefixado.',
      recommendationDate: '2026-04-14',
      category: 'risk_management',
      createdBy: 'operator_local'
    })
  }), { params: Promise.resolve({ leadId: leadA }) }));
  if (createRecommendation.status !== 201 || !createRecommendation.body?.recommendation?.recommendationId) {
    throw new Error('Recommendation creation failed');
  }

  const recommendationId = createRecommendation.body.recommendation.recommendationId;
  const publishRecommendation = await json(await cockpitRecommendationItemRoute.PATCH(new Request(`http://localhost/api/cockpit/leads/${leadA}/recommendations/${recommendationId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  }), { params: Promise.resolve({ leadId: leadA, recommendationId }) }));
  if (publishRecommendation.status !== 200 || publishRecommendation.body?.recommendation?.visibility !== 'published') {
    throw new Error('Recommendation publish failed');
  }

  const ownPortalLedger = await json(await portalRecommendationsRoute.GET(new Request('http://localhost/api/portal/recommendations', {
    method: 'GET',
    headers: { cookie: authA.sessionCookie }
  })));
  if (ownPortalLedger.status !== 200 || !Array.isArray(ownPortalLedger.body?.recommendations) || ownPortalLedger.body.recommendations.length !== 1) {
    throw new Error('Own portal ledger read failed');
  }

  const foreignPortalLedger = await json(await portalRecommendationsRoute.GET(new Request('http://localhost/api/portal/recommendations', {
    method: 'GET',
    headers: { cookie: authB.sessionCookie }
  })));
  if (foreignPortalLedger.status !== 200 || !Array.isArray(foreignPortalLedger.body?.recommendations) || foreignPortalLedger.body.recommendations.length !== 0) {
    throw new Error('Foreign portal ledger leakage detected');
  }

  const db = new DatabaseSync(path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3'));
  const persisted = db.prepare(`
    SELECT
      lead_id AS leadId,
      title,
      body,
      recommendation_date AS recommendationDate,
      visibility,
      created_at AS createdAt,
      published_at AS publishedAt,
      created_by AS createdBy
    FROM lead_recommendations
    WHERE recommendation_id = ?
    LIMIT 1
  `).get(recommendationId);
  if (!persisted || persisted.leadId !== leadA || persisted.recommendationDate !== '2026-04-14') {
    throw new Error('Recommendation persistence audit failed');
  }

  const cockpitLeadPageSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'page.tsx'), 'utf8');
  const portalLedgerPageSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'ledger', 'page.tsx'), 'utf8');

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadA,
    leadB,
    loginA: authA.login,
    loginB: authB.login,
    createRecommendation,
    publishRecommendation,
    ownPortalLedger,
    foreignPortalLedger,
    persisted,
    surfaceChecks: {
      cockpitHasLedgerSection: cockpitLeadPageSource.includes('Recommendation ledger T4 cycle 4') && cockpitLeadPageSource.includes('recommendationDate'),
      portalUsesPublishedOwnLedger: portalLedgerPageSource.includes("listRecommendations(session.leadId, 'published')"),
      portalReadOnly: !portalLedgerPageSource.includes('<form'),
      portalRecommendationsRouteExists: fs.existsSync(path.join(webDir, 'app', 'api', 'portal', 'recommendations', 'route.ts'))
    },
    note: 'Verification executed against compiled cockpit and portal route handlers, direct SQLite inspection, and explicit two-session isolation proof.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
NODE
