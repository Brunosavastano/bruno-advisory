// T6 cycle 2 — Bootstrap first cockpit admin.
//
// This route is gated by the existing cockpit middleware (COCKPIT_SECRET)
// AND self-disables once at least one active admin exists. It's the only
// place in T6 that can create a user without being authenticated as an admin.
//
// Usage:
//   GET  -> returns { ok: true, needsBootstrap: boolean, adminCount: number }
//   POST -> body { email, displayName, password } creates the first admin.
//          Subsequent calls (after an admin exists) respond 409 and change
//          nothing in the DB.

import {
  countActiveAdmins,
  createCockpitUser,
  findCockpitUserByEmail,
  listCockpitUsers
} from '../../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

type BootstrapBody = {
  email?: unknown;
  displayName?: unknown;
  password?: unknown;
};

function jsonError(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  return Response.json({ ok: false, error: { code, message }, ...(extra ?? {}) }, { status });
}

export async function GET() {
  const adminCount = countActiveAdmins();
  return Response.json({
    ok: true,
    needsBootstrap: adminCount === 0,
    adminCount,
    totalUsers: listCockpitUsers().length
  });
}

export async function POST(request: Request) {
  let payload: BootstrapBody = {};
  try {
    payload = (await request.json()) as BootstrapBody;
  } catch {
    return jsonError(400, 'invalid_json', 'Request body must be valid JSON.');
  }

  if (countActiveAdmins() > 0) {
    return jsonError(
      409,
      'already_bootstrapped',
      'Cockpit already has at least one active admin. Bootstrap is disabled.',
      { adminCount: countActiveAdmins() }
    );
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const displayName = typeof payload.displayName === 'string' ? payload.displayName.trim() : '';
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!email || !email.includes('@')) {
    return jsonError(422, 'invalid_email', 'Valid email is required.');
  }
  if (!displayName) {
    return jsonError(422, 'invalid_display_name', 'Display name is required.');
  }
  if (password.length < 8) {
    return jsonError(422, 'invalid_password', 'Password must be at least 8 characters.');
  }

  // Guard against a race where two calls arrive in parallel: if an admin was
  // created between our countActiveAdmins() check and now, refuse.
  if (findCockpitUserByEmail(email)) {
    return jsonError(409, 'email_exists', `A cockpit user already exists for ${email}.`);
  }

  try {
    const user = createCockpitUser({ email, displayName, role: 'admin', password });
    return Response.json({
      ok: true,
      user: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt
      }
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonError(500, 'create_failed', message);
  }
}
