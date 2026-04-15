#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T5-cycle-3}"
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
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t5-cycle3-'));
  fs.mkdirSync(path.join(tempRoot, 'data', 'dev'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
  fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
  fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
  process.chdir(tempRoot);
  process.on('exit', () => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const intakeRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js'));
  const cockpitResearchRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'research-workflows', 'route.js'));
  const cockpitMemosRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'memos', 'route.js'));
  const reviewQueueRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'review-queue', 'route.js'));

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
        primaryChallenge: 'Quero revisão humana unificada para research e memos.',
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

  async function patchWorkflow(leadId, payload) {
    const response = await json(await cockpitResearchRoute.PATCH(new Request(`http://localhost/api/cockpit/leads/${leadId}/research-workflows`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }), { params: Promise.resolve({ leadId }) }));

    if (response.status !== 200 || !response.body?.workflow?.id) {
      throw new Error(`Workflow patch failed: ${JSON.stringify(response)}`);
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

  async function getQueue() {
    const response = await json(await reviewQueueRoute.GET(new Request('http://localhost/api/cockpit/review-queue', { method: 'GET' })));
    if (response.status !== 200 || !Array.isArray(response.body?.items)) {
      throw new Error(`Review queue GET failed: ${JSON.stringify(response)}`);
    }
    return response.body.items;
  }

  const leadId = await createLead('verify_t5_cycle_3', 'T5 Cycle 3 Lead', 't5-cycle3');

  const workflow = await createWorkflow(leadId, 'Research aguardando revisão', 'Tese macro para revisão humana');
  const workflowInReview = await patchWorkflow(leadId, { id: workflow.id, status: 'review' });

  const memo = await createMemo(leadId, {
    title: 'Memo aguardando revisão',
    body: 'Texto inicial do memo a ser revisado.',
    researchWorkflowId: workflow.id
  });
  const memoInReview = await patchMemo(leadId, {
    id: memo.id,
    body: 'Texto final do memo antes da aprovação.',
    status: 'pending_review'
  });

  const queueBefore = await getQueue();
  const queueTypes = queueBefore.map((item) => item.type).sort();
  if (queueBefore.length !== 2 || queueTypes.join(',') !== 'memo,research_workflow') {
    throw new Error(`Unexpected review queue contents before actions: ${JSON.stringify(queueBefore)}`);
  }

  const approvedMemo = await patchMemo(leadId, { id: memo.id, status: 'approved' });
  if (approvedMemo.status !== 'approved' || !approvedMemo.reviewedAt) {
    throw new Error(`Memo approval did not persist correctly: ${JSON.stringify(approvedMemo)}`);
  }

  const rejectionReason = 'Hipótese central insuficientemente suportada para aprovação.';
  const rejectedWorkflow = await patchWorkflow(leadId, {
    id: workflow.id,
    status: 'rejected',
    rejectionReason
  });
  if (rejectedWorkflow.status !== 'rejected' || rejectedWorkflow.reviewRejectionReason !== rejectionReason) {
    throw new Error(`Workflow rejection did not persist correctly: ${JSON.stringify(rejectedWorkflow)}`);
  }

  const queueAfter = await getQueue();
  if (queueAfter.length !== 0) {
    throw new Error(`Review queue should be empty after actions: ${JSON.stringify(queueAfter)}`);
  }

  const dbPath = path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3');
  const db = new DatabaseSync(dbPath);
  const memoRow = db.prepare(`
    SELECT id, status, review_rejection_reason AS reviewRejectionReason, reviewed_at AS reviewedAt
    FROM memos
    WHERE id = ?
    LIMIT 1
  `).get(memo.id);
  const workflowRow = db.prepare(`
    SELECT id, status, review_rejection_reason AS reviewRejectionReason, reviewed_at AS reviewedAt
    FROM research_workflows
    WHERE id = ?
    LIMIT 1
  `).get(workflow.id);
  const memoEvents = db.prepare(`
    SELECT id, entity_id AS entityId, action, reason, created_at AS createdAt
    FROM memo_events
    WHERE entity_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(memo.id);
  const workflowEvents = db.prepare(`
    SELECT id, entity_id AS entityId, action, reason, created_at AS createdAt
    FROM research_workflow_events
    WHERE entity_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(workflow.id);

  if (!memoRow || memoRow.status !== 'approved' || !memoRow.reviewedAt) {
    throw new Error(`Memo DB row invalid after approval: ${JSON.stringify(memoRow)}`);
  }
  if (!workflowRow || workflowRow.status !== 'rejected' || workflowRow.reviewRejectionReason !== rejectionReason) {
    throw new Error(`Workflow DB row invalid after rejection: ${JSON.stringify(workflowRow)}`);
  }
  if (!Array.isArray(memoEvents) || memoEvents.length < 1 || memoEvents[0].action !== 'approved') {
    throw new Error(`Memo approval event missing: ${JSON.stringify(memoEvents)}`);
  }
  if (!Array.isArray(workflowEvents) || workflowEvents.length < 1 || workflowEvents[0].action !== 'rejected' || workflowEvents[0].reason !== rejectionReason) {
    throw new Error(`Workflow rejection event missing: ${JSON.stringify(workflowEvents)}`);
  }

  const appRoutesManifestPath = path.join(webDir, '.next', 'app-path-routes-manifest.json');
  const appRoutes = JSON.parse(fs.readFileSync(appRoutesManifestPath, 'utf8'));
  const queuePageSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'review-queue', 'page.tsx'), 'utf8');
  const queuePanelSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'review-queue', 'review-queue-panel.tsx'), 'utf8');
  const queueRouteSource = fs.readFileSync(path.join(webDir, 'app', 'api', 'cockpit', 'review-queue', 'route.ts'), 'utf8');

  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadId,
    memoInReview,
    workflowInReview,
    approvedMemo,
    rejectedWorkflow,
    queueBefore,
    queueAfter,
    dbPath,
    memoRow,
    workflowRow,
    memoEvents,
    workflowEvents,
    surfaceChecks: {
      reviewQueueRoutePresent: Object.values(appRoutes).includes('/api/cockpit/review-queue'),
      reviewQueuePagePresent: Object.values(appRoutes).includes('/cockpit/review-queue'),
      queuePageRendersPanel: queuePageSource.includes('ReviewQueuePanel'),
      queuePanelHasApproveAndReject: queuePanelSource.includes('Aprovar') && queuePanelSource.includes('Rejeitar'),
      queueRouteListsItems: queueRouteSource.includes('listReviewQueueItems') && queueRouteSource.includes('items')
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
