import {
  clientTypes,
  investorCategories,
  clientProfileSources,
  suitabilityQuestionnaireVersion,
  type ClientProfileSource,
  type ClientType,
  type InvestorCategory,
  type SuitabilityAnswers,
  type SuitabilityAnswerValue,
  type SuitabilitySectionKey
} from '@savastano-advisory/core';
import {
  createDraftAssessment,
  listAssessmentsByLead,
  type ClientProfileSeed
} from '../../../../../../../lib/intake-storage';
import { requireCockpitSession } from '../../../../../../../lib/cockpit-session';

type RawAnswerValue = string | string[];
type RawAnswers = Partial<Record<SuitabilitySectionKey, Record<string, RawAnswerValue>>>;

type CreateAssessmentPayload = {
  questionnaireVersion?: string;
  answers?: RawAnswers;
  clientProfileSeed?: {
    clientType?: string;
    investorCategory?: string;
    profileSource?: string;
  };
};

const SECTION_KEYS: readonly SuitabilitySectionKey[] = [
  'objectives',
  'financial_situation',
  'knowledge_experience',
  'liquidity_needs',
  'restrictions'
];

function isValidAnswerValue(value: unknown): value is RawAnswerValue {
  if (typeof value === 'string' && value.length > 0) return true;
  if (Array.isArray(value)) {
    return value.length > 0 && value.every((entry) => typeof entry === 'string' && entry.length > 0);
  }
  return false;
}

function normalizeAnswers(raw: RawAnswers | undefined): SuitabilityAnswers | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const normalized: Record<SuitabilitySectionKey, Record<string, SuitabilityAnswerValue>> = {
    objectives: {},
    financial_situation: {},
    knowledge_experience: {},
    liquidity_needs: {},
    restrictions: {}
  };

  for (const [section, value] of Object.entries(raw) as Array<[SuitabilitySectionKey, unknown]>) {
    if (!SECTION_KEYS.includes(section)) {
      return null;
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    const sectionMap: Record<string, SuitabilityAnswerValue> = {};
    for (const [questionId, answer] of Object.entries(value as Record<string, unknown>)) {
      if (typeof questionId !== 'string' || questionId.length === 0) return null;
      if (!isValidAnswerValue(answer)) return null;
      sectionMap[questionId] = answer;
    }
    normalized[section] = sectionMap;
  }

  return normalized as SuitabilityAnswers;
}

function normalizeSeed(raw: CreateAssessmentPayload['clientProfileSeed']): ClientProfileSeed | null {
  if (!raw) return {};

  let clientType: ClientType | undefined;
  let investorCategory: InvestorCategory | undefined;
  let profileSource: ClientProfileSource | undefined;

  if (raw.clientType !== undefined) {
    if (!clientTypes.includes(raw.clientType as ClientType)) return null;
    clientType = raw.clientType as ClientType;
  }
  if (raw.investorCategory !== undefined) {
    if (!investorCategories.includes(raw.investorCategory as InvestorCategory)) return null;
    investorCategory = raw.investorCategory as InvestorCategory;
  }
  if (raw.profileSource !== undefined) {
    if (!clientProfileSources.includes(raw.profileSource as ClientProfileSource)) return null;
    profileSource = raw.profileSource as ClientProfileSource;
  }

  return { clientType, investorCategory, profileSource };
}

export async function GET(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { leadId } = await context.params;
  return Response.json({
    ok: true,
    questionnaireVersion: suitabilityQuestionnaireVersion,
    assessments: listAssessmentsByLead(leadId)
  });
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { leadId } = await context.params;

  let payload: CreateAssessmentPayload;
  try {
    payload = (await request.json()) as CreateAssessmentPayload;
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const questionnaireVersion = (payload.questionnaireVersion ?? '').trim();
  if (!questionnaireVersion) {
    return Response.json({ ok: false, error: 'questionnaire_version_required' }, { status: 400 });
  }

  const answers = normalizeAnswers(payload.answers);
  if (!answers) {
    return Response.json({ ok: false, error: 'invalid_answers_payload' }, { status: 400 });
  }

  const seed = normalizeSeed(payload.clientProfileSeed);
  if (seed === null) {
    return Response.json({ ok: false, error: 'invalid_client_profile_seed' }, { status: 400 });
  }

  const result = createDraftAssessment({
    leadId,
    questionnaireVersion,
    answers,
    actorId: check.context.actorId,
    clientProfileSeed: seed
  });

  if (!result.ok) {
    if (result.errorCode === 'lead_not_found') {
      return Response.json({ ok: false, error: result.errorCode }, { status: 404 });
    }
    return Response.json({ ok: false, error: result.errorCode }, { status: 422 });
  }

  return Response.json({ ok: true, assessment: result.assessment }, { status: 201 });
}
