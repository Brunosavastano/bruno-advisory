import { revokeInvite } from '../../../../../../../../lib/intake-storage';

type RevokePayload = {
  returnTo?: string;
};

async function parsePayload(request: Request): Promise<RevokePayload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as RevokePayload;
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

export async function POST(request: Request, context: { params: Promise<{ inviteId: string }> }) {
  const { inviteId } = await context.params;
  const payload = await parsePayload(request);
  const invite = revokeInvite(inviteId);

  if (!invite) {
    return Response.json({ ok: false, error: 'Invite code não encontrado.' }, { status: 404 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('portalInviteRevoked', invite.inviteId);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, invite });
}
