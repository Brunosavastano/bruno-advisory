import { createInvite } from '../../../../../../lib/intake-storage';

type InvitePayload = {
  returnTo?: string;
};

async function parsePayload(request: Request): Promise<InvitePayload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as InvitePayload;
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

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const payload = await parsePayload(request);
  const invite = createInvite(leadId);

  if (!invite) {
    return Response.json({ ok: false, error: 'Lead não encontrado.' }, { status: 404 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('portalInviteCreated', invite.code);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, invite });
}
