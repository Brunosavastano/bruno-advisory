import type { LeadCrmFieldsUpdate, LeadFitLevel } from '../../../../../../lib/storage/types';
import { updateLeadCrmFields } from '../../../../../../lib/intake-storage';

type CrmPayload = {
  cidade_estado?: string | null;
  ocupacao_perfil?: string | null;
  nivel_de_fit?: string | null;
  motivo_sem_fit?: string | null;
  owner?: string | null;
  data_call_qualificacao?: string | null;
  resumo_call?: string | null;
  interesse_na_oferta?: string | null;
  checklist_onboarding?: string | null;
  cadencia_acordada?: string | null;
  proximo_passo?: string | null;
  risco_de_churn?: string | null;
  returnTo?: string;
};

function toNullableString(value: FormDataEntryValue | string | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function toNullableFitLevel(value: string | null | undefined): LeadFitLevel | null {
  return value === 'alto' || value === 'medio' || value === 'baixo' ? value : null;
}

async function parsePayload(request: Request): Promise<CrmPayload> {
  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    return (await request.json()) as CrmPayload;
  }

  const formData = await request.formData();
  return {
    cidade_estado: toNullableString(formData.get('cidade_estado')),
    ocupacao_perfil: toNullableString(formData.get('ocupacao_perfil')),
    nivel_de_fit: toNullableString(formData.get('nivel_de_fit')),
    motivo_sem_fit: toNullableString(formData.get('motivo_sem_fit')),
    owner: toNullableString(formData.get('owner')),
    data_call_qualificacao: toNullableString(formData.get('data_call_qualificacao')),
    resumo_call: toNullableString(formData.get('resumo_call')),
    interesse_na_oferta: toNullableString(formData.get('interesse_na_oferta')),
    checklist_onboarding: toNullableString(formData.get('checklist_onboarding')),
    cadencia_acordada: toNullableString(formData.get('cadencia_acordada')),
    proximo_passo: toNullableString(formData.get('proximo_passo')),
    risco_de_churn: toNullableString(formData.get('risco_de_churn')),
    returnTo: toNullableString(formData.get('returnTo')) ?? ''
  };
}

function toReturnTo(value: string | undefined | null) {
  if (!value || !value.startsWith('/')) {
    return null;
  }
  return value;
}

function toLeadCrmFieldsUpdate(payload: CrmPayload): LeadCrmFieldsUpdate {
  return {
    cidadeEstado: toNullableString(payload.cidade_estado),
    ocupacaoPerfil: toNullableString(payload.ocupacao_perfil),
    nivelDeFit: toNullableFitLevel(toNullableString(payload.nivel_de_fit)),
    motivoSemFit: toNullableString(payload.motivo_sem_fit),
    owner: toNullableString(payload.owner),
    dataCallQualificacao: toNullableString(payload.data_call_qualificacao),
    resumoCall: toNullableString(payload.resumo_call),
    interesseNaOferta: toNullableFitLevel(toNullableString(payload.interesse_na_oferta)),
    checklistOnboarding: toNullableString(payload.checklist_onboarding),
    cadenciaAcordada: toNullableString(payload.cadencia_acordada),
    proximoPasso: toNullableString(payload.proximo_passo),
    riscoDeChurn: toNullableFitLevel(toNullableString(payload.risco_de_churn))
  };
}

export async function PATCH(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const payload = await parsePayload(request);
  const updated = updateLeadCrmFields({ leadId, fields: toLeadCrmFieldsUpdate(payload) });

  if (!updated || !updated.lead) {
    return Response.json({ ok: false, error: 'Lead não encontrado.' }, { status: 404 });
  }

  return Response.json({
    ok: true,
    lead: updated.lead,
    updatedAt: updated.updatedAt
  });
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  const payload = await parsePayload(request);
  const updated = updateLeadCrmFields({ leadId, fields: toLeadCrmFieldsUpdate(payload) });

  if (!updated || !updated.lead) {
    return Response.json({ ok: false, error: 'Lead não encontrado.' }, { status: 404 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('crmFieldsSuccess', '1');
    return Response.redirect(url, 303);
  }

  return Response.json({
    ok: true,
    lead: updated.lead,
    updatedAt: updated.updatedAt
  });
}
