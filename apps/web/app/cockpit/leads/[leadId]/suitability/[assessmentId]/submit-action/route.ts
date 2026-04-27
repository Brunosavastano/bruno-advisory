import { clientRiskProfiles, type ClientRiskProfile } from '@savastano-advisory/core';
import {
  approveAssessment,
  requestClarification
} from '../../../../../../../lib/intake-storage';
import { requireCockpitSession } from '../../../../../../../lib/cockpit-session';

// AI-3 Cycle 2 — rota POST para os forms HTML da página de revisão de
// suitability no cockpit. Forms HTML não suportam PATCH; esta rota recebe
// POST com action=approve|clarify e faz a transição correspondente, redirecionando
// de volta para a página de review.

export async function POST(
  request: Request,
  context: { params: Promise<{ leadId: string; assessmentId: string }> }
) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { leadId, assessmentId } = await context.params;
  const url = new URL(request.url);
  const action = url.searchParams.get('action') ?? '';
  const formData = await request.formData();

  const reviewPagePath = `/cockpit/leads/${leadId}/suitability/${assessmentId}`;

  if (action === 'approve') {
    const validUntil = String(formData.get('validUntil') ?? '').trim();
    const approvedRiskProfileRaw = String(formData.get('approvedRiskProfile') ?? '').trim();
    const approvalNotes = String(formData.get('approvalNotes') ?? '').trim() || undefined;
    const overrideReason = String(formData.get('overrideReason') ?? '').trim() || undefined;

    let approvedRiskProfile: ClientRiskProfile | undefined;
    if (approvedRiskProfileRaw) {
      if (!clientRiskProfiles.includes(approvedRiskProfileRaw as ClientRiskProfile)) {
        return Response.redirect(new URL(`${reviewPagePath}?action=error&error=invalid_approved_risk_profile`, request.url), 303);
      }
      approvedRiskProfile = approvedRiskProfileRaw as ClientRiskProfile;
    }

    const result = approveAssessment({
      assessmentId,
      approvedBy: check.context.actorId,
      approvedRiskProfile,
      validUntil,
      approvalNotes,
      overrideReason
    });

    if (!result.ok) {
      return Response.redirect(
        new URL(`${reviewPagePath}?action=error&error=${result.errorCode}`, request.url),
        303
      );
    }

    return Response.redirect(new URL(`${reviewPagePath}?action=approved`, request.url), 303);
  }

  if (action === 'clarify') {
    const message = String(formData.get('message') ?? '').trim();
    if (!message) {
      return Response.redirect(
        new URL(`${reviewPagePath}?action=error&error=message_required`, request.url),
        303
      );
    }

    const result = requestClarification({
      assessmentId,
      requestedBy: check.context.actorId,
      message
    });

    if (!result.ok) {
      return Response.redirect(
        new URL(`${reviewPagePath}?action=error&error=${result.errorCode}`, request.url),
        303
      );
    }

    return Response.redirect(new URL(`${reviewPagePath}?action=clarification_requested`, request.url), 303);
  }

  return Response.redirect(new URL(`${reviewPagePath}?action=error&error=invalid_action`, request.url), 303);
}
