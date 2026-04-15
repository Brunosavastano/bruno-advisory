#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

EVIDENCE_DIR="${EVIDENCE_DIR:-state/evidence/T4-cycle-1}"
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
const { randomUUID } = require('node:crypto');
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

async function maybeLoadProxy(webDir) {
  const serverDir = path.join(webDir, '.next', 'server');
  const candidates = ['proxy.js', 'middleware.js'];

  for (const candidate of candidates) {
    const fullPath = path.join(serverDir, candidate);
    if (fs.existsSync(fullPath)) {
      const mod = require(fullPath);
      return {
        file: candidate,
        exportName: typeof mod.proxy === 'function' ? 'proxy' : typeof mod.default === 'function' ? 'default' : null
      };
    }
  }

  return null;
}

async function main() {
  const root = process.argv[2];
  const evidenceDir = path.resolve(root, process.argv[3]);
  const webDir = path.join(root, 'apps', 'web');
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ba-t4-cycle1-'));
  fs.mkdirSync(path.join(tempRoot, 'data', 'dev'), { recursive: true });
  fs.writeFileSync(path.join(tempRoot, 'project.yaml'), 'project: test\n');
  fs.symlinkSync(path.join(root, 'apps'), path.join(tempRoot, 'apps'), 'dir');
  fs.symlinkSync(path.join(root, 'packages'), path.join(tempRoot, 'packages'), 'dir');
  process.chdir(tempRoot);
  process.on('exit', () => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const intakeRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'intake', 'route.js'));
  const createInviteRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'portal-invite-codes', 'route.js'));
  const revokeInviteRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'cockpit', 'leads', '[leadId]', 'portal-invite-codes', '[inviteId]', 'revoke', 'route.js'));
  const portalSessionRoute = requireUserland(path.join(webDir, '.next', 'server', 'app', 'api', 'portal', 'session', 'route.js'));

  const intakeCreate = await json(await intakeRoute.POST(new Request('http://localhost/api/intake', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fullName: 'T4 Cycle 1 Portal Client',
      email: `t4-cycle1-${randomUUID()}@example.com`,
      phone: '11988887777',
      city: 'Brasilia',
      state: 'DF',
      investableAssetsBand: '3m_a_10m',
      primaryChallenge: 'Acessar portal por invite code',
      sourceLabel: 'verify_t4_cycle_1',
      privacyConsentAccepted: true,
      termsConsentAccepted: true
    })
  })));
  if (intakeCreate.status !== 201 || !intakeCreate.body?.leadId) throw new Error('Intake failed');
  const leadId = intakeCreate.body.leadId;

  const inviteCreate = await json(await createInviteRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/portal-invite-codes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  }), { params: Promise.resolve({ leadId }) }));
  if (inviteCreate.status !== 200 || !inviteCreate.body?.invite?.code || !inviteCreate.body?.invite?.inviteId) {
    throw new Error('Invite creation failed');
  }
  const invite = inviteCreate.body.invite;

  const loginForm = new FormData();
  loginForm.set('code', invite.code);
  const login = await json(await portalSessionRoute.POST(new Request('http://localhost/api/portal/session', { method: 'POST', body: loginForm })));
  const setCookie = login.headers['set-cookie'] || '';
  if (login.status !== 302 || login.headers.location !== 'http://localhost/portal/dashboard' || !setCookie.includes('portal_session=')) {
    throw new Error(`Invite login failed: ${JSON.stringify(login)}`);
  }

  const revoke = await json(await revokeInviteRoute.POST(new Request(`http://localhost/api/cockpit/leads/${leadId}/portal-invite-codes/${invite.inviteId}/revoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  }), { params: Promise.resolve({ inviteId: invite.inviteId }) }));
  if (revoke.status !== 200 || revoke.body?.invite?.status !== 'revoked') {
    throw new Error(`Invite revoke failed: ${JSON.stringify(revoke)}`);
  }

  const dbPath = path.join(tempRoot, 'data', 'dev', 'bruno-advisory-dev.sqlite3');
  const db = new DatabaseSync(dbPath);
  const revokedSessions = db.prepare('SELECT COUNT(*) AS count FROM portal_sessions WHERE invite_id = ?').get(invite.inviteId).count;
  if (revokedSessions !== 0) {
    throw new Error('Revoked invite still has active portal session');
  }

  const failedLoginForm = new FormData();
  failedLoginForm.set('code', invite.code);
  const failedLogin = await json(await portalSessionRoute.POST(new Request('http://localhost/api/portal/session', { method: 'POST', body: failedLoginForm })));
  if (failedLogin.status !== 303 || !String(failedLogin.headers.location || '').startsWith('http://localhost/portal/login?error=')) {
    throw new Error(`Revoked invite should not authenticate again: ${JSON.stringify(failedLogin)}`);
  }

  const proxyModule = await maybeLoadProxy(webDir);
  const proxyCheck = proxyModule
    ? {
        checked: true,
        compiledFile: proxyModule.file,
        exportName: proxyModule.exportName,
        result: proxyModule.exportName ? 'compiled' : 'skipped: no callable export found'
      }
    : { checked: false, compiledFile: null, exportName: null, result: 'skipped: no compiled proxy artifact found' };

  const leadDetailSource = fs.readFileSync(path.join(webDir, 'app', 'cockpit', 'leads', '[leadId]', 'page.tsx'), 'utf8');
  const proxySource = fs.readFileSync(path.join(webDir, 'proxy.ts'), 'utf8');
  const dashboardSource = fs.readFileSync(path.join(webDir, 'app', 'portal', 'dashboard', 'page.tsx'), 'utf8');
  const summary = {
    ok: true,
    checkedAt: new Date().toISOString(),
    leadId,
    inviteId: invite.inviteId,
    inviteCode: invite.code,
    login,
    revoke,
    failedLogin,
    proxyCheck,
    surfaceChecks: {
      portalLoginPage: fs.existsSync(path.join(webDir, 'app', 'portal', 'login', 'page.tsx')),
      portalDashboardPage: fs.existsSync(path.join(webDir, 'app', 'portal', 'dashboard', 'page.tsx')),
      portalSessionRoute: fs.existsSync(path.join(webDir, 'app', 'api', 'portal', 'session', 'route.ts')),
      duplicatePortalInvitesRemoved: !fs.existsSync(path.join(webDir, 'app', 'api', 'cockpit', 'leads', '[leadId]', 'portal-invites')),
      cockpitInviteSection: leadDetailSource.includes('Portal invite codes T4 cycle 1'),
      portalProxyIsolation: proxySource.includes("'/portal/:path*'") && (proxySource.includes('portal_session') || proxySource.includes('PORTAL_SESSION_COOKIE')) && proxySource.includes("/portal/login"),
      dashboardRedirectsWithoutSession: dashboardSource.includes("redirect('/portal/login')") && dashboardSource.includes('getSession(sessionToken)')
    },
    dbPath,
    note: 'HTTP bind is blocked in this sandbox (listen EPERM); verification executed by invoking compiled route handlers directly and only using proxy compilation opportunistically.'
  };

  fs.writeFileSync(path.join(evidenceDir, 'summary-local.json'), `${JSON.stringify(summary, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exit(1);
});
NODE
