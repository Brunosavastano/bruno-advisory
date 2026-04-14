import { recommendationCategories, type RecommendationCategory } from '@bruno-advisory/core';
import { createRecommendation, listRecommendations } from '../../../../../../lib/intake-storage';

type RecommendationPayload = {
  title?: string;
  body?: string;
  recommendationDate?: string;
  category?: string | null;
  createdBy?: string;
  returnTo?: string;
};

async function parsePayload(request: Request): Promise<RecommendationPayload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as RecommendationPayload;
  }

  const formData = await request.formData();
  return {
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
    recommendationDate: String(formData.get('recommendationDate') ?? ''),
    category: String(formData.get('category') ?? ''),
    createdBy: String(formData.get('createdBy') ?? ''),
    returnTo: String(formData.get('returnTo') ?? '')
  };
}

function toReturnTo(value: string | undefined) {
  return value && value.startsWith('/') ? value : null;
}

function normalizeCategory(value: string | null | undefined): RecommendationCategory | null {
  if (!value) {
    return null;
  }

  return recommendationCategories.includes(value as RecommendationCategory)
    ? (value as RecommendationCategory)
    : null;
}

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  return Response.json({ ok: true, recommendations: listRecommendations(leadId) });
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const payload = await parsePayload(request);
  const recommendation = createRecommendation(
    leadId,
    payload.title ?? '',
    payload.body ?? '',
    payload.recommendationDate ?? '',
    normalizeCategory(payload.category),
    payload.createdBy?.trim() || 'operator_local'
  );

  if (!recommendation) {
    return Response.json({ ok: false, error: 'Lead nao encontrado ou payload invalido.' }, { status: 404 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('recommendationCreated', '1');
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, recommendation }, { status: 201 });
}
