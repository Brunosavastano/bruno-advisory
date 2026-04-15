import { memoStatuses, type MemoStatus } from '@bruno-advisory/core';
import { createMemo, deleteMemo, getStoredLeadById, listMemos, updateMemoBody, updateMemoStatus } from '../../../../../../lib/intake-storage';

type MemoPayload = {
  id?: string;
  title?: string;
  body?: string;
  researchWorkflowId?: string | null;
  status?: string;
  rejectionReason?: string;
  returnTo?: string;
};

async function parsePayload(request: Request): Promise<MemoPayload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as MemoPayload;
  }

  const formData = await request.formData();
  return {
    id: String(formData.get('id') ?? ''),
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
    researchWorkflowId: String(formData.get('researchWorkflowId') ?? ''),
    status: String(formData.get('status') ?? ''),
    rejectionReason: String(formData.get('rejectionReason') ?? ''),
    returnTo: String(formData.get('returnTo') ?? '')
  };
}

function toReturnTo(value: string | undefined) {
  return value && value.startsWith('/') ? value : null;
}

function normalizeStatus(value: string | undefined): MemoStatus | null {
  if (!value) {
    return null;
  }

  return memoStatuses.includes(value as MemoStatus) ? (value as MemoStatus) : null;
}

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  return Response.json({ ok: true, memos: listMemos(leadId) });
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const payload = await parsePayload(request);
  const memo = createMemo({
    leadId,
    title: payload.title ?? '',
    body: payload.body ?? '',
    researchWorkflowId: payload.researchWorkflowId?.trim() || null
  });

  if (!memo) {
    const lead = getStoredLeadById(leadId);
    return Response.json(
      { ok: false, error: lead ? 'Payload invalido.' : 'Lead nao encontrado.' },
      { status: lead ? 400 : 404 }
    );
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('memoCreated', memo.id);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, memo }, { status: 201 });
}

export async function PATCH(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const payload = await parsePayload(request);
  const id = payload.id?.trim();
  if (!id) {
    return Response.json({ ok: false, error: 'Payload invalido.' }, { status: 400 });
  }

  const wantsBodyUpdate = typeof payload.body === 'string' && payload.body.trim().length > 0;
  const wantsStatusUpdate = typeof payload.status === 'string' && payload.status.trim().length > 0;
  const normalizedStatus = wantsStatusUpdate ? normalizeStatus(payload.status) : null;

  if (wantsStatusUpdate && !normalizedStatus) {
    return Response.json({ ok: false, error: 'Status invalido.' }, { status: 400 });
  }

  let memo = null;

  if (wantsBodyUpdate) {
    memo = updateMemoBody(id, leadId, payload.body ?? '');
    if (!memo) {
      return Response.json({ ok: false, error: 'Memo nao encontrado ou body invalido.' }, { status: 404 });
    }
  }

  if (wantsStatusUpdate && normalizedStatus) {
    memo = updateMemoStatus({
      id,
      leadId,
      status: normalizedStatus,
      rejectionReason: payload.rejectionReason?.trim() || null
    });
    if (!memo) {
      return Response.json({ ok: false, error: 'Memo nao encontrado.' }, { status: 404 });
    }
  }

  if (!memo) {
    return Response.json({ ok: false, error: 'Nada para atualizar.' }, { status: 400 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('memoUpdated', memo.id);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, memo });
}

export async function DELETE(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const payload = await parsePayload(request);
  const id = payload.id?.trim();

  if (!id) {
    return Response.json({ ok: false, error: 'Payload invalido.' }, { status: 400 });
  }

  const deleted = deleteMemo(id, leadId);
  if (!deleted) {
    return Response.json({ ok: false, error: 'Memo nao encontrado.' }, { status: 404 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('memoDeleted', id);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true });
}
