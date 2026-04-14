import { createLeadPendingFlag, listLeadPendingFlags } from '../../../../../../lib/intake-storage';

type PendingFlagPayload = {
  flagCode?: string;
  createdBy?: string;
  returnTo?: string;
};

async function parsePayload(request: Request): Promise<PendingFlagPayload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as PendingFlagPayload;
  }
  const formData = await request.formData();
  return {
    flagCode: String(formData.get('flagCode') ?? ''),
    createdBy: String(formData.get('createdBy') ?? ''),
    returnTo: String(formData.get('returnTo') ?? '')
  };
}

function toReturnTo(value: string | undefined) {
  return value && value.startsWith('/') ? value : null;
}

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  return Response.json({ ok: true, flags: listLeadPendingFlags(leadId) });
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const payload = await parsePayload(request);
  const flag = createLeadPendingFlag(leadId, payload.flagCode ?? '', payload.createdBy?.trim() || 'operator_local');
  if (!flag) {
    return Response.json({ ok: false, error: 'Lead nao encontrado ou flag invalida.' }, { status: 404 });
  }
  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('pendingFlagCreated', flag.flagId);
    return Response.redirect(url, 303);
  }
  return Response.json({ ok: true, flag }, { status: 201 });
}
