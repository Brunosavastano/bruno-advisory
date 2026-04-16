// POST /api/cockpit/logout
// Revokes the active session (if any) and expires the cookie.
// Idempotent: calling without a cookie still returns 200.

import { cockpitAuthModel } from '@savastano-advisory/core';
import { deleteCockpitSessionByToken } from '../../../../lib/intake-storage';
import { COCKPIT_SESSION_COOKIE } from '../../../../lib/cockpit-session';

function parseCookieHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const raw of header.split(';')) {
    const segment = raw.trim();
    if (!segment) continue;
    const eq = segment.indexOf('=');
    if (eq <= 0) continue;
    const name = segment.slice(0, eq).trim();
    const value = segment.slice(eq + 1).trim();
    if (!name || name in out) continue;
    out[name] = value;
  }
  return out;
}

export async function POST(request: Request) {
  const cookies = parseCookieHeader(request.headers.get('cookie'));
  const sessionToken = cookies[COCKPIT_SESSION_COOKIE];

  let revoked = false;
  if (sessionToken) {
    revoked = deleteCockpitSessionByToken(sessionToken);
  }

  const secure = (request.headers.get('x-forwarded-proto') ?? '').toLowerCase() === 'https';
  const cookieParts = [
    `${COCKPIT_SESSION_COOKIE}=`,
    'HttpOnly',
    `SameSite=${cockpitAuthModel.cookie.sameSite.charAt(0).toUpperCase()}${cockpitAuthModel.cookie.sameSite.slice(1)}`,
    `Path=${cockpitAuthModel.cookie.path}`,
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  ];
  if (secure) {
    cookieParts.push('Secure');
  }

  const response = Response.json({ ok: true, revoked });
  response.headers.set('set-cookie', cookieParts.join('; '));
  return response;
}
