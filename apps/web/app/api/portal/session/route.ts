import { portalInviteModel } from '@bruno-advisory/core';
import { redeemInvite } from '../../../../lib/intake-storage';

function loginErrorUrl(request: Request, message: string) {
  const url = new URL('/portal/login', request.url);
  url.searchParams.set('error', message);
  return url;
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const code = String(formData.get('code') ?? '').trim();
  const session = redeemInvite(code);

  if (!session) {
    return Response.redirect(loginErrorUrl(request, 'Código inválido, expirado, usado ou revogado.'), 303);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL('/portal/dashboard', request.url).toString(),
      'Set-Cookie': `${portalInviteModel.cookie.name}=${session.sessionToken}; Path=${portalInviteModel.cookie.path}; HttpOnly; SameSite=${portalInviteModel.cookie.sameSite}; Max-Age=${portalInviteModel.sessionExpiryDays * 24 * 60 * 60}`
    }
  });
}
