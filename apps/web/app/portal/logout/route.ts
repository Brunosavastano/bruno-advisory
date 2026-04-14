import { portalInviteModel } from '@bruno-advisory/core';
import { deleteSession } from '../../../lib/intake-storage';

function getPortalSessionCookie(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookie = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${portalInviteModel.cookie.name}=`));

  return cookie ? cookie.slice(`${portalInviteModel.cookie.name}=`.length) : null;
}

export async function POST(request: Request) {
  const sessionToken = getPortalSessionCookie(request);
  if (sessionToken) {
    deleteSession(sessionToken);
  }

  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL('/portal/login', request.url).toString(),
      'Set-Cookie': `${portalInviteModel.cookie.name}=; Path=${portalInviteModel.cookie.path}; HttpOnly; SameSite=${portalInviteModel.cookie.sameSite}; Max-Age=0`
    }
  });
}
