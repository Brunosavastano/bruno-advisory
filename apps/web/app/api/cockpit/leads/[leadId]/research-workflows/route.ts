import { researchWorkflowStatuses, type ResearchWorkflowStatus } from '@bruno-advisory/core';
import { createWorkflow, deleteWorkflow, getStoredLeadById, listWorkflows, updateStatus } from '../../../../../../lib/intake-storage';

type ResearchWorkflowPayload = {
  id?: string;
  title?: string;
  topic?: string;
  status?: string;
  rejectionReason?: string;
  returnTo?: string;
};

async function parsePayload(request: Request): Promise<ResearchWorkflowPayload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as ResearchWorkflowPayload;
  }

  const formData = await request.formData();
  return {
    id: String(formData.get('id') ?? ''),
    title: String(formData.get('title') ?? ''),
    topic: String(formData.get('topic') ?? ''),
    status: String(formData.get('status') ?? ''),
    rejectionReason: String(formData.get('rejectionReason') ?? ''),
    returnTo: String(formData.get('returnTo') ?? '')
  };
}

function toReturnTo(value: string | undefined) {
  return value && value.startsWith('/') ? value : null;
}

function normalizeStatus(value: string | undefined): ResearchWorkflowStatus | null {
  if (!value) {
    return null;
  }

  return researchWorkflowStatuses.includes(value as ResearchWorkflowStatus)
    ? (value as ResearchWorkflowStatus)
    : null;
}

export async function GET(_request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  return Response.json({ ok: true, workflows: listWorkflows(leadId) });
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const payload = await parsePayload(request);
  const workflow = createWorkflow(leadId, payload.title ?? '', payload.topic ?? '');

  if (!workflow) {
    const lead = getStoredLeadById(leadId);
    return Response.json(
      { ok: false, error: lead ? 'Payload invalido.' : 'Lead nao encontrado.' },
      { status: lead ? 400 : 404 }
    );
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('researchWorkflowCreated', workflow.id);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, workflow }, { status: 201 });
}

export async function PATCH(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const payload = await parsePayload(request);
  const status = normalizeStatus(payload.status);
  if (!payload.id?.trim() || !status) {
    return Response.json({ ok: false, error: 'Payload invalido.' }, { status: 400 });
  }

  const workflow = updateStatus({
    id: payload.id.trim(),
    leadId,
    status,
    rejectionReason: payload.rejectionReason?.trim() || null
  });
  if (!workflow) {
    return Response.json({ ok: false, error: 'Workflow nao encontrado.' }, { status: 404 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('researchWorkflowUpdated', workflow.id);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, workflow });
}

export async function DELETE(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const payload = await parsePayload(request);
  const id = payload.id?.trim();

  if (!id) {
    return Response.json({ ok: false, error: 'Payload invalido.' }, { status: 400 });
  }

  const deleted = deleteWorkflow(id, leadId);
  if (!deleted) {
    return Response.json({ ok: false, error: 'Workflow nao encontrado.' }, { status: 404 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('researchWorkflowDeleted', id);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true });
}
