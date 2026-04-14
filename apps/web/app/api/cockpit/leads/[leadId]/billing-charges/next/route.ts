import { createNextLeadLocalBillingCharge } from '../../../../../../../lib/intake-storage';

type BillingChargeProgressionPayload = {
  actor?: string;
  note?: string;
  returnTo?: string;
};

async function parsePayload(request: Request): Promise<BillingChargeProgressionPayload> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return (await request.json()) as BillingChargeProgressionPayload;
  }

  const formData = await request.formData();
  return {
    actor: String(formData.get('actor') ?? ''),
    note: String(formData.get('note') ?? ''),
    returnTo: String(formData.get('returnTo') ?? '')
  };
}

function toActor(value: string | undefined) {
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
  const result = createNextLeadLocalBillingCharge({
    leadId,
    actor: toActor(payload.actor),
    note: payload.note
  });

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);

    if (!result.ok) {
      url.searchParams.set('progressionError', result.error);
      return Response.redirect(url, 303);
    }

    url.searchParams.set('progressionSuccess', result.charge.chargeId);
    return Response.redirect(url, 303);
  }

  if (!result.ok) {
    const status = result.code === 'LEAD_NOT_FOUND' ? 404 : result.code === 'INVALID_ACTOR' ? 400 : 422;
    return Response.json(result, { status });
  }

  return Response.json(result, { status: 201 });
}
