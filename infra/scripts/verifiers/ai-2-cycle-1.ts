// AI-2 Cycle 1 verifier — copilot internal surfaces + jobs list + review queue extension.
//
// Strategy: AI_USE_MOCK=1 + AI_ENABLED=true. Bootstrap admin, seed lead, hit each new route once,
// confirm the artifact is created in pending_review and shows up in the review queue with the
// correct subtype tag. Also exercise the artifact PATCH (approve flow).
//
// Scenarios:
//   A. 4 prompt templates + 1 memo template all seeded active.
//   B. Each of the 5 cockpit AI surfaces (memo-draft, research-summary, pre-call-brief,
//      follow-up-draft, pending-checklist) returns 201 with jobId + artifactId.
//   C. Each artifact lands in ai_artifacts with status=pending_review.
//   D. listReviewQueueItems returns 5 ai_artifact rows with the right subtype.
//   E. PATCH /api/cockpit/leads/.../ai/artifacts/[id] approve flow transitions to approved
//      and audit log records ai_artifact_approved.
//   F. GET /api/cockpit/leads/.../ai/jobs lists 5 jobs with cost_cents > 0 and status=succeeded.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const root = process.argv[2];
const evidenceDirArg = process.argv[3];
if (!root || !evidenceDirArg) throw new Error('Usage: node ai-2-cycle-1.ts <repoRoot> <evidenceDir>');
const evidenceDir = path.resolve(root, evidenceDirArg);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-ai2-cycle1-'));
fs.mkdirSync(path.join(tempRoot, 'data', 'dev'), { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
process.chdir(tempRoot);
process.on('exit', () => {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
});

process.env.AI_ENABLED = 'true';
process.env.AI_USE_MOCK = '1';
process.env.AI_PROVIDER = 'anthropic';
process.env.AI_MODEL = 'claude-sonnet-4-6';
process.env.COCKPIT_SECRET = 'cycle2-1-real-secret-xyz';

const require = createRequire(import.meta.url);
const webDir = path.join(root, 'apps', 'web');

function loadUserland(subpath: string) {
  return require(path.join(webDir, '.next', 'server', 'app', ...subpath.split('/'), 'route.js')).routeModule.userland;
}
async function jsonOf(res: Response) {
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : null;
  return { status: res.status, body };
}

// ---------- Boot DB + seed lead + admin session ----------
const intakeRoute = loadUserland('api/intake');
const seedResp = await jsonOf(
  await intakeRoute.POST(
    new Request('http://localhost/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: 'AI-2 cycle 1 probe',
        email: `ai2-cycle1-${Date.now()}@example.com`,
        phone: '11988887777',
        city: 'Sao Paulo',
        state: 'SP',
        investableAssetsBand: '3m_a_10m',
        primaryChallenge: 'AI-2 cycle 1 probe — copilot surfaces + review queue.',
        sourceLabel: 'verify_ai2_cycle1',
        privacyConsentAccepted: true,
        termsConsentAccepted: true
      })
    })
  )
);
if (seedResp.status !== 201) throw new Error(`seed lead failed: ${seedResp.status}`);
const leadId = (seedResp.body as { leadId: string }).leadId;
const dbPath = path.join(tempRoot, 'data', 'dev', 'savastano-advisory.sqlite3');

const bootstrapRoute = loadUserland('api/cockpit/bootstrap-admin');
const bootstrap = await jsonOf(
  await bootstrapRoute.POST(
    new Request('http://localhost/api/cockpit/bootstrap-admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `cockpit_token=${process.env.COCKPIT_SECRET}` },
      body: JSON.stringify({
        email: `cycle2-1-admin-${Date.now()}@example.com`,
        displayName: 'Cycle 2.1 Admin',
        password: 'cycle2-1-password-xyz'
      })
    })
  )
);
if (bootstrap.status !== 201) throw new Error(`bootstrap failed: ${bootstrap.status}`);
const adminUserId = (bootstrap.body as { user: { userId: string } }).user.userId;

const sessionToken = randomBytes(32).toString('hex');
{
  const seed = new DatabaseSync(dbPath);
  const now = new Date();
  seed.prepare(
    `INSERT INTO cockpit_sessions (session_id, user_id, session_token, created_at, expires_at) VALUES (?, ?, ?, ?, ?)`
  ).run(randomUUID(), adminUserId, sessionToken, now.toISOString(), new Date(now.getTime() + 86400000).toISOString());
  seed.close();
}
const sessionCookie = `cockpit_session=${sessionToken}`;

const probe: Record<string, unknown> = {};

// ---------- A. 5 prompt templates active ----------
{
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const expectedNames = [
    'memo_internal_draft',
    'research_summary',
    'pre_call_brief',
    'follow_up_draft',
    'pending_checklist'
  ];
  const rows = db.prepare(
    `SELECT name FROM ai_prompt_templates WHERE active = 1 AND name IN (${expectedNames.map(() => '?').join(',')})`
  ).all(...expectedNames) as Array<{ name: string }>;
  if (rows.length !== expectedNames.length) {
    db.close();
    throw new Error(`expected ${expectedNames.length} active templates, got ${rows.length}: ${rows.map((r) => r.name).join(', ')}`);
  }
  db.close();
  probe.activeTemplates = rows.map((r) => r.name).sort();
}

// ---------- B + C. Hit every surface ----------
const surfaces = [
  { route: 'api/cockpit/leads/[leadId]/ai/memo-draft', subtype: 'memo_draft' },
  { route: 'api/cockpit/leads/[leadId]/ai/research-summary', subtype: 'research_summary' },
  { route: 'api/cockpit/leads/[leadId]/ai/pre-call-brief', subtype: 'pre_call_brief' },
  { route: 'api/cockpit/leads/[leadId]/ai/follow-up-draft', subtype: 'follow_up_draft' },
  { route: 'api/cockpit/leads/[leadId]/ai/pending-checklist', subtype: 'pending_checklist' }
];

const surfaceResults: Record<string, { jobId: string; artifactId: string; costCents: number }> = {};
for (const surface of surfaces) {
  const handler = loadUserland(surface.route);
  const res = await jsonOf(
    await handler.POST(
      new Request(`http://localhost/${surface.route.replace('[leadId]', leadId)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify({ focusHint: `verifier ${surface.subtype}` })
      }),
      { params: Promise.resolve({ leadId }) }
    )
  );
  if (res.status !== 201) {
    throw new Error(`${surface.subtype}: expected 201, got ${res.status} ${JSON.stringify(res.body)}`);
  }
  const body = res.body as { jobId: string; artifactId: string; costCents: number; status: string };
  if (body.status !== 'pending_review') throw new Error(`${surface.subtype}: artifact status ${body.status}`);
  surfaceResults[surface.subtype] = {
    jobId: body.jobId,
    artifactId: body.artifactId,
    costCents: body.costCents
  };
}
probe.surfaceResults = surfaceResults;

// ---------- D. Review queue includes all 5 ai_artifacts with correct subtype ----------
const reviewQueueRoute = loadUserland('api/cockpit/review-queue');
const queueResp = await jsonOf(
  await reviewQueueRoute.GET(
    new Request('http://localhost/api/cockpit/review-queue', {
      method: 'GET',
      headers: { cookie: sessionCookie }
    })
  )
);
if (queueResp.status !== 200) throw new Error(`review-queue: ${queueResp.status}`);
const queueItems = (queueResp.body as { items: Array<Record<string, unknown>> }).items;
const aiItems = queueItems.filter((i) => i.type === 'ai_artifact');
if (aiItems.length !== 5) {
  throw new Error(`expected 5 ai_artifact rows in review queue, got ${aiItems.length}`);
}
const subtypes = aiItems.map((i) => String(i.subtype)).sort();
const expectedSubtypes = surfaces.map((s) => s.subtype).sort();
if (JSON.stringify(subtypes) !== JSON.stringify(expectedSubtypes)) {
  throw new Error(`subtypes mismatch: got ${subtypes.join(',')} expected ${expectedSubtypes.join(',')}`);
}
probe.reviewQueueAiCount = aiItems.length;

// ---------- E. PATCH artifact approve ----------
const artifactPatchRoute = loadUserland('api/cockpit/leads/[leadId]/ai/artifacts/[artifactId]');
const targetArtifactId = surfaceResults.memo_draft.artifactId;
const patchResp = await jsonOf(
  await artifactPatchRoute.PATCH(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/ai/artifacts/${targetArtifactId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie: sessionCookie },
      body: JSON.stringify({ status: 'approved' })
    }),
    { params: Promise.resolve({ leadId, artifactId: targetArtifactId }) }
  )
);
if (patchResp.status !== 200) throw new Error(`artifact patch: ${patchResp.status} ${JSON.stringify(patchResp.body)}`);
const patchBody = patchResp.body as { artifact: { status: string; reviewedBy: string } };
if (patchBody.artifact.status !== 'approved') throw new Error(`expected approved, got ${patchBody.artifact.status}`);
if (patchBody.artifact.reviewedBy !== adminUserId) {
  throw new Error(`expected reviewedBy=${adminUserId}, got ${patchBody.artifact.reviewedBy}`);
}

// Audit row
{
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const row = db.prepare(
    `SELECT COUNT(*) AS n FROM audit_log WHERE action = 'ai_artifact_approved' AND entity_id = ?`
  ).get(targetArtifactId) as { n: number };
  if (row.n !== 1) {
    db.close();
    throw new Error(`expected 1 ai_artifact_approved audit row for ${targetArtifactId}, got ${row.n}`);
  }
  db.close();
}
probe.artifactApprove = { artifactId: targetArtifactId, reviewedBy: patchBody.artifact.reviewedBy };

// ---------- F. GET ai/jobs lists 5 succeeded jobs ----------
const jobsRoute = loadUserland('api/cockpit/leads/[leadId]/ai/jobs');
const jobsResp = await jsonOf(
  await jobsRoute.GET(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/ai/jobs?status=succeeded&limit=20`, {
      method: 'GET',
      headers: { cookie: sessionCookie }
    }),
    { params: Promise.resolve({ leadId }) }
  )
);
if (jobsResp.status !== 200) throw new Error(`jobs list: ${jobsResp.status}`);
const jobsBody = jobsResp.body as { jobs: Array<{ jobType: string; status: string; costCents: number }> };
if (jobsBody.jobs.length !== 5) {
  throw new Error(`expected 5 succeeded jobs, got ${jobsBody.jobs.length}`);
}
const jobTypes = jobsBody.jobs.map((j) => j.jobType).sort();
const expectedJobTypes = surfaces.map((s) => s.subtype).sort();
if (JSON.stringify(jobTypes) !== JSON.stringify(expectedJobTypes)) {
  throw new Error(`jobs types mismatch: got ${jobTypes.join(',')} expected ${expectedJobTypes.join(',')}`);
}
for (const j of jobsBody.jobs) {
  if (j.status !== 'succeeded') throw new Error(`job ${j.jobType} status=${j.status}`);
  if (j.costCents <= 0) throw new Error(`job ${j.jobType} costCents=${j.costCents}`);
}
probe.jobsList = { count: jobsBody.jobs.length, types: jobTypes };

// ---------- Source-shape audit ----------
const newFiles = [
  'lib/ai/lead-surface.ts',
  'app/api/cockpit/leads/[leadId]/ai/research-summary/route.ts',
  'app/api/cockpit/leads/[leadId]/ai/pre-call-brief/route.ts',
  'app/api/cockpit/leads/[leadId]/ai/follow-up-draft/route.ts',
  'app/api/cockpit/leads/[leadId]/ai/pending-checklist/route.ts',
  'app/api/cockpit/leads/[leadId]/ai/jobs/route.ts',
  'app/api/cockpit/leads/[leadId]/ai/artifacts/[artifactId]/route.ts'
];
const sourceShape: Record<string, boolean> = {};
for (const f of newFiles) {
  sourceShape[f] = fs.existsSync(path.join(webDir, f));
  if (!sourceShape[f]) throw new Error(`missing: ${f}`);
}

// Review queue panel has IA badge
const panelSrc = fs.readFileSync(
  path.join(webDir, 'app', 'cockpit', 'review-queue', 'review-queue-panel.tsx'),
  'utf8'
);
const panelChecks = {
  hasIaBadge: /IA<\/span>/.test(panelSrc) || />IA</.test(panelSrc),
  handlesAiArtifactPatch: /\/ai\/artifacts\//.test(panelSrc)
};
for (const [k, v] of Object.entries(panelChecks)) {
  if (!v) throw new Error(`review-queue-panel.tsx check failed: ${k}`);
}
probe.panelChecks = panelChecks;

// ---------- Summary ----------
const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  leadId,
  probe,
  sourceShape,
  note:
    'AI-2 Cycle 1: 4 new prompt templates seeded (research_summary, pre_call_brief, follow_up_draft, pending_checklist) plus existing memo_internal_draft; 5 cockpit AI surfaces share the same lead-surface helper and create artifacts in pending_review; review queue lists ai_artifacts alongside memos with subtype label; artifact PATCH approves transitions correctly with audit row; GET ai/jobs returns 5 succeeded jobs with costCents > 0.'
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
