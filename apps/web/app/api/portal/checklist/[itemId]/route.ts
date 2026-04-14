import { portalInviteModel } from '@bruno-advisory/core';
import { completeChecklistItem, getSession } from '../../../../../lib/intake-storage';

function getPortalSessionCookie(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookie = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${portalInviteModel.cookie.name}=`));

  return cookie ? cookie.slice(`${portalInviteModel.cookie.name}=`.length) : null;
}

async function getReturnTo(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('form')) {
    return null;
  }

  const formData = await request.formData();
  const returnTo = String(formData.get('returnTo') ?? '');
  return returnTo.startsWith('/') ? returnTo : null;
}

export async function POST(request: Request, context: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await context.params;
  const sessionToken = getPortalSessionCookie(request);

  if (!sessionToken) {
    return Response.json({ ok: false, error: 'Sessao do portal ausente.' }, { status: 401 });
  }

  const session = getSession(sessionToken);
  if (!session) {
    return Response.json({ ok: false, error: 'Sessao do portal invalida ou expirada.' }, { status: 401 });
  }

  const item = completeChecklistItem(itemId, session.leadId, 'client');
  if (!item) {
    return Response.json({ ok: false, error: 'Checklist item nao pertence a esta sessao.' }, { status: 403 });
  }

  const returnTo = await getReturnTo(request);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('checklistCompleted', item.itemId);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, item });
}
