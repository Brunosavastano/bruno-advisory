import { createLeadInternalNote } from '../../../../../../lib/intake-storage';

type NotePayload = {
  content?: string;
  authorMarker?: string;
  returnTo?: string;
};

async function parsePayload(request: Request): Promise<NotePayload> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return (await request.json()) as NotePayload;
  }

  const formData = await request.formData();
  return {
    content: String(formData.get('content') ?? ''),
    authorMarker: String(formData.get('authorMarker') ?? ''),
    returnTo: String(formData.get('returnTo') ?? '')
  };
}

function toAuthorMarker(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'operator_local';
}

function toReturnTo(value: string | undefined) {
  if (!value || !value.startsWith('/')) {
    return null;
  }
  return value;
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const payload = await parsePayload(request);

  const content = payload.content?.trim() ?? '';
  if (!content) {
    return Response.json({ ok: false, error: 'Conteudo da nota e obrigatorio.' }, { status: 400 });
  }

  const created = createLeadInternalNote({
    leadId,
    content,
    authorMarker: toAuthorMarker(payload.authorMarker)
  });

  if (!created) {
    return Response.json({ ok: false, error: 'Lead nao encontrado ou payload invalido.' }, { status: 404 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, note: created }, { status: 201 });
}
