// POST /api/cockpit/login
// Verifies credentials, creates a session row, sets the httpOnly cookie.
// First issuer of the cockpit_session cookie — Cycle 5 of T6.

import { cockpitAuthModel } from '@bruno-advisory/core';
import {
  findCockpitUserByEmail,
  verifyPassword,
  createCockpitSession
} from '../../../../lib/intake-storage';
import { COCKPIT_SESSION_COOKIE } from '../../../../lib/cockpit-session';

type LoginPayload = {
  email?: unknown;
  password?: unknown;
};

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  let payload: LoginPayload;
  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const email = readString(payload.email).toLowerCase();
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!email || !password) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const user = findCockpitUserByEmail(email);
  if (!user) {
    return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return Response.json({ ok: false, error: 'invalid_credentials' }, { status: 401 });
  }

  if (!user.isActive) {
    return Response.json({ ok: false, error: 'user_disabled' }, { status: 403 });
  }

  const session = createCockpitSession(user.userId);

  const secure = (request.headers.get('x-forwarded-proto') ?? '').toLowerCase() === 'https';
  const maxAgeSeconds = cockpitAuthModel.sessionExpiryDays * 24 * 60 * 60;
  const cookieParts = [
    `${COCKPIT_SESSION_COOKIE}=${session.sessionToken}`,
    'HttpOnly',
    `SameSite=${cockpitAuthModel.cookie.sameSite.charAt(0).toUpperCase()}${cockpitAuthModel.cookie.sameSite.slice(1)}`,
    `Path=${cockpitAuthModel.cookie.path}`,
    `Max-Age=${maxAgeSeconds}`,
    `Expires=${new Date(Date.now() + maxAgeSeconds * 1000).toUTCString()}`
  ];
  if (secure) {
    cookieParts.push('Secure');
  }

  const response = Response.json({
    ok: true,
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    expiresAt: session.expiresAt
  });
  response.headers.set('set-cookie', cookieParts.join('; '));
  return response;
}
