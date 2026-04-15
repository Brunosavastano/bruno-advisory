// T6 cycle 1 verifier — schema DDL + scrypt hashing.
// Invoked by infra/scripts/verify-t6-cycle-1-local.sh.
//
// Strategy: trigger getDatabase() via a compiled Next route (intake POST),
// then open the DB directly with DatabaseSync and introspect the new T6
// tables + audit_log.actor_id column. Hashing is tested against the canonical
// model file (leaf, node:crypto-only) loaded directly via --experimental-strip-types.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

const root = process.argv[2];
const evidenceDirArg = process.argv[3];
if (!root || !evidenceDirArg) {
  throw new Error('Usage: node t6-cycle-1.ts <repoRoot> <evidenceDir>');
}
const evidenceDir = path.resolve(root, evidenceDirArg);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t6-cycle1-'));
fs.mkdirSync(path.join(tempRoot, 'data', 'dev'), { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
process.chdir(tempRoot);
process.on('exit', () => {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
});

// Direct leaf-module import for hashing (model file has no barrel deps).
// @ts-expect-error Node strip-types loader accepts .ts extension
import {
  hashCockpitPassword,
  verifyCockpitPassword,
  cockpitAuthModel,
  isCockpitRole
} from '../../../packages/core/src/cockpit-auth-model.ts';

const require = createRequire(import.meta.url);
const webDir = path.join(root, 'apps', 'web');

function loadUserland(subpath: string) {
  return require(path.join(webDir, '.next', 'server', 'app', ...subpath.split('/'), 'route.js')).routeModule.userland;
}

const intakeRoute = loadUserland('api/intake');

async function json(res: Response) {
  const contentType = res.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await res.json() : null;
  return { status: res.status, body };
}

// Trigger schema creation by submitting a lead
const intakeResp = await json(await intakeRoute.POST(new Request('http://localhost/api/intake', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    fullName: 'T6 Schema Probe',
    email: `t6-probe-${Date.now()}@example.com`,
    phone: '11988887777',
    city: 'Sao Paulo',
    state: 'SP',
    investableAssetsBand: '3m_a_10m',
    primaryChallenge: 'Forçar criação do schema T6 para introspecção.',
    sourceLabel: 'verify_t6_cycle_1',
    privacyConsentAccepted: true,
    termsConsentAccepted: true
  })
})));

if (intakeResp.status !== 201) {
  throw new Error(`Intake probe failed: status=${intakeResp.status} body=${JSON.stringify(intakeResp.body)}`);
}

const dbPath = path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3');
const checks: Record<string, unknown> = {};

const introspect = new DatabaseSync(dbPath, { readOnly: true });
const usersCols = introspect.prepare(`PRAGMA table_info(cockpit_users)`).all() as Array<{ name: string; type: string; notnull: number; pk: number }>;
const sessionsCols = introspect.prepare(`PRAGMA table_info(cockpit_sessions)`).all() as Array<{ name: string; type: string; notnull: number; pk: number }>;
const auditCols = introspect.prepare(`PRAGMA table_info(audit_log)`).all() as Array<{ name: string; type: string }>;
const userIndexes = introspect.prepare(`PRAGMA index_list(cockpit_users)`).all() as Array<{ name: string; unique: number }>;
const sessionIndexes = introspect.prepare(`PRAGMA index_list(cockpit_sessions)`).all() as Array<{ name: string; unique: number }>;

checks.cockpitUsersColumns = usersCols.map((c) => c.name).sort();
checks.cockpitSessionsColumns = sessionsCols.map((c) => c.name).sort();
checks.auditLogHasActorId = auditCols.some((c) => c.name === 'actor_id');
checks.cockpitUsersIndexNames = userIndexes.map((i) => i.name).filter((n) => n.startsWith('idx_')).sort();
checks.cockpitSessionsIndexNames = sessionIndexes.map((i) => i.name).filter((n) => n.startsWith('idx_')).sort();

const expectedUserCols = ['user_id','email','display_name','role','password_hash','is_active','created_at','updated_at'].sort();
const expectedSessionCols = ['session_id','user_id','session_token','created_at','expires_at'].sort();

if (JSON.stringify(checks.cockpitUsersColumns) !== JSON.stringify(expectedUserCols)) {
  throw new Error(`cockpit_users columns mismatch: ${JSON.stringify(checks.cockpitUsersColumns)}`);
}
if (JSON.stringify(checks.cockpitSessionsColumns) !== JSON.stringify(expectedSessionCols)) {
  throw new Error(`cockpit_sessions columns mismatch: ${JSON.stringify(checks.cockpitSessionsColumns)}`);
}
if (!checks.auditLogHasActorId) {
  throw new Error('audit_log.actor_id column missing after ensureCockpitAuthColumns');
}

// UNIQUE constraint on email
const emailIndex = userIndexes.find((i) => i.name.includes('autoindex') || i.name === 'idx_cockpit_users_email');
const uniqueIndexes = introspect.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='cockpit_users'`).all() as Array<{ name: string }>;
checks.cockpitUsersUniqueEmailPresent = userIndexes.some((i) => i.unique === 1);

// Sessions have FK to users — confirm via schema text
const sessionsSchema = (introspect.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='cockpit_sessions'`).get() as { sql: string }).sql;
checks.cockpitSessionsHasForeignKey = /FOREIGN KEY.*user_id.*REFERENCES.*cockpit_users/i.test(sessionsSchema);
if (!checks.cockpitSessionsHasForeignKey) {
  throw new Error('cockpit_sessions missing FK to cockpit_users');
}

// Role CHECK constraint present
const usersSchema = (introspect.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='cockpit_users'`).get() as { sql: string }).sql;
checks.cockpitUsersRoleCheckPresent = /CHECK\s*\(\s*role\s+IN\s*\(\s*'admin'\s*,\s*'operator'\s*,\s*'viewer'\s*\)\s*\)/i.test(usersSchema);
if (!checks.cockpitUsersRoleCheckPresent) {
  throw new Error('cockpit_users role CHECK constraint missing');
}

introspect.close();

// --- Hashing (canonical model) ---
const hashed = hashCockpitPassword('super-secret-123');
checks.hashFormat = hashed.split('$')[0];
checks.hashParams = hashed.split('$')[1];
if (checks.hashFormat !== 'scrypt') throw new Error(`unexpected hash prefix: ${String(checks.hashFormat)}`);
if (String(checks.hashParams) !== `N=${cockpitAuthModel.scrypt.N},r=${cockpitAuthModel.scrypt.r},p=${cockpitAuthModel.scrypt.p}`) {
  throw new Error(`hash params drift: ${String(checks.hashParams)}`);
}
if (!verifyCockpitPassword('super-secret-123', hashed)) {
  throw new Error('verifyCockpitPassword rejected correct password');
}
if (verifyCockpitPassword('wrong-password', hashed)) {
  throw new Error('verifyCockpitPassword accepted wrong password');
}
if (verifyCockpitPassword('super-secret-123', hashed.replace(/.$/, 'x'))) {
  throw new Error('verifyCockpitPassword accepted tampered hash');
}
checks.verifyCorrectOk = true;
checks.verifyWrongRejected = true;
checks.verifyTamperRejected = true;

const h1 = hashCockpitPassword('dup-password-xyz');
const h2 = hashCockpitPassword('dup-password-xyz');
checks.saltRandomness = h1 !== h2;
if (!checks.saltRandomness) throw new Error('hashCockpitPassword produced identical hashes (salt not random)');

// Short password rejected
let shortRejected = false;
try { hashCockpitPassword('123'); } catch (e) { shortRejected = /at least/i.test(String((e as Error).message)); }
checks.shortPasswordRejected = shortRejected;
if (!shortRejected) throw new Error('short password was not rejected');

// Role guard
checks.isCockpitRoleAdmin = isCockpitRole('admin');
checks.isCockpitRoleGarbage = isCockpitRole('superuser');
if (!checks.isCockpitRoleAdmin || checks.isCockpitRoleGarbage) {
  throw new Error('isCockpitRole role-guard broken');
}

// Canonical roles exactly 3
checks.cockpitRoleCount = Object.keys(cockpitAuthModel.roleCapabilities).length;
if (checks.cockpitRoleCount !== 3) throw new Error('role capabilities table must cover 3 roles');

// Surface checks: files exist where the plan says
const surfaceChecks = {
  cockpitAuthStorageExists: fs.existsSync(path.join(webDir, 'lib', 'storage', 'cockpit-auth.ts')),
  cockpitAuthModelExists: fs.existsSync(path.join(root, 'packages', 'core', 'src', 'cockpit-auth-model.ts')),
  auditLogActorIdReadPath: fs.readFileSync(path.join(webDir, 'lib', 'storage', 'audit-log.ts'), 'utf8').includes('actor_id AS actorId'),
  dbHasEnsureCockpitAuthColumns: fs.readFileSync(path.join(webDir, 'lib', 'storage', 'db.ts'), 'utf8').includes('ensureCockpitAuthColumns')
};
checks.surfaceChecks = surfaceChecks;
for (const [k, v] of Object.entries(surfaceChecks)) {
  if (!v) throw new Error(`surface check failed: ${k}`);
}

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  dbPath,
  checks,
  note: 'T6 cycle 1: DDL for cockpit_users/cockpit_sessions + audit_log.actor_id verified by introspection; hashing verified via canonical model file. Full cockpit-auth CRUD is exercised by Cycle 2 bootstrap-admin CLI.'
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
