import {
  clientRiskProfiles,
  suitabilityAssessmentActorRoles,
  type ClientRiskProfile,
  type SuitabilityAnswerValue,
  type SuitabilityAssessmentActorRole,
  type SuitabilitySectionKey
} from '@savastano-advisory/core';
import {
  approveAssessment,
  getAssessment,
  requestClarification,
  resubmitAssessment,
  submitAssessment,
  supersedeAssessment
} from '../../../../../../../../lib/intake-storage';
import { requireCockpitSession } from '../../../../../../../../lib/cockpit-session';

type RawAnswerValue = string | string[];
type RawAnswers = Partial<Record<SuitabilitySectionKey, Record<string, RawAnswerValue>>>;

type AssessmentActionPayload = {
  action?: string;
  submittedByRole?: string;
  approvedRiskProfile?: string;
  validUntil?: string;
  approvalNotes?: string;
  overrideReason?: string;
  message?: string;
  answers?: RawAnswers;
  supersededByAssessmentId?: string;
};

const SECTION_KEYS: readonly SuitabilitySectionKey[] = [
  'objectives',
  'financial_situation',
  'knowledge_experience',
  'liquidity_needs',
  'restrictions'
];

const VALID_ACTIONS = ['submit', 'approve', 'request_clarification', 'resubmit', 'supersede'] as const;
type ValidAction = (typeof VALID_ACTIONS)[number];

function isValidAnswerValue(value: unknown): value is RawAnswerValue {
  if (typeof value === 'string' && value.length > 0) return true;
  if (Array.isArray(value)) {
    return value.length > 0 && value.every((entry) => typeof entry === 'string' && entry.length > 0);
  }
  return false;
}

function normalizeAnswers(raw: RawAnswers | undefined) {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const normalized: Record<SuitabilitySectionKey, Record<string, SuitabilityAnswerValue>> = {
    objectives: {},
    financial_situation: {},
    knowledge_experience: {},
    liquidity_needs: {},
    restrictions: {}
  };

  for (const [section, value] of Object.entries(raw) as Array<[SuitabilitySectionKey, unknown]>) {
    if (!SECTION_KEYS.includes(section)) return null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const sectionMap: Record<string, SuitabilityAnswerValue> = {};
    for (const [questionId, answer] of Object.entries(value as Record<string, unknown>)) {
      if (typeof questionId !== 'string' || questionId.length === 0) return null;
      if (!isValidAnswerValue(answer)) return null;
      sectionMap[questionId] = answer;
    }
    normalized[section] = sectionMap;
  }

  return normalized;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ leadId: string; assessmentId: string }> }
) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { leadId, assessmentId } = await context.params;
  const assessment = getAssessment(assessmentId);
  if (!assessment || assessment.leadId !== leadId) {
    return Response.json({ ok: false, error: 'assessment_not_found' }, { status: 404 });
  }

  return Response.json({ ok: true, assessment });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ leadId: string; assessmentId: string }> }
) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { leadId, assessmentId } = await context.params;

  let payload: AssessmentActionPayload;
  try {
    payload = (await request.json()) as AssessmentActionPayload;
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const action = (payload.action ?? '').trim() as ValidAction;
  if (!VALID_ACTIONS.includes(action)) {
    return Response.json({ ok: false, error: 'invalid_action' }, { status: 400 });
  }

  const existing = getAssessment(assessmentId);
  if (!existing || existing.leadId !== leadId) {
    return Response.json({ ok: false, error: 'assessment_not_found' }, { status: 404 });
  }

  if (action === 'submit') {
    let submittedByRole: SuitabilityAssessmentActorRole | undefined;
    if (payload.submittedByRole !== undefined) {
      if (!suitabilityAssessmentActorRoles.includes(payload.submittedByRole as SuitabilityAssessmentActorRole)) {
        return Response.json({ ok: false, error: 'invalid_submitted_by_role' }, { status: 400 });
      }
      submittedByRole = payload.submittedByRole as SuitabilityAssessmentActorRole;
    }

    const result = submitAssessment({ assessmentId, actorId: check.context.actorId, submittedByRole });
    if (!result.ok) {
      const status = result.errorCode === 'assessment_not_found' ? 404 : 422;
      return Response.json({ ok: false, error: result.errorCode, detail: result.detail ?? null }, { status });
    }
    return Response.json({
      ok: true,
      assessment: result.assessment,
      routedToReview: result.routedToReview
    });
  }

  if (action === 'approve') {
    const validUntil = (payload.validUntil ?? '').trim();
    if (!validUntil) {
      return Response.json({ ok: false, error: 'valid_until_required' }, { status: 400 });
    }

    let approvedRiskProfile: ClientRiskProfile | undefined;
    if (payload.approvedRiskProfile !== undefined) {
      if (!clientRiskProfiles.includes(payload.approvedRiskProfile as ClientRiskProfile)) {
        return Response.json({ ok: false, error: 'invalid_approved_risk_profile' }, { status: 400 });
      }
      approvedRiskProfile = payload.approvedRiskProfile as ClientRiskProfile;
    }

    const approvalNotes = payload.approvalNotes?.trim();
    const overrideReason = payload.overrideReason?.trim();

    const result = approveAssessment({
      assessmentId,
      approvedBy: check.context.actorId,
      approvedRiskProfile,
      validUntil,
      approvalNotes,
      overrideReason
    });
    if (!result.ok) {
      const status = result.errorCode === 'assessment_not_found' ? 404 : 422;
      return Response.json({ ok: false, error: result.errorCode, detail: result.detail ?? null }, { status });
    }

    return Response.json({ ok: true, assessment: result.assessment, profile: result.profile });
  }

  if (action === 'request_clarification') {
    const message = payload.message?.trim() ?? '';
    if (!message) {
      return Response.json({ ok: false, error: 'message_required' }, { status: 400 });
    }
    const result = requestClarification({
      assessmentId,
      requestedBy: check.context.actorId,
      message
    });
    if (!result.ok) {
      const status = result.errorCode === 'assessment_not_found' ? 404 : 422;
      return Response.json({ ok: false, error: result.errorCode, detail: result.detail ?? null }, { status });
    }
    return Response.json({ ok: true, assessment: result.assessment });
  }

  if (action === 'resubmit') {
    let submittedByRole: SuitabilityAssessmentActorRole | undefined;
    if (payload.submittedByRole !== undefined) {
      if (!suitabilityAssessmentActorRoles.includes(payload.submittedByRole as SuitabilityAssessmentActorRole)) {
        return Response.json({ ok: false, error: 'invalid_submitted_by_role' }, { status: 400 });
      }
      submittedByRole = payload.submittedByRole as SuitabilityAssessmentActorRole;
    }

    const answers = normalizeAnswers(payload.answers);
    if (answers === null) {
      return Response.json({ ok: false, error: 'invalid_answers_payload' }, { status: 400 });
    }

    const result = resubmitAssessment({
      assessmentId,
      actorId: check.context.actorId,
      submittedByRole,
      answers
    });
    if (!result.ok) {
      const status = result.errorCode === 'assessment_not_found' ? 404 : 422;
      return Response.json({ ok: false, error: result.errorCode, detail: result.detail ?? null }, { status });
    }
    return Response.json({
      ok: true,
      assessment: result.assessment,
      routedToReview: result.routedToReview
    });
  }

  // action === 'supersede'
  const supersededByAssessmentId = (payload.supersededByAssessmentId ?? '').trim();
  if (!supersededByAssessmentId) {
    return Response.json({ ok: false, error: 'superseded_by_assessment_id_required' }, { status: 400 });
  }
  const result = supersedeAssessment({
    assessmentId,
    supersededByAssessmentId,
    actorId: check.context.actorId
  });
  if (!result.ok) {
    const status = result.errorCode === 'assessment_not_found' || result.errorCode === 'superseder_not_found' ? 404 : 422;
    return Response.json({ ok: false, error: result.errorCode, detail: result.detail ?? null }, { status });
  }
  return Response.json({ ok: true, assessment: result.assessment });
}
