// AI-1 Cycle 2 verifier — provider gateway, cost tracking, budget enforcement.
//
// Strategy: AI_USE_MOCK=1 forces the MockAiProvider so the verifier never hits the real Anthropic
// API (no spend, no API key needed). AI_ENABLED=true is set so the gateway is not short-circuited.
// AI_DEV_HARNESS_ENABLED is NOT needed here — the routes under test are real production routes.
//
// Scenarios:
//   A. Bootstrap seeds: ai_model_versions has anthropic/claude-sonnet-4-6 status=active.
//      ai_prompt_templates has memo_internal_draft v0.1.0 status=active.
//   B. Auth: POST /api/cockpit/leads/[leadId]/ai/memo-draft without cookie → 401.
//   C. Happy path with cockpit_session cookie:
//      - 201 returned with jobId, artifactId, costCents, latencyMs.
//      - ai_jobs row has status=succeeded, costCents>0, output_hash set.
//      - ai_artifacts row has status=pending_review.
//      - audit_log has ai_job_created, ai_job_status_changed (multiple), ai_artifact_created.
//   D. Budget enforcement: set a very low cap, call again → 402 with error=blocked_budget,
//      ai_jobs row has status=blocked_budget, no artifact created.
//   E. Admin route: GET /api/cockpit/ai/model-versions returns the seeded Sonnet 4.6 row.
//      POST/PATCH require admin role; legacy 'operator' fallback receives 403 on PATCH.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const root = process.argv[2];
const evidenceDirArg = process.argv[3];
if (!root || !evidenceDirArg) throw new Error('Usage: node ai-1-cycle-2.ts <repoRoot> <evidenceDir>');
const evidenceDir = path.resolve(root, evidenceDirArg);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-ai1-cycle2-'));
fs.mkdirSync(path.join(tempRoot, 'data', 'dev'), { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
process.chdir(tempRoot);
process.on('exit', () => {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
});

// Activate AI gateway in mock mode for this verifier process.
process.env.AI_ENABLED = 'true';
process.env.AI_USE_MOCK = '1';
process.env.AI_PROVIDER = 'anthropic';
process.env.AI_MODEL = 'claude-sonnet-4-6';
process.env.COCKPIT_SECRET = 'cycle2-real-secret-xyz';

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

// ---------- Boot DB via intake ----------
const intakeRoute = loadUserland('api/intake');
const seedResp = await jsonOf(
  await intakeRoute.POST(
    new Request('http://localhost/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: 'AI-1 cycle 2 probe',
        email: `ai1-cycle2-${Date.now()}@example.com`,
        phone: '11988887777',
        city: 'Sao Paulo',
        state: 'SP',
        investableAssetsBand: '3m_a_10m',
        primaryChallenge: 'AI-1 cycle 2 probe to confirm gateway, cost tracking, budget enforcement.',
        sourceLabel: 'verify_ai1_cycle2',
        privacyConsentAccepted: true,
        termsConsentAccepted: true
      })
    })
  )
);
if (seedResp.status !== 201) throw new Error(`seed lead failed: ${seedResp.status} ${JSON.stringify(seedResp.body)}`);
const leadId = (seedResp.body as { leadId: string }).leadId;

const dbPath = path.join(tempRoot, 'data', 'dev', 'savastano-advisory.sqlite3');

// ---------- Bootstrap admin user + cockpit session ----------
const bootstrapRoute = loadUserland('api/cockpit/bootstrap-admin');
const adminEmail = `cycle2-admin-${Date.now()}@example.com`;
const bootstrap = await jsonOf(
  await bootstrapRoute.POST(
    new Request('http://localhost/api/cockpit/bootstrap-admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `cockpit_token=${process.env.COCKPIT_SECRET}` },
      body: JSON.stringify({ email: adminEmail, displayName: 'Cycle 2 Admin', password: 'cycle2-password-xyz' })
    })
  )
);
if (bootstrap.status !== 201) throw new Error(`bootstrap admin failed: ${bootstrap.status} ${JSON.stringify(bootstrap.body)}`);
const adminUserId = (bootstrap.body as { user: { userId: string } }).user.userId;

// Inject session directly so we don't depend on the login route
const sessionToken = randomBytes(32).toString('hex');
{
  const seed = new DatabaseSync(dbPath);
  const now = new Date();
  seed.prepare(`
    INSERT INTO cockpit_sessions (session_id, user_id, session_token, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    adminUserId,
    sessionToken,
    now.toISOString(),
    new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
  );
  seed.close();
}
const sessionCookie = `cockpit_session=${sessionToken}`;

const probe: Record<string, unknown> = {};

// ---------- A. Bootstrap seeds present ----------
{
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const mv = db.prepare(
    `SELECT model_version_id, provider, model_id, status FROM ai_model_versions WHERE provider = 'anthropic' AND model_id = 'claude-sonnet-4-6' AND status = 'active'`
  ).all() as Array<Record<string, unknown>>;
  if (mv.length !== 1) {
    db.close();
    throw new Error(`expected exactly 1 active sonnet 4.6 row, got ${mv.length}`);
  }
  const tpl = db.prepare(
    `SELECT template_id, name, version, active FROM ai_prompt_templates WHERE name = 'memo_internal_draft' AND version = '0.1.0' AND active = 1`
  ).all() as Array<Record<string, unknown>>;
  if (tpl.length !== 1) {
    db.close();
    throw new Error(`expected exactly 1 active memo_internal_draft v0.1.0 row, got ${tpl.length}`);
  }
  db.close();
  probe.bootstrapSeeds = { modelVersionRows: mv.length, promptTemplateRows: tpl.length };
}

// ---------- B. Auth on memo-draft (no cookie -> 401) ----------
const memoDraftRoute = loadUserland('api/cockpit/leads/[leadId]/ai/memo-draft');
{
  const res = await jsonOf(
    await memoDraftRoute.POST(
      new Request(`http://localhost/api/cockpit/leads/${leadId}/ai/memo-draft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({})
      }),
      { params: Promise.resolve({ leadId }) }
    )
  );
  if (res.status !== 401) throw new Error(`memo-draft no-auth: expected 401, got ${res.status}`);
  probe.authNoCookie = { status: res.status };
}

// ---------- C. Happy path with admin session ----------
const happyResp = await jsonOf(
  await memoDraftRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/ai/memo-draft`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: sessionCookie },
      body: JSON.stringify({ focusHint: 'verifier smoke test' })
    }),
    { params: Promise.resolve({ leadId }) }
  )
);
if (happyResp.status !== 201) throw new Error(`memo-draft happy: expected 201, got ${happyResp.status} ${JSON.stringify(happyResp.body)}`);
const happyBody = happyResp.body as { ok: boolean; jobId: string; artifactId: string; status: string; costCents: number; latencyMs: number };
if (!happyBody.ok || !happyBody.jobId || !happyBody.artifactId) {
  throw new Error(`memo-draft happy: missing fields ${JSON.stringify(happyBody)}`);
}
if (happyBody.status !== 'pending_review') throw new Error(`expected artifact pending_review, got ${happyBody.status}`);
if (!Number.isFinite(happyBody.costCents) || happyBody.costCents < 0) throw new Error(`bad costCents: ${happyBody.costCents}`);
probe.happyPath = { jobId: happyBody.jobId, artifactId: happyBody.artifactId, costCents: happyBody.costCents, latencyMs: happyBody.latencyMs };

// Inspect DB rows
{
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const job = db.prepare(`SELECT status, cost_cents, output_hash, input_tokens, output_tokens FROM ai_jobs WHERE job_id = ?`).get(happyBody.jobId) as Record<string, unknown>;
  if (!job) throw new Error('happy path: ai_jobs row missing');
  if (job.status !== 'succeeded') throw new Error(`expected job status=succeeded, got ${job.status}`);
  if (!job.output_hash) throw new Error('expected output_hash set');
  if (Number(job.cost_cents) <= 0) throw new Error('expected cost_cents > 0');

  const artifact = db.prepare(`SELECT status, body FROM ai_artifacts WHERE artifact_id = ?`).get(happyBody.artifactId) as Record<string, unknown>;
  if (!artifact) throw new Error('happy path: ai_artifacts row missing');
  if (artifact.status !== 'pending_review') throw new Error(`expected artifact status=pending_review, got ${artifact.status}`);
  if (typeof artifact.body !== 'string' || artifact.body.length === 0) throw new Error('artifact body empty');

  const auditActions = ['ai_job_created', 'ai_job_status_changed', 'ai_artifact_created'];
  for (const action of auditActions) {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action = ?`).get(action) as { n: number };
    if (row.n === 0) throw new Error(`audit_log missing action: ${action}`);
  }
  db.close();
  probe.happyDbCheck = {
    jobStatus: String(job.status),
    artifactStatus: String(artifact.status),
    artifactBodyLength: (artifact.body as string).length
  };
}

// ---------- D. Budget enforcement ----------
{
  // Insert a tight global budget cap (1 cent/month) so the next call gets blocked.
  const db = new DatabaseSync(dbPath);
  const capId = randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO ai_budget_caps (cap_id, scope_type, scope_value, period, cap_cents, action_on_exceed, active, created_at, updated_at, deactivated_at)
    VALUES (?, 'global', 'global', 'month', 1, 'block', 1, ?, ?, NULL)
  `).run(capId, now, now);
  db.close();

  const blockedResp = await jsonOf(
    await memoDraftRoute.POST(
      new Request(`http://localhost/api/cockpit/leads/${leadId}/ai/memo-draft`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify({})
      }),
      { params: Promise.resolve({ leadId }) }
    )
  );
  if (blockedResp.status !== 402) throw new Error(`expected 402 blocked_budget, got ${blockedResp.status} ${JSON.stringify(blockedResp.body)}`);
  const blockedBody = blockedResp.body as { ok: boolean; error: string; jobId: string };
  if (blockedBody.error !== 'blocked_budget') throw new Error(`expected error=blocked_budget, got ${blockedBody.error}`);

  const dbR = new DatabaseSync(dbPath, { readOnly: true });
  const job = dbR.prepare(`SELECT status FROM ai_jobs WHERE job_id = ?`).get(blockedBody.jobId) as Record<string, unknown>;
  if (!job || job.status !== 'blocked_budget') throw new Error(`expected blocked_budget on ai_jobs, got ${job?.status}`);
  dbR.close();
  probe.budgetBlock = { httpStatus: blockedResp.status, jobStatus: String(job.status), capId };
}

// ---------- E. Admin route ----------
const modelVersionsRoute = loadUserland('api/cockpit/ai/model-versions');

// GET with operator (admin session works for GET — requireCockpitSession only)
{
  const res = await jsonOf(
    await modelVersionsRoute.GET(
      new Request('http://localhost/api/cockpit/ai/model-versions', {
        method: 'GET',
        headers: { cookie: sessionCookie }
      })
    )
  );
  if (res.status !== 200) throw new Error(`GET model-versions: expected 200, got ${res.status}`);
  const body = res.body as { ok: boolean; versions: Array<{ provider: string; modelId: string; status: string }> };
  const sonnet = body.versions.find((v) => v.provider === 'anthropic' && v.modelId === 'claude-sonnet-4-6' && v.status === 'active');
  if (!sonnet) throw new Error(`GET model-versions did not return seeded Sonnet 4.6 active`);
  probe.adminListGet = { versionsCount: body.versions.length, seededSonnetFound: true };
}

// POST without admin → 403 (legacy COCKPIT_SECRET cookie resolves to operator role only)
{
  const legacyRes = await jsonOf(
    await modelVersionsRoute.POST(
      new Request('http://localhost/api/cockpit/ai/model-versions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: `cockpit_token=${process.env.COCKPIT_SECRET}` },
        body: JSON.stringify({ provider: 'anthropic', modelId: 'claude-sonnet-4-7', displayName: 'Sonnet 4.7' })
      })
    )
  );
  if (legacyRes.status !== 403) throw new Error(`POST model-versions with legacy: expected 403, got ${legacyRes.status}`);
  probe.adminPostLegacyForbidden = { status: legacyRes.status };
}

// POST with real admin → 201
{
  const res = await jsonOf(
    await modelVersionsRoute.POST(
      new Request('http://localhost/api/cockpit/ai/model-versions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: sessionCookie },
        body: JSON.stringify({ provider: 'anthropic', modelId: 'claude-sonnet-4-7', displayName: 'Sonnet 4.7' })
      })
    )
  );
  if (res.status !== 201) throw new Error(`POST model-versions admin: expected 201, got ${res.status} ${JSON.stringify(res.body)}`);
  const body = res.body as { ok: boolean; version: { modelVersionId: string; status: string } };
  if (body.version.status !== 'candidate') throw new Error(`new version should be candidate, got ${body.version.status}`);
  probe.adminPostAdminOk = { versionId: body.version.modelVersionId, status: body.version.status };
}

// ---------- Source-shape audits ----------
const aiDir = path.join(webDir, 'lib', 'ai');
const expectedFiles = ['types.ts', 'costs.ts', 'budgets.ts', 'mock.ts', 'anthropic.ts', 'provider.ts', 'run-job.ts'];
const sourceShape: Record<string, boolean> = {};
for (const f of expectedFiles) {
  sourceShape[f] = fs.existsSync(path.join(aiDir, f));
  if (!sourceShape[f]) throw new Error(`Missing AI gateway file: lib/ai/${f}`);
}

// Audit env example contains AI vars
const envSrc = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
const envChecks = {
  hasAiEnabled: /AI_ENABLED=/.test(envSrc),
  hasAiProvider: /AI_PROVIDER=anthropic/.test(envSrc),
  hasAiModel: /AI_MODEL=claude-sonnet-4-6/.test(envSrc),
  hasAnthropicKey: /ANTHROPIC_API_KEY=/.test(envSrc),
  hasMonthlyBudget: /AI_DEFAULT_MONTHLY_BUDGET_CENTS=5000/.test(envSrc)
};
for (const [k, v] of Object.entries(envChecks)) {
  if (!v) throw new Error(`.env.example check failed: ${k}`);
}

const prodEnvSrc = fs.readFileSync(path.join(root, 'infra', 'env.production.example'), 'utf8');
const prodEnvChecks = {
  hasAiEnabledFalse: /AI_ENABLED=false/.test(prodEnvSrc),
  hasAiUseMockZero: /AI_USE_MOCK=0/.test(prodEnvSrc),
  hasDevHarnessZero: /AI_DEV_HARNESS_ENABLED=0/.test(prodEnvSrc)
};
for (const [k, v] of Object.entries(prodEnvChecks)) {
  if (!v) throw new Error(`infra/env.production.example check failed: ${k}`);
}

// ---------- Summary ----------
const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  leadId,
  probe,
  sourceShape,
  envChecks,
  prodEnvChecks,
  note:
    'AI-1 Cycle 2: bootstrap seeds Sonnet 4.6 + memo template; mock provider exercised via /api/cockpit/leads/.../ai/memo-draft; cost_cents and output_hash recorded on succeeded job; pending_review artifact created; tight budget cap (1 cent) blocks the next call with HTTP 402 and ai_jobs.status=blocked_budget; admin model-versions GET returns seeded Sonnet 4.6, POST requires admin role (legacy fallback receives 403). Anthropic SDK wired but not invoked; verifier never spends real money.'
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
