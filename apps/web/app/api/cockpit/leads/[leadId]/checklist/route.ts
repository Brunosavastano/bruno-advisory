import { createChecklistItem, listChecklistItems } from '../../../../../../lib/intake-storage';

type ChecklistPayload = {
  title?: string;
  description?: string;
  returnTo?: string;
};

async function parsePayload(request: Request): Promise<ChecklistPayload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as ChecklistPayload;
  }

  const formData = await request.formData();
  return {
    title: String(formData.get('title') ?? ''),
    description: String(formData.get('description') ?? ''),
    returnTo: String(formData.get('returnTo') ?? '')
  };
}

function toReturnTo(value: string | undefined) {
  if (!value || !value.startsWith('/')) {
    return null;
  }
  return value;
}

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  return Response.json({ ok: true, items: listChecklistItems(leadId) });
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const payload = await parsePayload(request);
  const title = payload.title?.trim() ?? '';

  if (!title) {
    return Response.json({ ok: false, error: 'Titulo do checklist e obrigatorio.' }, { status: 400 });
  }

  const item = createChecklistItem(leadId, title, payload.description ?? null);
  if (!item) {
    return Response.json({ ok: false, error: 'Lead nao encontrado ou payload invalido.' }, { status: 404 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('checklistCreated', '1');
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, item }, { status: 201 });
}
