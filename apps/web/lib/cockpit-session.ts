// Cockpit session helper — runs INSIDE Next.js route handlers (Node runtime).
// MUST NOT be called from middleware (Edge runtime cannot touch SQLite).
//
// Contract:
//   const check = await requireCockpitSession(request);
//   if (!check.ok) return Response.json(check.body, { status: check.status });
//   const { context } = check;
//   writeAuditLog({ ..., actorId: context.actorId });
//
// Accepts two auth paths:
//   1. Session cookie (cockpit_session) → full session lookup in DB.
//   2. Legacy COCKPIT_SECRET cookie (cockpit_token) → fallback context with
//      actorId='legacy-secret'. Removed in T7 once every caller has moved to
//      session-based auth.

import { cockpitAuthModel, type CockpitRole } from '@bruno-advisory/core';
import {
  findCockpitSessionByToken,
  isCockpitSessionValid,
  type CockpitSessionLookupRow
} from './intake-storage';

export const COCKPIT_SESSION_COOKIE = cockpitAuthModel.cookie.name;
export const COCKPIT_LEGACY_TOKEN_COOKIE = 'cockpit_token';

export type CockpitSessionContext =
  | {
      legacy: false;
      userId: string;
      email: string;
      displayName: string;
      role: CockpitRole;
      actorId: string;
      sessionId: string;
      expiresAt: string;
    }
  | {
      legacy: true;
      userId: null;
      email: null;
      displayName: null;
      role: 'operator';
      actorId: typeof cockpitAuthModel.legacySecretActorId;
      sessionId: null;
      expiresAt: null;
    };

export type CockpitSessionCheck =
  | { ok: true; context: CockpitSessionContext }
  | { ok: false; status: number; body: { ok: false; error: string; reason?: string } };

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
    if (!name) continue;
    // Take the FIRST occurrence (browsers prepend fresher cookies; mirror them via the Cookie header order)
    if (!(name in out)) {
      out[name] = value;
    }
  }
  return out;
}

function readCookiesFromRequest(request: Request): Record<string, string> {
  const header = request.headers.get('cookie');
  return parseCookieHeader(header);
}

function buildLegacyContext(): CockpitSessionContext {
  return {
    legacy: true,
    userId: null,
    email: null,
    displayName: null,
    role: 'operator',
    actorId: cockpitAuthModel.legacySecretActorId,
    sessionId: null,
    expiresAt: null
  };
}

function buildSessionContext(session: CockpitSessionLookupRow): CockpitSessionContext {
  return {
    legacy: false,
    userId: session.userId,
    email: session.email,
    displayName: session.displayName,
    role: session.role,
    actorId: session.userId,
    sessionId: session.sessionId,
    expiresAt: session.expiresAt
  };
}

/**
 * Resolve the cockpit session context for a Next.js route handler.
 *
 * Priority:
 *   1. If `cockpit_session` cookie is present and points to a valid, non-expired
 *      session for an active user → real session context.
 *   2. Else if `cockpit_token` cookie matches `process.env.COCKPIT_SECRET` → legacy
 *      fallback context with `actorId='legacy-secret'`.
 *   3. Else 401.
 *
 * Invariants:
 *   - Must be called from a Node-runtime route handler, never from middleware.
 *   - `COCKPIT_SECRET` fallback stays active throughout T6 (removed in T7).
 */
export async function requireCockpitSession(request: Request): Promise<CockpitSessionCheck> {
  const cookies = readCookiesFromRequest(request);
  const sessionToken = cookies[COCKPIT_SESSION_COOKIE];
  if (sessionToken) {
    const lookup = findCockpitSessionByToken(sessionToken);
    if (lookup && isCockpitSessionValid(lookup)) {
      return { ok: true, context: buildSessionContext(lookup) };
    }
    if (lookup && !lookup.isActive) {
      return { ok: false, status: 401, body: { ok: false, error: 'unauthorized', reason: 'user_disabled' } };
    }
    if (lookup) {
      return { ok: false, status: 401, body: { ok: false, error: 'unauthorized', reason: 'session_expired' } };
    }
    // Cookie present but no matching session — fall through to secret check, then 401.
  }

  const legacyToken = cookies[COCKPIT_LEGACY_TOKEN_COOKIE];
  const secret = process.env.COCKPIT_SECRET;
  if (legacyToken && secret && legacyToken === secret) {
    return { ok: true, context: buildLegacyContext() };
  }

  return { ok: false, status: 401, body: { ok: false, error: 'unauthorized' } };
}

/**
 * Like requireCockpitSession, but additionally requires `role === 'admin'`.
 *
 * Legacy `COCKPIT_SECRET` fallback always resolves to `role: 'operator'` — so
 * admin-only surfaces (users management, role changes, deactivation) cannot be
 * reached via the legacy path. Only real admin sessions pass.
 */
export async function requireCockpitAdmin(request: Request): Promise<CockpitSessionCheck> {
  const check = await requireCockpitSession(request);
  if (!check.ok) return check;
  if (check.context.role !== 'admin') {
    return { ok: false, status: 403, body: { ok: false, error: 'forbidden', reason: 'admin_required' } };
  }
  return check;
}
