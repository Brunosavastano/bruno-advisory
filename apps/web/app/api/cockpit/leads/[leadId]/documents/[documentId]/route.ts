import { documentUploadStatuses } from '@bruno-advisory/core';
import { reviewDocument } from '../../../../../../../lib/intake-storage';

type ReviewPayload = {
  status?: string;
  reviewNote?: string | null;
  reviewedBy?: string | null;
  returnTo?: string | null;
};

async function parsePayload(request: Request): Promise<ReviewPayload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as ReviewPayload;
  }

  const formData = await request.formData();
  return {
    status: String(formData.get('status') ?? ''),
    reviewNote: String(formData.get('reviewNote') ?? ''),
    reviewedBy: String(formData.get('reviewedBy') ?? 'operator_local'),
    returnTo: String(formData.get('returnTo') ?? '')
  };
}

function toReturnTo(value: string | null | undefined) {
  return value && value.startsWith('/') ? value : null;
}

export async function PATCH(request: Request, context: { params: Promise<{ leadId: string; documentId: string }> }) {
  const { leadId, documentId } = await context.params;
  const payload = await parsePayload(request);

  if (!documentUploadStatuses.includes(payload.status as (typeof documentUploadStatuses)[number])) {
    return Response.json({ ok: false, error: 'Status de revisao invalido.' }, { status: 400 });
  }

  const status = payload.status as (typeof documentUploadStatuses)[number];
  const document = reviewDocument(documentId, leadId, status, payload.reviewedBy ?? 'operator_local', payload.reviewNote ?? null);
  if (!document) {
    return Response.json({ ok: false, error: 'Documento nao encontrado.' }, { status: 404 });
  }

  return Response.json({ ok: true, document });
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string; documentId: string }> }) {
  const { leadId, documentId } = await context.params;
  const payload = await parsePayload(request);

  if (!documentUploadStatuses.includes(payload.status as (typeof documentUploadStatuses)[number])) {
    return Response.json({ ok: false, error: 'Status de revisao invalido.' }, { status: 400 });
  }

  const status = payload.status as (typeof documentUploadStatuses)[number];
  const document = reviewDocument(documentId, leadId, status, payload.reviewedBy ?? 'operator_local', payload.reviewNote ?? null);
  if (!document) {
    return Response.json({ ok: false, error: 'Documento nao encontrado.' }, { status: 404 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('documentReviewSuccess', document.documentId);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, document });
}
