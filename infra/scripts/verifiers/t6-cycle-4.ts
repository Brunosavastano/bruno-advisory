// T6 cycle 4 verifier — requireCockpitSession + middleware Edge refactor.
// Invoked by infra/scripts/verify-t6-cycle-4-local.sh.
//
// Scenarios covered end-to-end against the compiled /api/cockpit/session GET:
//   A. Valid session cookie → 200, legacy:false, role=admin, actorId=userId.
//   B. No cookies, COCKPIT_SECRET set → 401.
//   C. Legacy cockpit_token cookie matching COCKPIT_SECRET → 200, legacy:true,
//      actorId='legacy-secret', role='operator'.
//   D. Expired session cookie → 401 with reason 'session_expired'.
//   E. Session whose user has been deactivated → 401 with reason 'user_disabled'.
//
// Also verifies middleware (proxy.ts) behavior via source-text:
//   - Imports cockpitAuthModel
//   - hasCockpitSessionCookie presence-only check is the fast path in isAuthorizedCockpit

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const root = process.argv[2];
const evidenceDirArg = process.argv[3];
if (!root || !evidenceDirArg) {
  throw new Error('Usage: node t6-cycle-4.ts <repoRoot> <evidenceDir>');
}
const evidenceDir = path.resolve(root, evidenceDirArg);

// CRITICAL: chdir to tempRoot BEFORE loading any compiled route (db.ts captures
// repoRoot at module-load time from process.cwd()).
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t6-cycle4-'));
fs.mkdirSync(path.join(tempRoot, 'data', 'dev'), { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
process.chdir(tempRoot);
process.on('exit', () => {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
});

const TEST_SECRET = 'cycle4-legacy-secret-xyz';
process.env.COCKPIT_SECRET = TEST_SECRET;

const require = createRequire(import.meta.url);
const webDir = path.join(root, 'apps', 'web');

function loadUserland(subpath: string) {
  return require(path.join(webDir, '.next', 'server', 'app', ...subpath.split('/'), 'route.js')).routeModule.userland;
}

async function json(res: Response) {
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : null;
  return { status: res.status, body };
}

// ---------- Source-text audits on middleware ----------
const proxySrc = fs.readFileSync(path.join(webDir, 'proxy.ts'), 'utf8');
const middlewareChecks: Record<string, boolean> = {
  importsCockpitAuthModel: /import\s*\{[^}]*\bcockpitAuthModel\b[^}]*\}\s*from\s*['"]@bruno-advisory\/core['"]/.test(proxySrc),
  sessionCookieConst: /COCKPIT_SESSION_COOKIE\s*=\s*cockpitAuthModel\.cookie\.name/.test(proxySrc),
  presenceOnlyCheck: /hasCockpitSessionCookie/.test(proxySrc),
  isAuthorizedChecksSession: /isAuthorizedCockpit[\s\S]*?hasCockpitSessionCookie/.test(proxySrc)
};
for (const [k, v] of Object.entries(middlewareChecks)) {
  if (!v) throw new Error(`middleware source-check failed: ${k}`);
}

// ---------- Source-text audits on requireCockpitSession helper ----------
const helperPath = path.join(webDir, 'lib', 'cockpit-session.ts');
if (!fs.existsSync(helperPath)) throw new Error('cockpit-session helper missing');
const helperSrc = fs.readFileSync(helperPath, 'utf8');
const helperChecks: Record<string, boolean> = {
  exportsRequire: /export\s+async\s+function\s+requireCockpitSession/.test(helperSrc),
  readsSessionCookie: /COCKPIT_SESSION_COOKIE/.test(helperSrc),
  readsLegacyCookie: /COCKPIT_LEGACY_TOKEN_COOKIE/.test(helperSrc),
  setsLegacyActorId: /legacySecretActorId/.test(helperSrc),
  usesIsValid: /isCockpitSessionValid/.test(helperSrc),
  distinguishesDisabled: /user_disabled/.test(helperSrc),
  distinguishesExpired: /session_expired/.test(helperSrc)
};
for (const [k, v] of Object.entries(helperChecks)) {
  if (!v) throw new Error(`helper source-check failed: ${k}`);
}

// ---------- Bootstrap the DB via an existing route that triggers getDatabase() ----------
const intakeRoute = loadUserland('api/intake');
const bootstrapResp = await json(await intakeRoute.POST(new Request('http://localhost/api/intake', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    fullName: 'T6 Cycle 4 Probe',
    email: `t6-cycle4-${Date.now()}@example.com`,
    phone: '11988887777',
    city: 'Sao Paulo',
    state: 'SP',
    investableAssetsBand: '3m_a_10m',
    primaryChallenge: 'Cycle 4 — trigger DDL to set up cockpit tables.',
    sourceLabel: 'verify_t6_cycle_4',
    privacyConsentAccepted: true,
    termsConsentAccepted: true
  })
})));
if (bootstrapResp.status !== 201) {
  throw new Error(`intake bootstrap failed: ${bootstrapResp.status} ${JSON.stringify(bootstrapResp.body)}`);
}

const dbPath = path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3');

// ---------- Seed an admin user + valid session + deactivated user + expired session ----------
// Direct DatabaseSync INSERTs mirror cockpit-auth.ts shapes; the goal is to get
// predictable fixtures for the session GET probes, not to re-test cockpit-auth
// (that was Cycles 1-2).

// Load hashing directly from the canonical leaf model.
// @ts-expect-error Node strip-types loader accepts .ts extension
import { hashCockpitPassword } from '../../../packages/core/src/cockpit-auth-model.ts';

const passwordHash = hashCockpitPassword('cycle4-password-123');
const activeUserId = randomUUID();
const activeSessionToken = randomBytes(32).toString('hex');
const disabledUserId = randomUUID();
const disabledSessionToken = randomBytes(32).toString('hex');
const expiredUserId = randomUUID();
const expiredSessionToken = randomBytes(32).toString('hex');

const nowIso = new Date().toISOString();
const futureIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const pastIso = new Date(Date.now() - 60 * 1000).toISOString();

const seed = new DatabaseSync(dbPath);

// Active admin
seed.prepare(`
  INSERT INTO cockpit_users (user_id, email, display_name, role, password_hash, is_active, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 1, ?, ?)
`).run(activeUserId, 'admin+cycle4@example.com', 'Cycle 4 Admin', 'admin', passwordHash, nowIso, nowIso);
seed.prepare(`
  INSERT INTO cockpit_sessions (session_id, user_id, session_token, created_at, expires_at)
  VALUES (?, ?, ?, ?, ?)
`).run(randomUUID(), activeUserId, activeSessionToken, nowIso, futureIso);

// Disabled user (is_active = 0) with a non-expired session token
seed.prepare(`
  INSERT INTO cockpit_users (user_id, email, display_name, role, password_hash, is_active, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 0, ?, ?)
`).run(disabledUserId, 'disabled+cycle4@example.com', 'Cycle 4 Disabled', 'operator', passwordHash, nowIso, nowIso);
seed.prepare(`
  INSERT INTO cockpit_sessions (session_id, user_id, session_token, created_at, expires_at)
  VALUES (?, ?, ?, ?, ?)
`).run(randomUUID(), disabledUserId, disabledSessionToken, nowIso, futureIso);

// Active user but with an already-expired session
seed.prepare(`
  INSERT INTO cockpit_users (user_id, email, display_name, role, password_hash, is_active, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 1, ?, ?)
`).run(expiredUserId, 'expired+cycle4@example.com', 'Cycle 4 Expired', 'viewer', passwordHash, nowIso, nowIso);
seed.prepare(`
  INSERT INTO cockpit_sessions (session_id, user_id, session_token, created_at, expires_at)
  VALUES (?, ?, ?, ?, ?)
`).run(randomUUID(), expiredUserId, expiredSessionToken, nowIso, pastIso);

seed.close();

// ---------- Exercise GET /api/cockpit/session under 5 scenarios ----------
const sessionRoute = loadUserland('api/cockpit/session');

async function getWith(cookies: Record<string, string>) {
  const cookieHeader = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  const headers: Record<string, string> = {};
  if (cookieHeader) headers.cookie = cookieHeader;
  return json(await sessionRoute.GET(new Request('http://localhost/api/cockpit/session', { headers })));
}

const scenarios: Record<string, { status: number; body: unknown }> = {};

// A. Valid session
scenarios.A_valid_session = await getWith({ cockpit_session: activeSessionToken });
if (scenarios.A_valid_session.status !== 200) throw new Error(`A: expected 200 got ${scenarios.A_valid_session.status}`);
{
  const b = scenarios.A_valid_session.body as Record<string, unknown>;
  if (b.legacy !== false) throw new Error(`A: expected legacy:false got ${JSON.stringify(b.legacy)}`);
  if (b.role !== 'admin') throw new Error(`A: expected role:admin got ${JSON.stringify(b.role)}`);
  if (b.userId !== activeUserId) throw new Error(`A: userId mismatch`);
  if (b.actorId !== activeUserId) throw new Error(`A: actorId should equal userId for real sessions`);
}

// B. No cookies, no legacy token → 401 (but COCKPIT_SECRET is set in env)
scenarios.B_no_auth = await getWith({});
if (scenarios.B_no_auth.status !== 401) throw new Error(`B: expected 401 got ${scenarios.B_no_auth.status}`);

// C. Legacy cockpit_token matching COCKPIT_SECRET → 200, legacy:true
scenarios.C_legacy_token = await getWith({ cockpit_token: TEST_SECRET });
if (scenarios.C_legacy_token.status !== 200) throw new Error(`C: expected 200 got ${scenarios.C_legacy_token.status}`);
{
  const b = scenarios.C_legacy_token.body as Record<string, unknown>;
  if (b.legacy !== true) throw new Error(`C: expected legacy:true got ${JSON.stringify(b.legacy)}`);
  if (b.actorId !== 'legacy-secret') throw new Error(`C: actorId must be 'legacy-secret' got ${JSON.stringify(b.actorId)}`);
  if (b.role !== 'operator') throw new Error(`C: legacy role should be 'operator' got ${JSON.stringify(b.role)}`);
  if (b.userId !== null) throw new Error(`C: legacy userId must be null`);
}

// D. Expired session → 401, reason session_expired
scenarios.D_expired_session = await getWith({ cockpit_session: expiredSessionToken });
if (scenarios.D_expired_session.status !== 401) throw new Error(`D: expected 401 got ${scenarios.D_expired_session.status}`);
{
  const b = scenarios.D_expired_session.body as Record<string, unknown>;
  if (b.reason !== 'session_expired') throw new Error(`D: expected reason 'session_expired' got ${JSON.stringify(b.reason)}`);
}

// E. Session of deactivated user → 401, reason user_disabled
scenarios.E_disabled_user = await getWith({ cockpit_session: disabledSessionToken });
if (scenarios.E_disabled_user.status !== 401) throw new Error(`E: expected 401 got ${scenarios.E_disabled_user.status}`);
{
  const b = scenarios.E_disabled_user.body as Record<string, unknown>;
  if (b.reason !== 'user_disabled') throw new Error(`E: expected reason 'user_disabled' got ${JSON.stringify(b.reason)}`);
}

// F. Bogus session cookie (no matching row) falls through to legacy, but no legacy token
//    set → 401.
const bogusResp = await getWith({ cockpit_session: 'deadbeef'.repeat(8) });
if (bogusResp.status !== 401) throw new Error(`F: bogus session expected 401 got ${bogusResp.status}`);

// G. Bogus session + legacy token set → legacy fallback works even when session cookie is invalid
const bogusWithLegacy = await getWith({ cockpit_session: 'deadbeef'.repeat(8), cockpit_token: TEST_SECRET });
if (bogusWithLegacy.status !== 200) throw new Error(`G: bogus session + legacy expected 200 got ${bogusWithLegacy.status}`);
{
  const b = bogusWithLegacy.body as Record<string, unknown>;
  if (b.legacy !== true) throw new Error(`G: expected legacy:true`);
}

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  dbPath,
  middlewareChecks,
  helperChecks,
  scenarios: {
    A_valid_session: { status: scenarios.A_valid_session.status, legacy: (scenarios.A_valid_session.body as Record<string, unknown>).legacy, role: (scenarios.A_valid_session.body as Record<string, unknown>).role, actorIdEqualsUserId: (scenarios.A_valid_session.body as Record<string, unknown>).actorId === activeUserId },
    B_no_auth: { status: scenarios.B_no_auth.status, body: scenarios.B_no_auth.body },
    C_legacy_token: { status: scenarios.C_legacy_token.status, legacy: (scenarios.C_legacy_token.body as Record<string, unknown>).legacy, actorId: (scenarios.C_legacy_token.body as Record<string, unknown>).actorId, role: (scenarios.C_legacy_token.body as Record<string, unknown>).role },
    D_expired_session: { status: scenarios.D_expired_session.status, reason: (scenarios.D_expired_session.body as Record<string, unknown>).reason },
    E_disabled_user: { status: scenarios.E_disabled_user.status, reason: (scenarios.E_disabled_user.body as Record<string, unknown>).reason },
    F_bogus_session: { status: bogusResp.status },
    G_bogus_session_plus_legacy: { status: bogusWithLegacy.status, legacy: (bogusWithLegacy.body as Record<string, unknown>).legacy }
  },
  note: 'T6 cycle 4: requireCockpitSession validates session cookies against DB inside route handlers; middleware (proxy.ts) only checks presence. COCKPIT_SECRET fallback yields legacy context with actorId=legacy-secret.'
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
