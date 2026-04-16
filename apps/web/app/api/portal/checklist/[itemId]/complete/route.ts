import { portalInviteModel } from '@savastano-advisory/core';
import { completeLeadOnboardingChecklistItem, getSession } from '../../../../../../lib/intake-storage';

function getPortalSessionCookie(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookie = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${portalInviteModel.cookie.name}=`));

  return cookie ? cookie.slice(`${portalInviteModel.cookie.name}=`.length) : null;
}

export async function POST(request: Request, context: { params: Promise<{ itemId: string }> }) {
  const sessionToken = getPortalSessionCookie(request);
  if (!sessionToken) {
    return Response.redirect(new URL('/portal/login', request.url), 303);
  }

  const session = getSession(sessionToken);
  if (!session) {
    return Response.redirect(new URL('/portal/login', request.url), 303);
  }

  const { itemId } = await context.params;
  const result = completeLeadOnboardingChecklistItem({
    leadId: session.leadId,
    itemId,
    completedBy: 'client'
  });

  if (!result.ok) {
    return Response.json({ ok: false, code: result.code }, { status: 403 });
  }

  return Response.redirect(new URL('/portal/dashboard?checklistSuccess=1', request.url), 303);
}
