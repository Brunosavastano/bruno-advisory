import { portalInviteModel } from '@bruno-advisory/core';
import { getSession, listWorkflows } from '../../../../lib/intake-storage';

function getPortalSessionCookie(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookie = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${portalInviteModel.cookie.name}=`));

  return cookie ? cookie.slice(`${portalInviteModel.cookie.name}=`.length) : null;
}

export async function GET(request: Request) {
  const sessionToken = getPortalSessionCookie(request);
  if (!sessionToken) {
    return Response.json({ ok: false, error: 'Sessao do portal ausente.' }, { status: 401 });
  }

  const session = getSession(sessionToken);
  if (!session) {
    return Response.json({ ok: false, error: 'Sessao do portal invalida ou expirada.' }, { status: 401 });
  }

  return Response.json({ ok: true, workflows: listWorkflows(session.leadId, 'delivered') });
}
