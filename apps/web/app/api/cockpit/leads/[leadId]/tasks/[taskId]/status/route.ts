import {
  isLeadTaskStatus,
  type LeadTaskStatus,
  updateLeadInternalTaskStatus
} from '../../../../../../../../lib/intake-storage';

type TaskStatusPayload = {
  toStatus?: string;
  changedBy?: string;
  returnTo?: string;
};

async function parsePayload(request: Request): Promise<TaskStatusPayload> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return (await request.json()) as TaskStatusPayload;
  }

  const formData = await request.formData();
  return {
    toStatus: String(formData.get('toStatus') ?? ''),
    changedBy: String(formData.get('changedBy') ?? ''),
    returnTo: String(formData.get('returnTo') ?? '')
  };
}

function toChangedBy(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : 'operator_local';
}

function toReturnTo(value: string | undefined) {
  if (!value || !value.startsWith('/')) {
    return null;
  }
  return value;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string; taskId: string }> }
) {
  const { leadId, taskId } = await context.params;
  const payload = await parsePayload(request);

  if (!isLeadTaskStatus(payload.toStatus)) {
    return Response.json({ ok: false, error: 'Status invalido da tarefa.' }, { status: 400 });
  }

  const updated = updateLeadInternalTaskStatus({
    leadId,
    taskId,
    toStatus: payload.toStatus as LeadTaskStatus,
    changedBy: toChangedBy(payload.changedBy)
  });

  if (!updated) {
    return Response.json({ ok: false, error: 'Lead/tarefa nao encontrado ou payload invalido.' }, { status: 404 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    return Response.redirect(url, 303);
  }

  return Response.json(
    {
      ok: true,
      taskId: updated.task.taskId,
      status: updated.task.status,
      changedFrom: updated.changedFrom,
      changedTo: updated.changedTo,
      changedAt: updated.changedAt,
      changedBy: updated.changedBy
    },
    { status: 200 }
  );
}
