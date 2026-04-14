import { deleteChecklistItem, uncompleteChecklistItem } from '../../../../../../../lib/intake-storage';

type ChecklistItemPayload = {
  returnTo?: string;
};

async function parsePayload(request: Request): Promise<ChecklistItemPayload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as ChecklistItemPayload;
  }

  const formData = await request.formData();
  return {
    returnTo: String(formData.get('returnTo') ?? '')
  };
}

function toReturnTo(value: string | undefined) {
  if (!value || !value.startsWith('/')) {
    return null;
  }
  return value;
}

export async function DELETE(request: Request, context: { params: Promise<{ leadId: string; itemId: string }> }) {
  const { leadId, itemId } = await context.params;
  const deleted = deleteChecklistItem(itemId, leadId);

  if (!deleted) {
    return Response.json({ ok: false, error: 'Checklist item nao encontrado.' }, { status: 404 });
  }

  const payload = await parsePayload(request).catch(() => ({ returnTo: '' }));
  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('checklistDeleted', '1');
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true });
}

export async function PATCH(request: Request, context: { params: Promise<{ leadId: string; itemId: string }> }) {
  const { leadId, itemId } = await context.params;
  const item = uncompleteChecklistItem(itemId, leadId);

  if (!item) {
    return Response.json({ ok: false, error: 'Checklist item nao encontrado.' }, { status: 404 });
  }

  const payload = await parsePayload(request).catch(() => ({ returnTo: '' }));
  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('checklistUncompleted', '1');
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, item });
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string; itemId: string }> }) {
  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '').trim();
  const returnTo = String(formData.get('returnTo') ?? '');
  const body = new URLSearchParams();
  if (returnTo) {
    body.set('returnTo', returnTo);
  }

  const delegatedRequest = new Request(request.url, {
    method: intent === 'uncomplete' ? 'PATCH' : 'DELETE',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  });

  if (intent === 'uncomplete') {
    return PATCH(delegatedRequest, context);
  }

  return DELETE(delegatedRequest, context);
}
