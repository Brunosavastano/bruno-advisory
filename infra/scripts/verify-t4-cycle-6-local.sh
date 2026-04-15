#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T4-cycle-6}"
mkdir -p "$EVIDENCE_DIR"

rm -rf apps/web/.next
mkdir -p apps/web/.next/static
npm run build >/dev/null

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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t4-cycle6-'));
  const requireFromWeb = createRequire(path.join(webDir, 'package.json'));

  fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
  fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
  fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
  process.chdir(tempRoot);
  process.on('exit', () => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const intakeRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js')).routeModule.userland;
  const inviteRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'portal-invite-codes', 'route.js')).routeModule.userland;
  const revokeInviteRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'portal-invite-codes', '[inviteId]', 'revoke', 'route.js')).routeModule.userland;
  const checklistRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'checklist', 'route.js')).routeModule.userland;
  const cockpitDocumentsRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'documents', 'route.js')).routeModule.userland;
  const cockpitRecommendationsRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'recommendations', 'route.js')).routeModule.userland;
  const cockpitRecommendationItemRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'recommendations', '[recommendationId]', 'route.js')).routeModule.userland;
  const cockpitLeadFlagsRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'flags', 'route.js')).routeModule.userland;
  const cockpitFlagsOverviewRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'flags', 'route.js')).routeModule.userland;
  const portalSessionRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'session', 'route.js')).routeModule.userland;
  const portalChecklistItemRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'checklist', '[itemId]', 'route.js')).routeModule.userland;
  const portalDocumentsRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'documents', 'route.js')).routeModule.userland;
  const portalRecommendationsRoute = requireFromWeb(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'recommendations', 'route.js')).routeModule.userland;

  async function createLead(label) {
    const res = await json(await intakeRoute.POST(new Request('http://localhost/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: `T4 Cycle 6 ${label}`,
        email: `t4-cycle6-${label}-${randomUUID()}@example.com`,
        phone: '11999990000',
        city: 'Brasilia',
        state: 'DF',
        investableAssetsBand: '3m_a_10m',
        primaryChallenge: 'Executar fluxo completo do portal com evidência local',
        sourceLabel: `verify_t4_cycle_6_${label}`,
        privacyConsentAccepted: true,
        termsConsentAccepted: true
      })
    })));
    if (res.status !== 201 || !res.body?.leadId) throw new Error(`Lead creation failed for ${label}`);
    return res.body.leadId;
  }

  async function createInvite(leadId) {
    const res = await json(await inviteRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/portal-invite-codes`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({})
    }), { params: Promise.resolve({ leadId }) }));
    if (res.status !== 200 || !res.body?.invite?.code || !res.body?.invite?.inviteId) throw new Error(`Invite creation failed for ${leadId}`);
    return res.body.invite;
  }

  async function loginWithInvite(code) {
    const form = new FormData();
    form.set('code', code);
    const res = await json(await portalSessionRoute.POST(new Request('http://localhost/api/portal/session', { method: 'POST', body: form })));
    const sessionCookie = res.headers['set-cookie'] || '';
    if (res.status !== 302 || !sessionCookie.includes('portal_session=')) throw new Error('Portal login failed');
    return { login: res, sessionCookie };
  }

  const leadA = await createLead('lead-a');
  const leadB = await createLead('lead-b');

  const inviteA = await createInvite(leadA);
  const inviteB = await createInvite(leadB);
  const revokedInviteA = await createInvite(leadA);

  const authA = await loginWithInvite(inviteA.code);
  const authB = await loginWithInvite(inviteB.code);

  const revokeInvite = await json(await revokeInviteRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadA}/portal-invite-codes/${revokedInviteA.inviteId}/revoke`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({})
  }), { params: Promise.resolve({ inviteId: revokedInviteA.inviteId }) }));
  if (revokeInvite.status !== 200 || revokeInvite.body?.invite?.status !== 'revoked') throw new Error('Invite revoke failed');

  const checklistCreate = await json(await checklistRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadA}/checklist`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Enviar RG atualizado', description: 'Upload do RG frente e verso.' })
  }), { params: Promise.resolve({ leadId: leadA }) }));
  const checklistForeign = await json(await checklistRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadB}/checklist`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Checklist outro lead', description: 'Nao deve aparecer para lead A.' })
  }), { params: Promise.resolve({ leadId: leadB }) }));
  if (checklistCreate.status !== 201 || checklistForeign.status !== 201) throw new Error('Checklist creation failed');

  const ownChecklistComplete = await json(await portalChecklistItemRoute.POST(new Request(`http://localhost/api/portal/checklist/${checklistCreate.body.item.itemId}`, {
    method: 'POST', headers: { cookie: authA.sessionCookie }, body: (() => { const f = new FormData(); f.set('returnTo', '/portal/dashboard'); return f; })()
  }), { params: Promise.resolve({ itemId: checklistCreate.body.item.itemId }) }));
  if (ownChecklistComplete.status !== 303) throw new Error('Own checklist completion failed');

  const foreignChecklistAttempt = await json(await portalChecklistItemRoute.POST(new Request(`http://localhost/api/portal/checklist/${checklistForeign.body.item.itemId}`, {
    method: 'POST', headers: { cookie: authA.sessionCookie }, body: new FormData()
  }), { params: Promise.resolve({ itemId: checklistForeign.body.item.itemId }) }));
  if (foreignChecklistAttempt.status !== 403) throw new Error('Foreign checklist isolation failed');

  const uploadForm = new FormData();
  uploadForm.set('file', new File(['documento portal cycle 6'], 'rg-cycle-6.pdf', { type: 'application/pdf' }));
  const documentUpload = await json(await portalDocumentsRoute.POST(new Request('http://localhost/api/portal/documents', {
    method: 'POST', headers: { cookie: authA.sessionCookie }, body: uploadForm
  })));
  if (documentUpload.status !== 201 || !documentUpload.body?.document?.documentId) throw new Error('Portal document upload failed');

  const portalDocumentsOwn = await json(await portalDocumentsRoute.GET(new Request('http://localhost/api/portal/documents', {
    method: 'GET', headers: { cookie: authA.sessionCookie }
  })));
  const portalDocumentsForeign = await json(await portalDocumentsRoute.GET(new Request('http://localhost/api/portal/documents', {
    method: 'GET', headers: { cookie: authB.sessionCookie }
  })));
  if (portalDocumentsOwn.status !== 200 || portalDocumentsOwn.body?.documents?.length !== 1) throw new Error('Own portal documents list failed');
  if (portalDocumentsForeign.status !== 200 || portalDocumentsForeign.body?.documents?.length !== 0) throw new Error('Portal document isolation failed');

  const cockpitDocuments = await json(await cockpitDocumentsRoute.GET(new Request(`http://localhost/api/cockpit/leads/${leadA}/documents`), {
    params: Promise.resolve({ leadId: leadA })
  }));
  if (cockpitDocuments.status !== 200 || cockpitDocuments.body?.documents?.length !== 1) throw new Error('Cockpit documents view failed');

  const createRecommendation = await json(await cockpitRecommendationsRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadA}/recommendations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Rebalanceamento de caixa tático',
      body: 'Elevar caixa de segurança e reduzir duration prefixada.',
      recommendationDate: '2026-04-14',
      category: 'risk_management',
      createdBy: 'operator_local'
    })
  }), { params: Promise.resolve({ leadId: leadA }) }));
  if (createRecommendation.status !== 201 || !createRecommendation.body?.recommendation?.recommendationId) throw new Error('Recommendation creation failed');

  const recommendationId = createRecommendation.body.recommendation.recommendationId;
  const publishRecommendation = await json(await cockpitRecommendationItemRoute.PATCH(new Request(`http://localhost/api/cockpit/leads/${leadA}/recommendations/${recommendationId}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({})
  }), { params: Promise.resolve({ leadId: leadA, recommendationId }) }));
  if (publishRecommendation.status !== 200 || publishRecommendation.body?.recommendation?.visibility !== 'published') throw new Error('Recommendation publish failed');

  const portalLedgerOwn = await json(await portalRecommendationsRoute.GET(new Request('http://localhost/api/portal/recommendations', {
    method: 'GET', headers: { cookie: authA.sessionCookie }
  })));
  const portalLedgerForeign = await json(await portalRecommendationsRoute.GET(new Request('http://localhost/api/portal/recommendations', {
    method: 'GET', headers: { cookie: authB.sessionCookie }
  })));
  if (portalLedgerOwn.status !== 200 || portalLedgerOwn.body?.recommendations?.length !== 1) throw new Error('Own portal ledger failed');
  if (portalLedgerForeign.status !== 200 || portalLedgerForeign.body?.recommendations?.length !== 0) throw new Error('Portal ledger isolation failed');

  const setPendingFlag = await json(await cockpitLeadFlagsRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadA}/flags`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ flagType: 'pending_document', note: 'Aguardando comprovante complementar', setBy: 'operator_local' })
  }), { params: Promise.resolve({ leadId: leadA }) }));
  if (setPendingFlag.status !== 201) throw new Error('Pending flag create failed');

  const cockpitFlagsOverview = await json(await cockpitFlagsOverviewRoute.GET(new Request('http://localhost/api/cockpit/flags')));
  const overviewLead = cockpitFlagsOverview.body?.leads?.find((entry) => entry.leadId === leadA);
  if (cockpitFlagsOverview.status !== 200 || !overviewLead || !Array.isArray(overviewLead.flags) || overviewLead.flags.length < 1) {
    throw new Error('Pending flags overview failed');
  }

  const db = new DatabaseSync(path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3'));
  const checklistPersisted = db.prepare(`SELECT item_id AS itemId, lead_id AS leadId, status, completed_by AS completedBy FROM onboarding_checklist_items WHERE item_id = ? LIMIT 1`).get(checklistCreate.body.item.itemId);
  const documentPersisted = db.prepare(`SELECT document_id AS documentId, lead_id AS leadId, original_filename AS originalFilename, stored_filename AS storedFilename, status FROM lead_documents WHERE document_id = ? LIMIT 1`).get(documentUpload.body.document.documentId);
  const recommendationPersisted = db.prepare(`SELECT recommendation_id AS recommendationId, lead_id AS leadId, visibility, recommendation_date AS recommendationDate, published_at AS publishedAt FROM lead_recommendations WHERE recommendation_id = ? LIMIT 1`).get(recommendationId);
  const pendingFlagPersisted = db.prepare(`SELECT lead_id AS leadId, flag_type AS flagType, note, set_by AS setBy, cleared_at AS clearedAt FROM lead_pending_flags WHERE lead_id = ? AND flag_type = 'pending_document' ORDER BY set_at DESC LIMIT 1`).get(leadA);
  const revokedInviteSessions = db.prepare(`SELECT COUNT(*) AS count FROM portal_sessions WHERE invite_id = ?`).get(revokedInviteA.inviteId);

  const dashboardSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'dashboard', 'page.tsx'), 'utf8');
  const documentsSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'documents', 'page.tsx'), 'utf8');
  const ledgerSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'ledger', 'page.tsx'), 'utf8');
  const cockpitFlagsPageSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'flags', 'page.tsx'), 'utf8');
  const cockpitLeadPageSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'page.tsx'), 'utf8');
  const cockpitFlagPanelSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'lead-flags-panel.tsx'), 'utf8');

  const summary = {
    ok:
      checklistPersisted?.status === 'completed' &&
      checklistPersisted?.completedBy === 'client' &&
      documentPersisted?.leadId === leadA &&
      recommendationPersisted?.visibility === 'published' &&
      recommendationPersisted?.recommendationDate === '2026-04-14' &&
      pendingFlagPersisted?.leadId === leadA &&
      pendingFlagPersisted?.clearedAt === null &&
      revokedInviteSessions?.count === 0,
    checkedAt: new Date().toISOString(),
    leadA,
    leadB,
    clientFlow: {
      inviteA,
      loginA: authA.login,
      ownChecklistComplete,
      foreignChecklistAttempt,
      documentUpload,
      portalDocumentsOwn,
      portalDocumentsForeign,
      portalLedgerOwn,
      portalLedgerForeign
    },
    operatorFlow: {
      inviteB,
      revokedInviteA,
      revokeInvite,
      cockpitDocuments,
      createRecommendation,
      publishRecommendation,
      setPendingFlag,
      cockpitFlagsOverview
    },
    persisted: {
      checklistPersisted,
      documentPersisted,
      recommendationPersisted,
      pendingFlagPersisted,
      revokedInviteSessions
    },
    portalInvisibilityProof: {
      ownLeadDashboardLeaksFlags: /pending_document|pending_call|pending_payment/.test(dashboardSource),
      ownLeadDocumentsLeaksFlags: /pending_document|pending_call|pending_payment/.test(documentsSource),
      ownLeadLedgerLeaksFlags: /pending_document|pending_call|pending_payment/.test(ledgerSource)
    },
    surfaceChecks: {
      dashboardUsesSessionLead: dashboardSource.includes('session.leadId'),
      documentsUsesSessionLead: documentsSource.includes('session.leadId'),
      ledgerUsesPublishedOwnLead: ledgerSource.includes("listRecommendations(session.leadId, 'published')"),
      cockpitFlagsOverviewPageExists: cockpitFlagsPageSource.includes('Internal pending flags'),
      cockpitLeadHasFlagPanel: cockpitLeadPageSource.includes('LeadFlagsPanel') && cockpitFlagPanelSource.includes('Internal pending flags T4 cycle 5')
    },
    note: 'Cycle 6 verifier executes real compiled cockpit and portal handlers end-to-end inside an isolated temp project root, then audits SQLite persistence and portal invisibility.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (!summary.ok) process.exit(1);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
NODE
