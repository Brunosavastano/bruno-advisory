import { createLeadInternalTask, isLeadTaskStatus, type LeadTaskStatus } from '../../../../../../lib/intake-storage';
import { requireCockpitSession } from '../../../../../../lib/cockpit-session';

type TaskPayload = {
  title?: string;
  status?: string;
  dueDate?: string;
  returnTo?: string;
};

async function parsePayload(request: Request): Promise<TaskPayload> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return (await request.json()) as TaskPayload;
  }

  const formData = await request.formData();
  return {
    title: String(formData.get('title') ?? ''),
    status: String(formData.get('status') ?? ''),
    dueDate: String(formData.get('dueDate') ?? ''),
    returnTo: String(formData.get('returnTo') ?? '')
  };
}

function toReturnTo(value: string | undefined) {
  if (!value || !value.startsWith('/')) {
    return null;
  }
  return value;
}

function toDueDate(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function isValidDueDate(value: string | undefined) {
  if (!value) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { leadId } = await context.params;
  const payload = await parsePayload(request);

  const title = payload.title?.trim() ?? '';
  if (!title) {
    return Response.json({ ok: false, error: 'Titulo da tarefa e obrigatorio.' }, { status: 400 });
  }

  if (!isLeadTaskStatus(payload.status)) {
    return Response.json({ ok: false, error: 'Status invalido da tarefa.' }, { status: 400 });
  }

  const dueDate = toDueDate(payload.dueDate);
  if (!isValidDueDate(dueDate)) {
    return Response.json({ ok: false, error: 'dueDate invalida; use YYYY-MM-DD.' }, { status: 400 });
  }

  const created = createLeadInternalTask({
    leadId,
    title,
    status: payload.status as LeadTaskStatus,
    dueDate
  });

  if (!created) {
    return Response.json({ ok: false, error: 'Lead nao encontrado ou payload invalido.' }, { status: 404 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    return Response.redirect(url, 303);
  }

  return Response.json({ ok: true, task: created }, { status: 201 });
}
