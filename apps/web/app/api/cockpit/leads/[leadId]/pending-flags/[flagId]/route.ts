import { removeLeadPendingFlag } from '../../../../../../../lib/intake-storage';

type PendingFlagRemovePayload = {
  removedBy?: string;
  returnTo?: string;
};

async function parsePayload(request: Request): Promise<PendingFlagRemovePayload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as PendingFlagRemovePayload;
  }
  const formData = await request.formData();
  return {
    removedBy: String(formData.get('removedBy') ?? ''),
    returnTo: String(formData.get('returnTo') ?? '')
  };
}

function toReturnTo(value: string | undefined) {
  return value && value.startsWith('/') ? value : null;
}

export async function DELETE(request: Request, context: { params: Promise<{ leadId: string; flagId: string }> }) {
  const { leadId, flagId } = await context.params;
  const payload = await parsePayload(request).catch(() => ({ removedBy: '', returnTo: '' }));
  const flag = removeLeadPendingFlag(flagId, leadId, payload.removedBy?.trim() || 'operator_local');
  if (!flag) {
    return Response.json({ ok: false, error: 'Flag nao encontrada.' }, { status: 404 });
  }
  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('pendingFlagRemoved', flag.flagId);
    return Response.redirect(url, 303);
  }
  return Response.json({ ok: true, flag });
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string; flagId: string }> }) {
  return DELETE(request, context);
}
