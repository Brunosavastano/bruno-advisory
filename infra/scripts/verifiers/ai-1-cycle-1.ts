// AI-1 cycle 1 verifier — schema layer of the AI gateway.
// Invoked by infra/scripts/verify-ai-1-cycle-1-local.sh.
//
// Strategy: Node 24's experimental TypeScript support cannot dynamic-import the workspace .ts files
// (extensionless `export *` in packages/core/src/index.ts breaks ESM resolution). To exercise the
// storage helpers we hit a dev-only API route at /api/_dev/ai-1-cycle-1/exercise that calls every
// helper in-process; the route is gated by NODE_ENV !== 'production'. That route shape itself is
// audited from source so we know what it really does before trusting its JSON.
//
// Scenarios:
//   A. After getDatabase() init, all 9 ai_* tables exist (sqlite_master inspection).
//   B. CHECK constraint: invalid status on ai_jobs is rejected by SQLite (raw INSERT).
//   C. FK constraint: insert ai_job with non-existent lead_id is rejected by SQLite (raw INSERT).
//   D. Runtime exercise via /api/_dev/ai-1-cycle-1/exercise — every storage helper, transitions,
//      guardrail summary, audit log writes.
//   E. Audit log: count expected ai_<entity>_<verb> rows after the exercise.
//   F. Source-shape audit on the 9 core model files (status arrays, model object, Record type).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const root = process.argv[2];
const evidenceDirArg = process.argv[3];
if (!root || !evidenceDirArg) throw new Error('Usage: node ai-1-cycle-1.ts <repoRoot> <evidenceDir>');
const evidenceDir = path.resolve(root, evidenceDirArg);

// Enable the dev-only exercise route in this verifier process. The compiled route reads
// process.env.AI_DEV_HARNESS_ENABLED at request time, so setting this here flips the gate open.
process.env.AI_DEV_HARNESS_ENABLED = '1';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-ai1-cycle1-'));
fs.mkdirSync(path.join(tempRoot, 'data', 'dev'), { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
process.chdir(tempRoot);
process.on('exit', () => {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
});

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

// ---------- Boot DB via intake (transitively initializes all CREATE TABLE blocks) ----------
const intakeRoute = loadUserland('api/intake');
const seedResp = await jsonOf(
  await intakeRoute.POST(
    new Request('http://localhost/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: 'AI-1 cycle 1 probe',
        email: `ai1-cycle1-${Date.now()}@example.com`,
        phone: '11988887777',
        city: 'Sao Paulo',
        state: 'SP',
        investableAssetsBand: '3m_a_10m',
        primaryChallenge: 'AI-1 cycle 1 probe to confirm the AI schema layer.',
        sourceLabel: 'verify_ai1_cycle1',
        privacyConsentAccepted: true,
        termsConsentAccepted: true
      })
    })
  )
);
if (seedResp.status !== 201) throw new Error(`seed lead failed: ${seedResp.status} ${JSON.stringify(seedResp.body)}`);
const leadId = (seedResp.body as { leadId: string }).leadId;

const dbPath = path.join(tempRoot, 'data', 'dev', 'savastano-advisory.sqlite3');

// ---------- A. Confirm 9 tables exist ----------
function listAiTables(): string[] {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const rows = db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'ai_%' ORDER BY name`).all() as Array<{ name: string }>;
  db.close();
  return rows.map((row) => row.name);
}
const expectedTables = [
  'ai_artifacts',
  'ai_budget_caps',
  'ai_eval_cases',
  'ai_eval_runs',
  'ai_guardrail_results',
  'ai_jobs',
  'ai_messages',
  'ai_model_versions',
  'ai_prompt_templates'
];
const actualTables = listAiTables();
for (const t of expectedTables) {
  if (!actualTables.includes(t)) throw new Error(`Missing table: ${t}. Found: ${actualTables.join(', ')}`);
}

// ---------- B. CHECK constraint via raw INSERT ----------
let checkRejected = false;
try {
  const db = new DatabaseSync(dbPath);
  db.prepare(`
    INSERT INTO ai_jobs (
      job_id, lead_id, job_type, surface, status, provider, model, model_version_id,
      prompt_template_id, prompt_template_version, input_hash, input_redaction_level,
      created_by, created_at
    ) VALUES (?, NULL, ?, ?, 'NOT_A_VALID_STATUS', ?, ?, NULL, ?, ?, ?, 'strict', 'verifier', ?)
  `).run(randomUUID(), 'test', 'cockpit_copilot', 'anthropic', 'claude-opus-4-7', 'tpl-x', '0.1', 'sha256:x', new Date().toISOString());
  db.close();
} catch {
  checkRejected = true;
}
if (!checkRejected) throw new Error('CHECK constraint test: invalid status was NOT rejected');

// ---------- C. FK constraint via raw INSERT ----------
let fkRejected = false;
try {
  const db = new DatabaseSync(dbPath);
  db.prepare(`
    INSERT INTO ai_jobs (
      job_id, lead_id, job_type, surface, status, provider, model, model_version_id,
      prompt_template_id, prompt_template_version, input_hash, input_redaction_level,
      created_by, created_at
    ) VALUES (?, ?, ?, ?, 'queued', ?, ?, NULL, ?, ?, ?, 'strict', 'verifier', ?)
  `).run(randomUUID(), '00000000-0000-0000-0000-000000000000', 'test', 'cockpit_copilot', 'anthropic', 'claude-opus-4-7', 'tpl-x', '0.1', 'sha256:x', new Date().toISOString());
  db.close();
} catch {
  fkRejected = true;
}
if (!fkRejected) throw new Error('FK constraint test: bogus lead_id was NOT rejected');

// ---------- D. Runtime exercise via /api/dev/ai-1-cycle-1/exercise ----------
const exerciseRoute = loadUserland('api/dev/ai-1-cycle-1/exercise');
const exerciseResp = await jsonOf(
  await exerciseRoute.POST(
    new Request('http://localhost/api/dev/ai-1-cycle-1/exercise', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leadId })
    })
  )
);
if (exerciseResp.status !== 200 || !(exerciseResp.body as { ok?: boolean })?.ok) {
  throw new Error(`exercise route failed: ${exerciseResp.status} ${JSON.stringify(exerciseResp.body)}`);
}

const exerciseProbe = (exerciseResp.body as { probe: Record<string, unknown> }).probe;
const transitions = exerciseProbe.transitions as Record<string, boolean>;
if (!transitions.queuedToSucceededRejected) throw new Error('queued→succeeded was not rejected by storage helper');
if (!transitions.cancelOnSucceededRejected) throw new Error('cancel succeeded job was not rejected by storage helper');
if (!transitions.deprecatedToActiveRejected) throw new Error('deprecated→active was not rejected by storage helper');

// ---------- E. Audit log: confirm expected actions exist ----------
const auditDb = new DatabaseSync(dbPath, { readOnly: true });
const expectedActions = [
  'ai_prompt_template_created',
  'ai_model_version_registered',
  'ai_model_version_transitioned',
  'ai_job_created',
  'ai_job_status_changed',
  'ai_artifact_created',
  'ai_artifact_approved',
  'ai_artifact_archived',
  'ai_message_appended',
  'ai_guardrail_pass',
  'ai_budget_cap_set',
  'ai_budget_cap_deactivated',
  'ai_eval_case_created',
  'ai_eval_run_pass'
];
const auditCounts: Record<string, number> = {};
for (const action of expectedActions) {
  const row = auditDb.prepare(`SELECT COUNT(*) AS n FROM audit_log WHERE action = ?`).get(action) as { n: number };
  auditCounts[action] = row.n;
  if (row.n === 0) {
    auditDb.close();
    throw new Error(`audit_log missing action: ${action}`);
  }
}
auditDb.close();

// ---------- F. Source-shape audit on the 9 model files ----------
const corePackageDir = path.join(root, 'packages', 'core', 'src');
const modelChecks: Record<string, Record<string, boolean>> = {};
const modelExpectations: Array<{ file: string; statusArray?: string; modelObject: string; recordType: string }> = [
  { file: 'ai-job-model.ts', statusArray: 'aiJobStatuses', modelObject: 'aiJobModel', recordType: 'AiJobRecord' },
  { file: 'ai-artifact-model.ts', statusArray: 'aiArtifactStatuses', modelObject: 'aiArtifactModel', recordType: 'AiArtifactRecord' },
  { file: 'ai-message-model.ts', statusArray: 'aiMessageRoles', modelObject: 'aiMessageModel', recordType: 'AiMessageRecord' },
  { file: 'ai-prompt-template-model.ts', modelObject: 'aiPromptTemplateModel', recordType: 'AiPromptTemplateRecord' },
  { file: 'ai-guardrail-result-model.ts', statusArray: 'aiGuardrailResultStatuses', modelObject: 'aiGuardrailResultModel', recordType: 'AiGuardrailResultRecord' },
  { file: 'ai-budget-cap-model.ts', statusArray: 'aiBudgetScopeTypes', modelObject: 'aiBudgetCapModel', recordType: 'AiBudgetCapRecord' },
  { file: 'ai-model-version-model.ts', statusArray: 'aiModelVersionStatuses', modelObject: 'aiModelVersionModel', recordType: 'AiModelVersionRecord' },
  { file: 'ai-eval-case-model.ts', modelObject: 'aiEvalCaseModel', recordType: 'AiEvalCaseRecord' },
  { file: 'ai-eval-run-model.ts', statusArray: 'aiEvalRunStatuses', modelObject: 'aiEvalRunModel', recordType: 'AiEvalRunRecord' }
];
for (const exp of modelExpectations) {
  const src = fs.readFileSync(path.join(corePackageDir, exp.file), 'utf8');
  const checks: Record<string, boolean> = {
    hasModelObject: new RegExp(`export const ${exp.modelObject}\\s*=`).test(src),
    hasRecordType: new RegExp(`export type ${exp.recordType}\\s*=`).test(src),
    hasCanonicalArtifact: /canonicalArtifact:\s*'packages\/core\/src\//.test(src)
  };
  if (exp.statusArray) {
    checks.hasStatusArray = new RegExp(`export const ${exp.statusArray}\\s*=`).test(src);
  }
  for (const [k, v] of Object.entries(checks)) {
    if (!v) throw new Error(`source-shape audit failed for ${exp.file}: ${k}`);
  }
  modelChecks[exp.file] = checks;
}

// ---------- Source audit on dev-only route: confirm prod gate is in place ----------
const exerciseSrc = fs.readFileSync(path.join(webDir, 'app', 'api', 'dev', 'ai-1-cycle-1', 'exercise', 'route.ts'), 'utf8');
const exerciseGateChecks = {
  customEnvGate: /process\.env\.AI_DEV_HARNESS_ENABLED !== '1'/.test(exerciseSrc),
  returns404WhenDisabled: /Response\(null,\s*\{\s*status:\s*404\s*\}\)/.test(exerciseSrc)
};
for (const [k, v] of Object.entries(exerciseGateChecks)) {
  if (!v) throw new Error(`exercise route gate audit failed: ${k}`);
}

// ---------- Summary ----------
const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  leadId,
  tablesFound: actualTables,
  exerciseProbe,
  auditCounts,
  modelChecks,
  exerciseGateChecks,
  note:
    'AI-1 Cycle 1: 9 AI tables created via getDatabase() init; CHECK + FK constraints reject bad data; runtime exercise of all 9 storage helpers via dev-only /api/dev/ai-1-cycle-1/exercise (gated by AI_DEV_HARNESS_ENABLED=1); status transitions enforce queued→succeeded, cancel-on-succeeded, deprecated→active rejections; audit log received 14 expected ai_<entity>_<verb> actions; 9 core models export expected status arrays, model objects, and Record types.'
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
