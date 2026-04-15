// T6 cycle 5 verifier — login / logout API + /cockpit/login page.
// Invoked by infra/scripts/verify-t6-cycle-5-local.sh.
//
// Scenarios (all end-to-end against compiled routes):
//   A. Login with valid credentials → 200, Set-Cookie with cockpit_session,
//      session row exists in DB.
//   B. Login with unknown email → 401 invalid_credentials.
//   C. Login with wrong password → 401 invalid_credentials.
//   D. Login with disabled user → 403 user_disabled.
//   E. GET /api/cockpit/session using the cookie from A → 200 legacy:false
//      with matching userId (Cycle 4 integration).
//   F. Logout with cookie → 200 revoked:true; session row gone; subsequent
//      GET /api/cockpit/session with the same cookie → 401.
//   G. Logout without any cookie → 200 revoked:false (idempotent).
//
// Source-text audits:
//   - proxy.ts exempts /cockpit/login, /api/cockpit/login, /api/cockpit/logout
//   - /cockpit/login page imports cockpitAuthModel.cookie config and uses
//     cookieStore.set with httpOnly + sameSite + path from the model.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

const root = process.argv[2];
const evidenceDirArg = process.argv[3];
if (!root || !evidenceDirArg) {
  throw new Error('Usage: node t6-cycle-5.ts <repoRoot> <evidenceDir>');
}
const evidenceDir = path.resolve(root, evidenceDirArg);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t6-cycle5-'));
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

async function json(res: Response) {
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : null;
  return { status: res.status, body, setCookie: res.headers.get('set-cookie') };
}

// ---------- Source-text audits ----------
const proxySrc = fs.readFileSync(path.join(webDir, 'proxy.ts'), 'utf8');
const middlewareChecks: Record<string, boolean> = {
  exemptsLoginPage: /isCockpitPublicRoute[\s\S]*['"]\/cockpit\/login['"]/.test(proxySrc),
  exemptsLoginApi: /isCockpitPublicRoute[\s\S]*['"]\/api\/cockpit\/login['"]/.test(proxySrc),
  exemptsLogoutApi: /isCockpitPublicRoute[\s\S]*['"]\/api\/cockpit\/logout['"]/.test(proxySrc),
  publicShortCircuit: /isCockpitPublicRoute\(pathname\)[\s\S]{0,120}NextResponse\.next\(\)/.test(proxySrc)
};
for (const [k, v] of Object.entries(middlewareChecks)) {
  if (!v) throw new Error(`middleware source-check failed: ${k}`);
}

const pageSrc = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'login', 'page.tsx'), 'utf8');
const pageChecks: Record<string, boolean> = {
  usesCookieName: /cockpitAuthModel\.cookie\.name/.test(pageSrc),
  usesHttpOnly: /httpOnly:\s*cockpitAuthModel\.cookie\.httpOnly/.test(pageSrc),
  usesSameSite: /sameSite:\s*cockpitAuthModel\.cookie\.sameSite/.test(pageSrc),
  usesPath: /path:\s*cockpitAuthModel\.cookie\.path/.test(pageSrc),
  usesMaxAge: /sessionExpiryDays/.test(pageSrc),
  callsVerifyPassword: /verifyPassword\(/.test(pageSrc),
  callsCreateSession: /createCockpitSession\(/.test(pageSrc),
  redirectsToLeads: /redirect\(['"]\/cockpit\/leads['"]\)/.test(pageSrc)
};
for (const [k, v] of Object.entries(pageChecks)) {
  if (!v) throw new Error(`page source-check failed: ${k}`);
}

// ---------- Seed: create an admin (via bootstrap route) + a disabled user (direct DB) ----------
const bootstrapRoute = loadUserland('api/cockpit/bootstrap-admin');
const adminEmail = `cycle5-admin-${Date.now()}@example.com`;
const adminPassword = 'cycle5-password-xyz';
const bootstrapResp = await json(await bootstrapRoute.POST(new Request('http://localhost/api/cockpit/bootstrap-admin', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    email: adminEmail,
    displayName: 'Cycle 5 Admin',
    password: adminPassword
  })
})));
if (bootstrapResp.status !== 201) {
  throw new Error(`bootstrap failed: ${bootstrapResp.status} ${JSON.stringify(bootstrapResp.body)}`);
}
const adminUserId = (bootstrapResp.body as { user: { userId: string } }).user.userId;

// Seed a disabled user by direct DB INSERT.
const dbPath = path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3');
const inspect = new DatabaseSync(dbPath);
const disabledEmail = `cycle5-disabled-${Date.now()}@example.com`;
const disabledPassword = 'cycle5-disabled-pwd';
const disabledUserId = (require('node:crypto') as typeof import('node:crypto')).randomUUID();
const nowIso = new Date().toISOString();
// For the disabled user we need a hash of a DIFFERENT password so scenario D's
// 403 isn't actually a 401. Load the canonical model to hash directly.
// @ts-expect-error Node strip-types loader accepts .ts extension
import { hashCockpitPassword } from '../../../packages/core/src/cockpit-auth-model.ts';
const disabledHash = hashCockpitPassword(disabledPassword);
inspect.prepare(`
  INSERT INTO cockpit_users (user_id, email, display_name, role, password_hash, is_active, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 0, ?, ?)
`).run(disabledUserId, disabledEmail, 'Cycle 5 Disabled', 'operator', disabledHash, nowIso, nowIso);
inspect.close();

// ---------- Exercise login + logout ----------
const loginRoute = loadUserland('api/cockpit/login');
const logoutRoute = loadUserland('api/cockpit/logout');
const sessionRoute = loadUserland('api/cockpit/session');

async function login(email: string, password: string) {
  return json(await loginRoute.POST(new Request('http://localhost/api/cockpit/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  })));
}

// A. Valid login
const respA = await login(adminEmail, adminPassword);
if (respA.status !== 200) throw new Error(`A: expected 200 got ${respA.status} ${JSON.stringify(respA.body)}`);
if (!respA.setCookie) throw new Error('A: Set-Cookie missing');
const cookieMatch = respA.setCookie.match(/cockpit_session=([^;]+);/);
if (!cookieMatch) throw new Error(`A: cookie cockpit_session missing from Set-Cookie: ${respA.setCookie}`);
const issuedToken = cookieMatch[1];
const cookieLower = respA.setCookie.toLowerCase();
const checkCookieA = {
  hasHttpOnly: cookieLower.includes('httponly'),
  hasSameSiteLax: cookieLower.includes('samesite=lax'),
  hasPath: cookieLower.includes('path=/'),
  hasMaxAge: /max-age=\d+/.test(cookieLower),
  notSecure: !cookieLower.includes('secure') // local request has no x-forwarded-proto=https
};
for (const [k, v] of Object.entries(checkCookieA)) {
  if (!v) throw new Error(`A: cookie flag check failed: ${k} (cookie=${respA.setCookie})`);
}
const bodyA = respA.body as Record<string, unknown>;
if (bodyA.userId !== adminUserId) throw new Error(`A: userId mismatch`);
if (bodyA.role !== 'admin') throw new Error(`A: role should be admin`);

// Confirm session row exists
const db1 = new DatabaseSync(dbPath, { readOnly: true });
const sessRow = db1.prepare(`SELECT user_id, expires_at FROM cockpit_sessions WHERE session_token = ?`).get(issuedToken) as { user_id: string; expires_at: string } | undefined;
db1.close();
if (!sessRow) throw new Error('A: session row not found in DB after login');
if (sessRow.user_id !== adminUserId) throw new Error('A: session.user_id mismatch');

// B. Unknown email
const respB = await login(`unknown-${Date.now()}@example.com`, adminPassword);
if (respB.status !== 401) throw new Error(`B: expected 401 got ${respB.status}`);
if ((respB.body as Record<string, unknown>).error !== 'invalid_credentials') throw new Error(`B: expected invalid_credentials`);

// C. Wrong password
const respC = await login(adminEmail, 'wrong-password-completely');
if (respC.status !== 401) throw new Error(`C: expected 401 got ${respC.status}`);
if ((respC.body as Record<string, unknown>).error !== 'invalid_credentials') throw new Error(`C: expected invalid_credentials`);

// D. Disabled user
const respD = await login(disabledEmail, disabledPassword);
if (respD.status !== 403) throw new Error(`D: expected 403 got ${respD.status} ${JSON.stringify(respD.body)}`);
if ((respD.body as Record<string, unknown>).error !== 'user_disabled') throw new Error(`D: expected user_disabled`);

// E. GET /api/cockpit/session with cookie from A → legacy:false, matches userId
const respE = await json(await sessionRoute.GET(new Request('http://localhost/api/cockpit/session', {
  headers: { cookie: `cockpit_session=${issuedToken}` }
})));
if (respE.status !== 200) throw new Error(`E: expected 200 got ${respE.status}`);
const bodyE = respE.body as Record<string, unknown>;
if (bodyE.legacy !== false) throw new Error(`E: expected legacy:false`);
if (bodyE.userId !== adminUserId) throw new Error(`E: userId mismatch after login`);

// F. Logout with cookie
const respF = await json(await logoutRoute.POST(new Request('http://localhost/api/cockpit/logout', {
  method: 'POST',
  headers: { cookie: `cockpit_session=${issuedToken}` }
})));
if (respF.status !== 200) throw new Error(`F: expected 200 got ${respF.status}`);
if ((respF.body as Record<string, unknown>).revoked !== true) throw new Error(`F: expected revoked:true`);
if (!respF.setCookie || !/max-age=0/i.test(respF.setCookie)) throw new Error(`F: expected Set-Cookie with Max-Age=0, got ${respF.setCookie}`);

// Session row should be gone
const db2 = new DatabaseSync(dbPath, { readOnly: true });
const sessRowAfter = db2.prepare(`SELECT session_id FROM cockpit_sessions WHERE session_token = ?`).get(issuedToken) as { session_id: string } | undefined;
db2.close();
if (sessRowAfter) throw new Error('F: session row still exists after logout');

// Session endpoint with now-revoked cookie → 401
const respFSession = await json(await sessionRoute.GET(new Request('http://localhost/api/cockpit/session', {
  headers: { cookie: `cockpit_session=${issuedToken}` }
})));
if (respFSession.status !== 401) throw new Error(`F: session GET after logout expected 401 got ${respFSession.status}`);

// G. Logout without cookie → 200, revoked:false
const respG = await json(await logoutRoute.POST(new Request('http://localhost/api/cockpit/logout', { method: 'POST' })));
if (respG.status !== 200) throw new Error(`G: expected 200 got ${respG.status}`);
if ((respG.body as Record<string, unknown>).revoked !== false) throw new Error(`G: expected revoked:false`);

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  dbPath,
  middlewareChecks,
  pageChecks,
  scenarios: {
    A_valid_login: { status: respA.status, cookieFlags: checkCookieA, sessionRowWritten: true },
    B_unknown_email: { status: respB.status, error: (respB.body as Record<string, unknown>).error },
    C_wrong_password: { status: respC.status, error: (respC.body as Record<string, unknown>).error },
    D_disabled_user: { status: respD.status, error: (respD.body as Record<string, unknown>).error },
    E_session_after_login: { status: respE.status, legacy: (respE.body as Record<string, unknown>).legacy, userIdMatches: (respE.body as Record<string, unknown>).userId === adminUserId },
    F_logout_with_cookie: { status: respF.status, revoked: (respF.body as Record<string, unknown>).revoked, sessionGone: true, sessionEndpointAfterLogout: respFSession.status },
    G_logout_without_cookie: { status: respG.status, revoked: (respG.body as Record<string, unknown>).revoked }
  },
  note: 'T6 cycle 5: login/logout API + /cockpit/login page. Cookie flags verified; middleware exempts the public auth paths; session round-trip with Cycle 4 surface is green.'
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
