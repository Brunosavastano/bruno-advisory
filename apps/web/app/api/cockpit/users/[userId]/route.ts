// PATCH /api/cockpit/users/[userId] — update displayName, role, isActive, or
// password. Deactivating via isActive=false atomically drops the target's open
// sessions (see updateCockpitUser in cockpit-auth storage). Admin only.

import { isCockpitRole } from '@bruno-advisory/core';
import {
  updateCockpitUser,
  findCockpitUserById,
  countActiveAdmins
} from '../../../../../lib/intake-storage';
import { requireCockpitAdmin } from '../../../../../lib/cockpit-session';

type UpdatePayload = {
  displayName?: unknown;
  role?: unknown;
  isActive?: unknown;
  password?: unknown;
};

function readOptionalString(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export async function PATCH(request: Request, context: { params: Promise<{ userId: string }> }) {
  const check = await requireCockpitAdmin(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { userId } = await context.params;
  if (!userId) {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const existing = findCockpitUserById(userId);
  if (!existing) {
    return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  let payload: UpdatePayload;
  try {
    payload = (await request.json()) as UpdatePayload;
  } catch {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const updates: Parameters<typeof updateCockpitUser>[1] = {};

  const displayName = readOptionalString(payload.displayName);
  if (displayName !== undefined) updates.displayName = displayName;

  if (payload.role !== undefined) {
    if (typeof payload.role !== 'string' || !isCockpitRole(payload.role)) {
      return Response.json({ ok: false, error: 'invalid_role' }, { status: 400 });
    }
    updates.role = payload.role;
  }

  if (payload.isActive !== undefined) {
    if (typeof payload.isActive !== 'boolean') {
      return Response.json({ ok: false, error: 'invalid_is_active' }, { status: 400 });
    }
    updates.isActive = payload.isActive;
  }

  if (payload.password !== undefined) {
    if (typeof payload.password !== 'string' || payload.password.length < 8) {
      return Response.json({ ok: false, error: 'invalid_password' }, { status: 400 });
    }
    updates.password = payload.password;
  }

  // Guardrail: never let the last active admin demote themselves or be deactivated.
  const wouldRemoveAdmin =
    (updates.role !== undefined && updates.role !== 'admin' && existing.role === 'admin') ||
    (updates.isActive === false && existing.role === 'admin' && existing.isActive);

  if (wouldRemoveAdmin && countActiveAdmins() <= 1) {
    return Response.json({ ok: false, error: 'last_admin_protected' }, { status: 409 });
  }

  try {
    const updated = updateCockpitUser(userId, updates);
    if (!updated) {
      return Response.json({ ok: false, error: 'not_found' }, { status: 404 });
    }
    return Response.json({ ok: true, user: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json({ ok: false, error: 'update_failed', message }, { status: 500 });
  }
}
