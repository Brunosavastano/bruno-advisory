// AI-0 cycle 2 verifier — guard the two write endpoints left out of cycle 1.
// Invoked by infra/scripts/verify-ai-0-cycle-2-local.sh.
//
// Scenarios:
//   A. flags POST and checklist POST return 401 with a fake cookie.
//   B. Source-text audit: each handler runs requireCockpitSession as the FIRST statement
//      (so no storage call can fire before the 401).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.argv[2];
const evidenceDirArg = process.argv[3];
if (!root || !evidenceDirArg) throw new Error('Usage: node ai-0-cycle-2.ts <repoRoot> <evidenceDir>');
const evidenceDir = path.resolve(root, evidenceDirArg);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-ai0-cycle2-'));
fs.mkdirSync(path.join(tempRoot, 'data', 'dev'), { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
process.chdir(tempRoot);
process.on('exit', () => {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
});

process.env.COCKPIT_SECRET = 'ai0-cycle2-real-secret-xyz';

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

// Seed a lead so [leadId] is valid (decouple auth from 404).
const intakeRoute = loadUserland('api/intake');
const seedResp = await jsonOf(
  await intakeRoute.POST(
    new Request('http://localhost/api/intake', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: 'AI-0 cycle 2 probe',
        email: `ai0-cycle2-${Date.now()}@example.com`,
        phone: '11988887777',
        city: 'Sao Paulo',
        state: 'SP',
        investableAssetsBand: '3m_a_10m',
        primaryChallenge: 'AI-0 cycle 2 probe to confirm flags/checklist POST auth.',
        sourceLabel: 'verify_ai0_cycle2',
        privacyConsentAccepted: true,
        termsConsentAccepted: true
      })
    })
  )
);
if (seedResp.status !== 201) throw new Error(`seed lead failed: ${seedResp.status} ${JSON.stringify(seedResp.body)}`);
const leadId = (seedResp.body as { leadId: string }).leadId;

const FAKE_COOKIE = 'cockpit_session=fake-session-token; cockpit_token=fake-legacy-token';

// ---------- 1. Probe flags POST + checklist POST → expect 401 ----------
const probeResults: Record<string, { status: number }> = {};

const flagsRoute = loadUserland('api/cockpit/leads/[leadId]/flags');
const flagsPost = await jsonOf(
  await flagsRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/flags`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: FAKE_COOKIE },
      body: JSON.stringify({ flagType: 'awaiting_documents', note: 'attacker note', setBy: 'attacker' })
    }),
    { params: Promise.resolve({ leadId }) }
  )
);
probeResults['flags POST'] = { status: flagsPost.status };
if (flagsPost.status !== 401) throw new Error(`flags POST: expected 401 got ${flagsPost.status} ${JSON.stringify(flagsPost.body)}`);

const checklistRoute = loadUserland('api/cockpit/leads/[leadId]/checklist');
const checklistPost = await jsonOf(
  await checklistRoute.POST(
    new Request(`http://localhost/api/cockpit/leads/${leadId}/checklist`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: FAKE_COOKIE },
      body: JSON.stringify({ title: 'Attacker checklist item', description: 'should not persist' })
    }),
    { params: Promise.resolve({ leadId }) }
  )
);
probeResults['checklist POST'] = { status: checklistPost.status };
if (checklistPost.status !== 401) throw new Error(`checklist POST: expected 401 got ${checklistPost.status} ${JSON.stringify(checklistPost.body)}`);

// ---------- 2. Source-shape audit: auth runs first in each handler ----------
function auditPostShape(filepath: string): Record<string, boolean> {
  const src = fs.readFileSync(path.join(webDir, filepath), 'utf8');
  const match = src.match(/export async function POST\([^)]*\)\s*\{([\s\S]*?)\n\}/);
  if (!match) throw new Error(`${filepath}: could not isolate POST handler body`);
  const body = match[1];
  const trimmed = body.trimStart();
  const checks = {
    authIsFirstStatement: /^const check = await requireCockpitSession\(request\);/.test(trimmed),
    earlyReturnOnFail: /if \(!check\.ok\) return Response\.json\(check\.body, \{ status: check\.status \}\);/.test(trimmed)
  };
  for (const [k, v] of Object.entries(checks)) {
    if (!v) throw new Error(`${filepath} POST shape check failed: ${k}\nbody:\n${body}`);
  }
  return checks;
}

const sourceShape = {
  flagsPost: auditPostShape('app/api/cockpit/leads/[leadId]/flags/route.ts'),
  checklistPost: auditPostShape('app/api/cockpit/leads/[leadId]/checklist/route.ts')
};

// ---------- Summary ----------
const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  leadId,
  probeResults,
  sourceShape,
  note:
    'AI-0 cycle 2: flags POST and checklist POST return 401 with a fake cookie; auth runs as first statement in each handler (no storage call fires before the 401).'
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
