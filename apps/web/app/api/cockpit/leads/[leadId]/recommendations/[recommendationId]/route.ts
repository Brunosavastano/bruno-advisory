import { deleteRecommendation, publishRecommendation } from '../../../../../../../lib/intake-storage';
import { requireCockpitSession } from '../../../../../../../lib/cockpit-session';

type RecommendationActionPayload = {
  returnTo?: string;
};

async function parsePayload(request: Request): Promise<RecommendationActionPayload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as RecommendationActionPayload;
  }

  const formData = await request.formData();
  return {
    returnTo: String(formData.get('returnTo') ?? '')
  };
}

function toReturnTo(value: string | undefined) {
  return value && value.startsWith('/') ? value : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ leadId: string; recommendationId: string }> }
) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { leadId, recommendationId } = await context.params;
  const recommendation = publishRecommendation(recommendationId, leadId, check.context.actorId);

  if (!recommendation) {
    return Response.json({ ok: false, error: 'Recomendacao nao encontrada.' }, { status: 404 });
  }

  const payload = await parsePayload(request).catch(() => ({ returnTo: '' }));
  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('recommendationPublished', recommendation.recommendationId);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, recommendation });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ leadId: string; recommendationId: string }> }
) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { leadId, recommendationId } = await context.params;
  const deleted = deleteRecommendation(recommendationId, leadId, check.context.actorId);

  if (!deleted) {
    return Response.json({ ok: false, error: 'Recomendacao nao encontrada.' }, { status: 404 });
  }

  const payload = await parsePayload(request).catch(() => ({ returnTo: '' }));
  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('recommendationDeleted', recommendationId);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string; recommendationId: string }> }
) {
  const formData = await request.formData();
  const intent = String(formData.get('intent') ?? '').trim();
  const returnTo = String(formData.get('returnTo') ?? '');
  const body = new URLSearchParams();
  if (returnTo) {
    body.set('returnTo', returnTo);
  }

  const delegatedHeaders: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded'
  };
  const forwardCookie = request.headers.get('cookie');
  if (forwardCookie) delegatedHeaders.cookie = forwardCookie;
  const delegatedRequest = new Request(request.url, {
    method: intent === 'publish' ? 'PATCH' : 'DELETE',
    headers: delegatedHeaders,
    body: body.toString()
  });

  if (intent === 'publish') {
    return PATCH(delegatedRequest, context);
  }

  return DELETE(delegatedRequest, context);
}
