import {
  documentUploadAllowedMimeTypes,
  documentUploadMaxSizeBytes,
  portalInviteModel
} from '@savastano-advisory/core';
import { getSession, listDocuments, saveDocument } from '../../../../lib/intake-storage';

function getPortalSessionCookie(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const cookie = cookieHeader
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${portalInviteModel.cookie.name}=`));

  return cookie ? cookie.slice(`${portalInviteModel.cookie.name}=`.length) : null;
}

async function getPortalLeadId(request: Request) {
  const sessionToken = getPortalSessionCookie(request);
  if (!sessionToken) {
    return null;
  }

  return getSession(sessionToken);
}

export async function GET(request: Request) {
  const session = await getPortalLeadId(request);
  if (!session) {
    return Response.json({ ok: false, error: 'Sessao do portal ausente ou invalida.' }, { status: 401 });
  }

  return Response.json({ ok: true, documents: listDocuments(session.leadId) });
}

export async function POST(request: Request) {
  const session = await getPortalLeadId(request);
  if (!session) {
    return Response.json({ ok: false, error: 'Sessao do portal ausente ou invalida.' }, { status: 401 });
  }

  const formData = await request.formData();
  const fileEntry = formData.get('file');
  if (!(fileEntry instanceof File)) {
    return Response.json({ ok: false, error: 'Arquivo ausente.' }, { status: 400 });
  }

  if (!documentUploadAllowedMimeTypes.includes(fileEntry.type as (typeof documentUploadAllowedMimeTypes)[number])) {
    return Response.json({ ok: false, error: 'Tipo de arquivo nao permitido.' }, { status: 422 });
  }

  if (fileEntry.size > documentUploadMaxSizeBytes) {
    return Response.json({ ok: false, error: 'Arquivo excede 10MB.' }, { status: 422 });
  }

  const document = await saveDocument(session.leadId, fileEntry);
  if (!document) {
    return Response.json({ ok: false, error: 'Lead da sessao nao encontrado.' }, { status: 404 });
  }

  return Response.json({ ok: true, document }, { status: 201 });
}
