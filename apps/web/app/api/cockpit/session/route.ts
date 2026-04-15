// GET /api/cockpit/session
// Returns the caller's cockpit session context, or 401 if unauthenticated.
// First production caller of `requireCockpitSession` — Cycle 4 of T6.

import { requireCockpitSession } from '../../../../lib/cockpit-session';

export async function GET(request: Request) {
  const check = await requireCockpitSession(request);
  if (!check.ok) {
    return Response.json(check.body, { status: check.status });
  }

  const { context } = check;
  return Response.json({
    ok: true,
    legacy: context.legacy,
    userId: context.userId,
    email: context.email,
    displayName: context.displayName,
    role: context.role,
    actorId: context.actorId,
    sessionId: context.sessionId,
    expiresAt: context.expiresAt
  });
}
