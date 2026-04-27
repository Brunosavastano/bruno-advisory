import {
  deleteRecommendation,
  evaluateBasicSuitabilityGateForLead,
  getProductCategory,
  getRecommendation,
  publishRecommendation
} from '../../../../../../../lib/intake-storage';
import {
  canRecommendProduct,
  isClientProfileActiveForRecommendation
} from '@savastano-advisory/core';
import { getCurrentClientProfile } from '../../../../../../../lib/storage/suitability';
import { writeAuditLog } from '../../../../../../../lib/storage/audit-log';
import { requireCockpitSession } from '../../../../../../../lib/cockpit-session';

type RecommendationActionPayload = {
  returnTo?: string;
  // Override consciente do gate de suitability. Quando true, exige overrideReason
  // e o evento é registrado em audit_log com motivos do bloqueio + razão do override.
  overrideSuitabilityGate?: boolean;
  overrideReason?: string;
};

async function parsePayload(request: Request): Promise<RecommendationActionPayload> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return (await request.json()) as RecommendationActionPayload;
  }

  const formData = await request.formData();
  const overrideRaw = formData.get('overrideSuitabilityGate');
  return {
    returnTo: String(formData.get('returnTo') ?? ''),
    overrideSuitabilityGate: overrideRaw === '1' || overrideRaw === 'true',
    overrideReason: formData.get('overrideReason') ? String(formData.get('overrideReason')) : undefined
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

  const payload = await parsePayload(request).catch(() => ({ returnTo: '' } as RecommendationActionPayload));

  // AI-3 Cycle 1: gate básico de suitability (apenas perfil ativo).
  // AI-3 Cycle 2: quando a recomendação aponta para uma product_category, o
  // gate completo (canRecommendProduct) também checa adequação produto↔perfil,
  // categoria de investidor, custos excessivos, complexidade e necessidade de
  // revisão humana. Sem product_category, mantém gate básico.
  const recommendationForGate = getRecommendation(recommendationId, leadId);
  const productCategory = recommendationForGate?.productCategoryId
    ? getProductCategory(recommendationForGate.productCategoryId)
    : null;

  let gate: {
    ok: boolean;
    decision: string;
    reasons: readonly string[];
    cvmReferences: readonly string[];
  };

  if (productCategory && recommendationForGate) {
    const profile = getCurrentClientProfile(leadId);
    const fullOutcome = canRecommendProduct(profile, productCategory, {
      humanReviewed: false,
      costAssessment: undefined
    });
    gate = {
      ok: fullOutcome.ok,
      decision: fullOutcome.decision,
      reasons: fullOutcome.reasons,
      cvmReferences: fullOutcome.cvmReferences
    };
  } else {
    const basic = evaluateBasicSuitabilityGateForLead(leadId);
    gate = {
      ok: basic.ok,
      decision: basic.decision,
      reasons: basic.reasons,
      cvmReferences: basic.cvmReferences
    };
  }

  if (!gate.ok) {
    const overrideRequested = Boolean(payload.overrideSuitabilityGate);
    const overrideReason = payload.overrideReason?.trim() ?? '';

    if (!overrideRequested) {
      return Response.json(
        {
          ok: false,
          error: 'suitability_gate_blocked',
          decision: gate.decision,
          reasons: gate.reasons,
          cvmReferences: gate.cvmReferences
        },
        { status: 422 }
      );
    }

    if (!overrideReason) {
      return Response.json(
        { ok: false, error: 'override_requires_reason' },
        { status: 422 }
      );
    }

    writeAuditLog({
      action: 'recommendation.suitability_gate_overridden',
      entityType: 'recommendation',
      entityId: recommendationId,
      leadId,
      actorType: 'operator',
      actorId: check.context.actorId,
      detail: {
        decision: gate.decision,
        reasons: [...gate.reasons],
        cvmReferences: [...gate.cvmReferences],
        overrideReason
      }
    });
  }

  const recommendation = publishRecommendation(recommendationId, leadId, check.context.actorId);

  if (!recommendation) {
    return Response.json({ ok: false, error: 'Recomendacao nao encontrada.' }, { status: 404 });
  }

  const returnTo = toReturnTo(payload.returnTo);
  if (returnTo) {
    const url = new URL(returnTo, request.url);
    url.searchParams.set('recommendationPublished', recommendation.recommendationId);
    return Response.redirect(url, 303);
  }

  return Response.json({
    ok: true,
    recommendation,
    suitabilityGate: { decision: gate.decision, ok: gate.ok }
  });
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
