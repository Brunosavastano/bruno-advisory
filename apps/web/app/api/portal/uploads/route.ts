import { portalInviteModel } from '@bruno-advisory/core';
import { getSession, listDocuments, saveDocument } from '../../../../lib/intake-storage';

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
    return Response.json({ ok: false, error: 'Sessão ausente.' }, { status: 401 });
  }

  const session = getSession(sessionToken);
  if (!session) {
    return Response.json({ ok: false, error: 'Sessão inválida.' }, { status: 401 });
  }

  return Response.json({ ok: true, uploads: listDocuments(session.leadId) });
}

export async function POST(request: Request) {
  const sessionToken = getPortalSessionCookie(request);
  if (!sessionToken) {
    return Response.redirect(new URL('/portal/login', request.url), 303);
  }

  const session = getSession(sessionToken);
  if (!session) {
    return Response.redirect(new URL('/portal/login', request.url), 303);
  }

  const formData = await request.formData();
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ ok: false, error: 'Arquivo inválido.' }, { status: 400 });
  }

  const upload = await saveDocument(session.leadId, file);
  if (!upload) {
    return Response.json({ ok: false, error: 'Lead da sessão não encontrado.' }, { status: 404 });
  }

  const returnTo = String(formData.get('returnTo') ?? '');
  if (returnTo.startsWith('/')) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('uploadSuccess', upload.documentId);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, upload }, { status: 201 });
}
