// GET /api/cockpit/users — list all cockpit users (admin only)
// POST /api/cockpit/users — create a new cockpit user (admin only)

import { cockpitRoles, isCockpitRole } from '@savastano-advisory/core';
import { listCockpitUsers, createCockpitUser } from '../../../../lib/intake-storage';
import { requireCockpitAdmin } from '../../../../lib/cockpit-session';

export async function GET(request: Request) {
  const check = await requireCockpitAdmin(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const users = listCockpitUsers();
  return Response.json({ ok: true, users });
}

type CreatePayload = {
  email?: unknown;
  displayName?: unknown;
  role?: unknown;
  password?: unknown;
};

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request) {
  const check = await requireCockpitAdmin(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  let payload: CreatePayload;
  try {
    payload = (await request.json()) as CreatePayload;
  } catch {
    return Response.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
  }

  const email = readString(payload.email).toLowerCase();
  const displayName = readString(payload.displayName);
  const role = readString(payload.role);
  const password = typeof payload.password === 'string' ? payload.password : '';

  if (!email || !email.includes('@') || !displayName || !isCockpitRole(role) || password.length < 8) {
    return Response.json(
      { ok: false, error: 'invalid_payload', allowedRoles: cockpitRoles, minPasswordLength: 8 },
      { status: 400 }
    );
  }

  try {
    const user = createCockpitUser({ email, displayName, role, password });
    return Response.json({ ok: true, user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes('already exists')) {
      return Response.json({ ok: false, error: 'email_already_exists' }, { status: 409 });
    }
    return Response.json({ ok: false, error: 'create_failed', message }, { status: 500 });
  }
}
