// T6 cycle 2 verifier — bootstrap-admin CLI idempotency.
//
// Strategy:
//   1. Spin up an isolated temp repo root (symlinked apps/ + packages/)
//   2. Run `node --experimental-strip-types scripts/bootstrap-admin.ts ...` once
//      and confirm a cockpit_user row with role=admin, is_active=1 appears
//   3. Run it a second time with the same email and confirm exit code != 0
//      AND the DB row is unchanged (same userId, same passwordHash, same createdAt)
//   4. Also call the GET route to confirm adminCount=1 and needsBootstrap=false

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DatabaseSync } from 'node:sqlite';

const root = process.argv[2];
const evidenceDirArg = process.argv[3];
if (!root || !evidenceDirArg) {
  throw new Error('Usage: node t6-cycle-2.ts <repoRoot> <evidenceDir>');
}
const evidenceDir = path.resolve(root, evidenceDirArg);

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t6-cycle2-'));
fs.mkdirSync(path.join(tempRoot, 'data', 'dev'), { recursive: true });
fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
// Copy package.json so bootstrap-admin.ts's findRepoRoot picks up the right node_modules path
fs.copyFileSync(path.join(root, 'package.json'), path.join(tempRoot, 'package.json'));
fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
fs.symlinkSync(path.join(root, 'scripts'), path.join(tempRoot, 'scripts'), 'dir');
fs.symlinkSync(path.join(root, 'infra'), path.join(tempRoot, 'infra'), 'dir');
fs.symlinkSync(path.join(root, 'node_modules'), path.join(tempRoot, 'node_modules'), 'dir');
process.on('exit', () => {
  try { fs.rmSync(tempRoot, { recursive: true, force: true }); } catch {}
});

const scriptPath = path.join(tempRoot, 'scripts', 'bootstrap-admin.ts');
const dbPath = path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3');

const email = 'bruno+t6-cycle2@example.com';
const password = 'first-boot-password-123';
const displayName = 'T6 Cycle 2 Admin';

function runCli() {
  return spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', scriptPath,
      '--email', email,
      '--name', displayName,
      '--password', password
    ],
    { cwd: tempRoot, encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0' } }
  );
}

const firstRun = runCli();
const firstRunOk = firstRun.status === 0;
if (!firstRunOk) {
  throw new Error(
    `First bootstrap run failed unexpectedly: status=${firstRun.status}\n` +
    `stdout:\n${firstRun.stdout}\nstderr:\n${firstRun.stderr}`
  );
}

// Snapshot the admin row after first run
function introspectAdmin() {
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const row = db.prepare(`
    SELECT user_id AS userId, email, display_name AS displayName, role,
      is_active AS isActive, password_hash AS passwordHash,
      created_at AS createdAt, updated_at AS updatedAt
    FROM cockpit_users WHERE email = ?
  `).get(email) as Record<string, unknown> | undefined;
  const adminCount = (db.prepare(
    `SELECT COUNT(*) AS cnt FROM cockpit_users WHERE role = 'admin' AND is_active = 1`
  ).get() as { cnt: number }).cnt;
  const totalUsers = (db.prepare(
    `SELECT COUNT(*) AS cnt FROM cockpit_users`
  ).get() as { cnt: number }).cnt;
  db.close();
  return { row, adminCount: Number(adminCount), totalUsers: Number(totalUsers) };
}

const afterFirst = introspectAdmin();
if (!afterFirst.row) throw new Error('first run: cockpit_users row for bootstrap email not found');
if (afterFirst.row.role !== 'admin') throw new Error(`first run: role is ${String(afterFirst.row.role)}, expected admin`);
if (Number(afterFirst.row.isActive) !== 1) throw new Error('first run: is_active is not 1');
if (typeof afterFirst.row.passwordHash !== 'string' || !String(afterFirst.row.passwordHash).startsWith('scrypt$')) {
  throw new Error('first run: password_hash not in expected scrypt format');
}
if (afterFirst.adminCount !== 1) throw new Error(`first run: expected 1 active admin, got ${afterFirst.adminCount}`);

// Second run — same email, same password, same name. Must fail.
const secondRun = runCli();
if (secondRun.status === 0) {
  throw new Error(
    `Second bootstrap run unexpectedly succeeded:\nstdout:\n${secondRun.stdout}\nstderr:\n${secondRun.stderr}`
  );
}
const secondRunStderr = secondRun.stderr.toLowerCase();
if (!/already|disable|locked|admin/.test(secondRunStderr)) {
  throw new Error(`Second run failed but message doesn't mention the lockout: ${secondRun.stderr}`);
}

const afterSecond = introspectAdmin();
if (!afterSecond.row) throw new Error('second run: admin row vanished — should not happen');
if (afterSecond.row.userId !== afterFirst.row.userId) throw new Error('second run: userId changed');
if (afterSecond.row.passwordHash !== afterFirst.row.passwordHash) throw new Error('second run: password_hash changed');
if (afterSecond.row.createdAt !== afterFirst.row.createdAt) throw new Error('second run: createdAt changed');
if (afterSecond.totalUsers !== afterFirst.totalUsers) throw new Error('second run: totalUsers changed');
if (afterSecond.adminCount !== afterFirst.adminCount) throw new Error('second run: adminCount changed');

// Hit the GET endpoint directly too — needsBootstrap should be false.
// IMPORTANT: chdir before loading the route because db.ts captures repoRoot
// at module-load time from process.cwd().
process.chdir(tempRoot);
const requireFromRoot = createRequire(path.join(root, 'package.json'));
const routePath = path.join(root, 'apps', 'web', '.next', 'server', 'app', 'api', 'cockpit', 'bootstrap-admin', 'route.js');
const mod = requireFromRoot(routePath);
const handlers = mod.routeModule.userland as { GET: () => Promise<Response>; POST: (req: Request) => Promise<Response> };

const statusBody = await (await handlers.GET()).json() as { ok: boolean; needsBootstrap: boolean; adminCount: number };
if (statusBody.needsBootstrap) throw new Error('GET still reports needsBootstrap=true after bootstrap');
if (statusBody.adminCount !== 1) throw new Error(`GET reports adminCount=${statusBody.adminCount}`);

// Direct POST attempt against the route should also be blocked
const directReject = await handlers.POST(new Request('http://localhost/x', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'evil@example.com', displayName: 'Evil', password: 'evil-password-123' })
}));
const directRejectBody = await directReject.json() as { ok: boolean; error?: { code: string } };
if (directReject.status !== 409) throw new Error(`direct POST should return 409, got ${directReject.status}`);
if (directRejectBody.error?.code !== 'already_bootstrapped') {
  throw new Error(`direct POST error code unexpected: ${JSON.stringify(directRejectBody.error)}`);
}

// Invalid payloads exercise the 422 branches
const badEmail = await handlers.POST(new Request('http://localhost/x', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: 'not-an-email', displayName: 'X', password: '12345678' })
}));
// After bootstrap, the admin-exists check fires before validation, so we expect 409 here.
// But when called during a fresh bootstrap (not this scenario), it would be 422.
// We just assert the route is a gatekeeper that never creates a second user.
if (![409, 422].includes(badEmail.status)) {
  throw new Error(`expected 409 or 422 for post-bootstrap invalid payload, got ${badEmail.status}`);
}

const summary = {
  ok: true,
  checkedAt: new Date().toISOString(),
  dbPath,
  firstRun: {
    exitCode: firstRun.status,
    stdoutHead: firstRun.stdout.split('\n').slice(0, 3).join(' | '),
    createdUserId: afterFirst.row.userId,
    createdEmail: afterFirst.row.email,
    createdRole: afterFirst.row.role,
    adminCountAfter: afterFirst.adminCount,
    passwordHashPrefix: String(afterFirst.row.passwordHash).split('$').slice(0, 2).join('$')
  },
  secondRun: {
    exitCode: secondRun.status,
    stderrHead: secondRun.stderr.split('\n').slice(0, 2).join(' | '),
    rejected: true,
    unchangedUserId: afterSecond.row.userId === afterFirst.row.userId,
    unchangedPasswordHash: afterSecond.row.passwordHash === afterFirst.row.passwordHash,
    unchangedCreatedAt: afterSecond.row.createdAt === afterFirst.row.createdAt,
    totalUsersAfter: afterSecond.totalUsers,
    adminCountAfter: afterSecond.adminCount
  },
  routeSurface: {
    getNeedsBootstrap: statusBody.needsBootstrap,
    getAdminCount: statusBody.adminCount,
    directPostAfterLockoutStatus: directReject.status,
    directPostAfterLockoutCode: directRejectBody.error?.code ?? null
  },
  note: 'T6 cycle 2: bootstrap-admin CLI invoked 2× via --experimental-strip-types against the compiled Next route; idempotency and lockout confirmed by DB snapshot diff.'
};

fs.mkdirSync(evidenceDir, { recursive: true });
fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
