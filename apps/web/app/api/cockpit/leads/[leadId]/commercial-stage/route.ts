import {
  isOperatorCommercialStage,
  type OperatorCommercialStage
} from '@savastano-advisory/core';
import { updateLeadCommercialStage } from '../../../../../../lib/intake-storage';
import { requireCockpitSession } from '../../../../../../lib/cockpit-session';

type StagePayload = {
  toStage?: string;
  note?: string;
  changedBy?: string;
  returnTo?: string;
};

async function parsePayload(request: Request): Promise<StagePayload> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return (await request.json()) as StagePayload;
  }

  const formData = await request.formData();
  return {
    toStage: String(formData.get('toStage') ?? ''),
    note: String(formData.get('note') ?? ''),
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

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { leadId } = await context.params;
  const payload = await parsePayload(request);

  if (!isOperatorCommercialStage(payload.toStage)) {
    return Response.json({ ok: false, error: 'toStage inválido no modelo comercial canônico.' }, { status: 400 });
  }

  const updated = updateLeadCommercialStage({
    leadId,
    toStage: payload.toStage as OperatorCommercialStage,
    changedBy: toChangedBy(payload.changedBy),
    note: payload.note,
    actorId: check.context.actorId
  });

  if (!updated || !updated.lead) {
    return Response.json({ ok: false, error: 'Lead não encontrado.' }, { status: 404 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    return Response.redirect(url, 303);
  }

  return Response.json({
    ok: true,
    leadId: updated.lead.leadId,
    commercialStage: updated.lead.commercialStage,
    changedFrom: updated.changedFrom,
    changedTo: updated.changedTo,
    changedAt: updated.changedAt,
    note: updated.note
  });
}
