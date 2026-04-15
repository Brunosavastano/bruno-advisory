// T6 cycle 7 verifier — users admin UI + API + cockpit layout header.
// Invoked by infra/scripts/verify-t6-cycle-7-local.sh.
//
// Scenarios (against compiled /api/cockpit/users API):
//   A. Admin session → GET /users returns the list.
//   B. Operator session → GET /users returns 403 admin_required.
//   C. Legacy cockpit_token (role='operator' fallback) → GET /users returns 403.
//   D. No auth → GET /users returns 401.
//   E. Admin POST creates a new user with valid payload (role=operator).
//   F. Admin POST with duplicate email returns 409.
//   G. Admin PATCH the operator to isActive:false → session of that user is dropped.
//   H. Last-admin protection: admin PATCH themselves role=operator → 409 last_admin_protected.
//   I. Source-text audit: requireCockpitAdmin exists, layout.tsx wires logout, users page gates admin.
//   J. /cockpit root page: source has redirect('/cockpit/leads').

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const root = process.argv[2];
const evidenceDirArg = process.argv[3];
if (!root || !evidenceDirArg) throw new Error('Usage: node t6-cycle-7.ts <repoRoot> <evidenceDir>');
const evidenceDir = path.resolve(root, evidenceDirArg);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t6-cycle7-'));
fs.mkdirSync(path.join(tempRoot, 'data', 'dev'), { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
process.chdir(tempRoot);
process.on('exit', () => {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
});

const LEGACY_SECRET = 'cycle7-legacy-secret-xyz';
process.env.COCKPIT_SECRET = LEGACY_SECRET;

const require = createRequire(import.meta.url);
const webDir = path.join(root, 'apps', 'web');
function loadUserland(subpath: string) {
  return require(path.join(webDir, '.next', 'server', 'app', ...subpath.split('/'), 'route.js')).routeModule.userland;
}
async function json(res: Response) {
  const ct = res.headers.get('content-type') || '';
  const body = ct.includes('application/json') ? await res.json() : null;
  return { status: res.status, body };
}

// ---------- Source-text audits ----------
const sessionHelperSrc = fs.readFileSync(path.join(webDir, 'lib', 'cockpit-session.ts'), 'utf8');
const layoutSrc = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'layout.tsx'), 'utf8');
const usersPageSrc = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'users', 'page.tsx'), 'utf8');
const rootPageSrc = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'page.tsx'), 'utf8');
const sourceChecks: Record<string, boolean> = {
  requireAdminExported: /export\s+async\s+function\s+requireCockpitAdmin/.test(sessionHelperSrc),
  requireAdminReturns403: /status:\s*403[\s\S]*?admin_required/.test(sessionHelperSrc),
  layoutLogoutAction: /logoutAction[\s\S]*?deleteCockpitSessionByToken/.test(layoutSrc),
  layoutLegacyBanner: /Sess[aã]o\s+legada/i.test(layoutSrc),
  layoutUsersLinkAdminOnly: /role\s*===\s*'admin'[\s\S]*?href=["']\/cockpit\/users["']/.test(layoutSrc),
  usersPageAdminGate: /getAdminContext|requireAdminOrRedirect/.test(usersPageSrc),
  usersPageLastAdminGuard: /countActiveAdmins\(\)\s*<=\s*1/.test(usersPageSrc),
  rootPageRedirects: /redirect\(['"]\/cockpit\/leads['"]\)/.test(rootPageSrc)
};
for (const [k, v] of Object.entries(sourceChecks)) {
  if (!v) throw new Error(`source check failed: ${k}`);
}

// ---------- Bootstrap DB via intake + bootstrap-admin ----------
const intakeRoute = loadUserland('api/intake');
await json(await intakeRoute.POST(new Request('http://localhost/api/intake', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    fullName: 'T6 Cycle 7 Probe',
    email: `t6-cycle7-probe-${Date.now()}@example.com`,
    phone: '11988887777',
    city: 'Sao Paulo',
    state: 'SP',
    investableAssetsBand: '3m_a_10m',
    primaryChallenge: 'Cycle 7 seed for cockpit_users table creation.',
    sourceLabel: 'verify_t6_cycle_7',
    privacyConsentAccepted: true,
    termsConsentAccepted: true
  })
})));

const bootstrapRoute = loadUserland('api/cockpit/bootstrap-admin');
const adminEmail = `cycle7-admin-${Date.now()}@example.com`;
const adminPassword = 'cycle7-password-xyz';
const bootstrap = await json(await bootstrapRoute.POST(new Request('http://localhost/api/cockpit/bootstrap-admin', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: adminEmail, displayName: 'Cycle 7 Admin', password: adminPassword })
})));
if (bootstrap.status !== 201) throw new Error(`bootstrap failed: ${bootstrap.status}`);
const adminUserId = (bootstrap.body as { user: { userId: string } }).user.userId;

const dbPath = path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3');

// Seed an operator session via direct DB INSERT (we also need an operator user).
const operatorUserId = randomUUID();
const operatorEmail = `cycle7-operator-${Date.now()}@example.com`;
const adminSessionToken = randomBytes(32).toString('hex');
const operatorSessionToken = randomBytes(32).toString('hex');
const now = new Date();

// Load canonical hashing for operator password.
// @ts-expect-error Node strip-types loader accepts .ts extension
import { hashCockpitPassword } from '../../../packages/core/src/cockpit-auth-model.ts';

const seed = new DatabaseSync(dbPath);
seed.prepare(`
  INSERT INTO cockpit_users (user_id, email, display_name, role, password_hash, is_active, created_at, updated_at)
  VALUES (?, ?, ?, 'operator', ?, 1, ?, ?)
`).run(operatorUserId, operatorEmail, 'Cycle 7 Operator', hashCockpitPassword('operator-password-xyz'), now.toISOString(), now.toISOString());

seed.prepare(`
  INSERT INTO cockpit_sessions (session_id, user_id, session_token, created_at, expires_at)
  VALUES (?, ?, ?, ?, ?)
`).run(randomUUID(), adminUserId, adminSessionToken, now.toISOString(), new Date(now.getTime() + 86_400_000).toISOString());

seed.prepare(`
  INSERT INTO cockpit_sessions (session_id, user_id, session_token, created_at, expires_at)
  VALUES (?, ?, ?, ?, ?)
`).run(randomUUID(), operatorUserId, operatorSessionToken, now.toISOString(), new Date(now.getTime() + 86_400_000).toISOString());
seed.close();

const adminCookie = `cockpit_session=${adminSessionToken}`;
const operatorCookie = `cockpit_session=${operatorSessionToken}`;
const legacyCookie = `cockpit_token=${LEGACY_SECRET}`;

// ---------- Exercise API routes ----------
const usersRoute = loadUserland('api/cockpit/users');
const userByIdRoute = loadUserland('api/cockpit/users/[userId]');

async function listUsers(cookie: string | null) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  return json(await usersRoute.GET(new Request('http://localhost/api/cockpit/users', { headers })));
}

async function createUser(cookie: string, body: Record<string, unknown>) {
  return json(await usersRoute.POST(new Request('http://localhost/api/cockpit/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(body)
  })));
}

async function patchUser(userId: string, cookie: string, body: Record<string, unknown>) {
  return json(await userByIdRoute.PATCH(
    new Request(`http://localhost/api/cockpit/users/${userId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify(body)
    }),
    { params: Promise.resolve({ userId }) }
  ));
}

const results: Record<string, unknown> = {};

// A. Admin lists
const respA = await listUsers(adminCookie);
if (respA.status !== 200) throw new Error(`A: admin list expected 200 got ${respA.status}`);
const listedUsers = (respA.body as { users: Array<{ userId: string }> }).users;
if (!listedUsers.some((u) => u.userId === adminUserId) || !listedUsers.some((u) => u.userId === operatorUserId)) {
  throw new Error(`A: expected list to contain both admin and operator`);
}
results.A_admin_list = { status: respA.status, count: listedUsers.length };

// B. Operator gets 403
const respB = await listUsers(operatorCookie);
if (respB.status !== 403) throw new Error(`B: operator list expected 403 got ${respB.status}`);
if ((respB.body as Record<string, unknown>).reason !== 'admin_required') throw new Error(`B: expected reason admin_required`);
results.B_operator_forbidden = { status: respB.status, reason: (respB.body as Record<string, unknown>).reason };

// C. Legacy cookie → 403 (fallback is 'operator' role)
const respC = await listUsers(legacyCookie);
if (respC.status !== 403) throw new Error(`C: legacy list expected 403 got ${respC.status}`);
results.C_legacy_forbidden = { status: respC.status, reason: (respC.body as Record<string, unknown>).reason };

// D. No auth → 401
const respD = await listUsers(null);
if (respD.status !== 401) throw new Error(`D: no-auth expected 401 got ${respD.status}`);
results.D_no_auth_unauthorized = { status: respD.status };

// E. Admin creates user
const newEmail = `cycle7-new-${Date.now()}@example.com`;
const respE = await createUser(adminCookie, {
  email: newEmail,
  displayName: 'Cycle 7 New User',
  role: 'viewer',
  password: 'cycle7-new-password'
});
if (respE.status !== 201) throw new Error(`E: create expected 201 got ${respE.status} ${JSON.stringify(respE.body)}`);
const createdUserId = (respE.body as { user: { userId: string } }).user.userId;
results.E_admin_create = { status: respE.status, newUserId: createdUserId };

// F. Duplicate email
const respF = await createUser(adminCookie, {
  email: newEmail,
  displayName: 'Duplicate',
  role: 'viewer',
  password: 'another-password'
});
if (respF.status !== 409) throw new Error(`F: duplicate expected 409 got ${respF.status} ${JSON.stringify(respF.body)}`);
results.F_duplicate_email = { status: respF.status, error: (respF.body as Record<string, unknown>).error };

// G. Deactivate operator → session dropped
const respG = await patchUser(operatorUserId, adminCookie, { isActive: false });
if (respG.status !== 200) throw new Error(`G: deactivate expected 200 got ${respG.status} ${JSON.stringify(respG.body)}`);

// Confirm operator session is gone
const dbPostDeactivate = new DatabaseSync(dbPath, { readOnly: true });
const surviving = dbPostDeactivate.prepare(`SELECT COUNT(*) AS n FROM cockpit_sessions WHERE user_id = ?`).get(operatorUserId) as { n: number };
dbPostDeactivate.close();
if (Number(surviving.n) !== 0) throw new Error(`G: expected 0 sessions for deactivated operator, got ${surviving.n}`);

// And the operator cookie now fails authentication on a cockpit route
const sessionRoute = loadUserland('api/cockpit/session');
const operatorAfterDeactivate = await json(await sessionRoute.GET(new Request('http://localhost/api/cockpit/session', {
  headers: { cookie: operatorCookie }
})));
if (operatorAfterDeactivate.status !== 401) throw new Error(`G: operator post-deactivate expected 401 got ${operatorAfterDeactivate.status}`);

results.G_deactivate_drops_sessions = {
  status: respG.status,
  survivingSessions: Number(surviving.n),
  operatorSessionEndpoint: operatorAfterDeactivate.status
};

// H. Last-admin protection — only one admin exists; try to demote self.
const respH = await patchUser(adminUserId, adminCookie, { role: 'operator' });
if (respH.status !== 409) throw new Error(`H: last-admin protection expected 409 got ${respH.status}`);
if ((respH.body as Record<string, unknown>).error !== 'last_admin_protected') {
  throw new Error(`H: expected error last_admin_protected`);
}
// Admin should still be admin
const dbAdminCheck = new DatabaseSync(dbPath, { readOnly: true });
const adminStillAdmin = dbAdminCheck.prepare(`SELECT role, is_active FROM cockpit_users WHERE user_id = ?`).get(adminUserId) as { role: string; is_active: number };
dbAdminCheck.close();
if (adminStillAdmin.role !== 'admin' || adminStillAdmin.is_active !== 1) {
  throw new Error(`H: admin was mutated despite 409 (role=${adminStillAdmin.role} isActive=${adminStillAdmin.is_active})`);
}
results.H_last_admin_protected = { status: respH.status, error: (respH.body as Record<string, unknown>).error, adminRoleUnchanged: true };

// ---------- Summary ----------
const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  dbPath,
  sourceChecks,
  scenarios: results,
  note: 'T6 cycle 7: users admin API + UI. requireCockpitAdmin gates admin-only surface. Legacy fallback cannot reach admin routes (role=operator). Deactivation drops sessions atomically. Last-admin protection prevents lockout.'
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
