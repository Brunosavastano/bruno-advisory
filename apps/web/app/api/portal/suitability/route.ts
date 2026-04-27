import {
  portalInviteModel,
  suitabilityQuestionnaireV1,
  suitabilityQuestionnaireVersion,
  type SuitabilityAnswerValue,
  type SuitabilityAnswers,
  type SuitabilitySectionKey
} from '@savastano-advisory/core';
import {
  createDraftAssessment,
  getSession,
  submitAssessment
} from '../../../../lib/intake-storage';

// AI-3 Cycle 2: portal route — cliente preenche e envia o questionário.
// Cria draft + submete em sequência (single transaction da perspectiva do
// cliente). actorId fica como 'client:<leadId>' para rastreabilidade no
// audit_log; submittedByRole='client' diferencia do operador.

function parseCookieHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const raw of header.split(';')) {
    const segment = raw.trim();
    const eq = segment.indexOf('=');
    if (eq <= 0) continue;
    const name = segment.slice(0, eq).trim();
    if (!name || name in out) continue;
    out[name] = segment.slice(eq + 1).trim();
  }
  return out;
}

function getPortalSessionToken(request: Request): string | null {
  const cookies = parseCookieHeader(request.headers.get('cookie'));
  return cookies[portalInviteModel.cookie.name] ?? null;
}

export function parseAnswersFromFormData(formData: FormData): SuitabilityAnswers | null {
  const answers: Record<SuitabilitySectionKey, Record<string, SuitabilityAnswerValue>> = {
    objectives: {},
    financial_situation: {},
    knowledge_experience: {},
    liquidity_needs: {},
    restrictions: {}
  };

  for (const section of suitabilityQuestionnaireV1) {
    for (const question of section.questions) {
      const baseKey = `${section.key}__${question.id}`;
      if (question.inputType === 'single_select') {
        const value = formData.get(baseKey);
        if (typeof value !== 'string' || value.length === 0) {
          return null;
        }
        answers[section.key][question.id] = value;
      } else {
        const raw = formData.getAll(`${baseKey}[]`);
        const values = raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
        if (values.length === 0) {
          return null;
        }
        answers[section.key][question.id] = values;
      }
    }
  }

  return answers;
}

export async function POST(request: Request) {
  const sessionToken = getPortalSessionToken(request);
  if (!sessionToken) {
    return Response.redirect(new URL('/portal/login', request.url), 303);
  }

  const session = getSession(sessionToken);
  if (!session) {
    return Response.redirect(new URL('/portal/login', request.url), 303);
  }

  const contentType = request.headers.get('content-type') ?? '';
  let answers: SuitabilityAnswers | null;
  let questionnaireVersion: string;

  if (contentType.includes('application/json')) {
    const payload = (await request.json().catch(() => ({}))) as {
      questionnaireVersion?: string;
      answers?: SuitabilityAnswers;
    };
    questionnaireVersion = (payload.questionnaireVersion ?? '').trim();
    answers = payload.answers ?? null;
  } else {
    const formData = await request.formData();
    questionnaireVersion = String(formData.get('questionnaireVersion') ?? '');
    answers = parseAnswersFromFormData(formData);
  }

  if (!questionnaireVersion || questionnaireVersion !== suitabilityQuestionnaireVersion) {
    const url = new URL('/portal/suitability', request.url);
    url.searchParams.set('error', 'invalid_questionnaire_version');
    return Response.redirect(url, 303);
  }

  if (!answers) {
    const url = new URL('/portal/suitability', request.url);
    url.searchParams.set('error', 'incomplete_answers');
    return Response.redirect(url, 303);
  }

  const actorId = `client:${session.leadId}`;

  const draft = createDraftAssessment({
    leadId: session.leadId,
    questionnaireVersion,
    answers,
    actorId,
    clientProfileSeed: { profileSource: 'self_declared' }
  });

  if (!draft.ok) {
    if (contentType.includes('application/json')) {
      return Response.json({ ok: false, error: draft.errorCode }, { status: 422 });
    }
    const url = new URL('/portal/suitability', request.url);
    url.searchParams.set('error', draft.errorCode);
    return Response.redirect(url, 303);
  }

  const submit = submitAssessment({
    assessmentId: draft.assessment.assessmentId,
    actorId,
    submittedByRole: 'client'
  });

  if (!submit.ok) {
    if (contentType.includes('application/json')) {
      return Response.json({ ok: false, error: submit.errorCode, detail: submit.detail ?? null }, { status: 422 });
    }
    const url = new URL('/portal/suitability', request.url);
    url.searchParams.set('error', submit.errorCode);
    return Response.redirect(url, 303);
  }

  if (contentType.includes('application/json')) {
    return Response.json({
      ok: true,
      assessment: submit.assessment,
      routedToReview: submit.routedToReview
    }, { status: 201 });
  }

  const url = new URL('/portal/suitability', request.url);
  url.searchParams.set('submitted', '1');
  return Response.redirect(url, 303);
}
