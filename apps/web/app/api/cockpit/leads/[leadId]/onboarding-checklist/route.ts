import { createLeadOnboardingChecklistItem } from '../../../../../../lib/intake-storage';

type ChecklistPayload = {
  title?: string;
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
    returnTo: String(formData.get('returnTo') ?? '')
  };
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
  const item = createLeadOnboardingChecklistItem({ leadId, title: payload.title ?? '' });

  if (!item) {
    return Response.json({ ok: false, error: 'Lead ou título inválido.' }, { status: 400 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('checklistCreated', item.itemId);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, item }, { status: 201 });
}
