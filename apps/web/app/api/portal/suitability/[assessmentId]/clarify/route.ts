import { portalInviteModel, type SuitabilityAnswers } from '@savastano-advisory/core';
import {
  getAssessment,
  getSession,
  resubmitAssessment
} from '../../../../../../lib/intake-storage';
import { parseAnswersFromFormData } from '../../route';

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

export async function POST(
  request: Request,
  context: { params: Promise<{ assessmentId: string }> }
) {
  const sessionToken = getPortalSessionToken(request);
  if (!sessionToken) {
    return Response.redirect(new URL('/portal/login', request.url), 303);
  }

  const session = getSession(sessionToken);
  if (!session) {
    return Response.redirect(new URL('/portal/login', request.url), 303);
  }

  const { assessmentId } = await context.params;
  const existing = getAssessment(assessmentId);
  if (!existing || existing.leadId !== session.leadId) {
    return Response.redirect(new URL('/portal/suitability', request.url), 303);
  }

  const contentType = request.headers.get('content-type') ?? '';
  let answers: SuitabilityAnswers | null;

  if (contentType.includes('application/json')) {
    const payload = (await request.json().catch(() => ({}))) as { answers?: SuitabilityAnswers };
    answers = payload.answers ?? null;
  } else {
    const formData = await request.formData();
    answers = parseAnswersFromFormData(formData);
  }

  if (!answers) {
    const url = new URL(`/portal/suitability/${assessmentId}/clarify`, request.url);
    url.searchParams.set('error', 'incomplete_answers');
    return Response.redirect(url, 303);
  }

  const actorId = `client:${session.leadId}`;
  const result = resubmitAssessment({
    assessmentId,
    actorId,
    submittedByRole: 'client',
    answers
  });

  if (!result.ok) {
    if (contentType.includes('application/json')) {
      return Response.json({ ok: false, error: result.errorCode, detail: result.detail ?? null }, { status: 422 });
    }
    const url = new URL(`/portal/suitability/${assessmentId}/clarify`, request.url);
    url.searchParams.set('error', result.errorCode);
    return Response.redirect(url, 303);
  }

  if (contentType.includes('application/json')) {
    return Response.json({
      ok: true,
      assessment: result.assessment,
      routedToReview: result.routedToReview
    });
  }

  const url = new URL('/portal/suitability', request.url);
  url.searchParams.set('resubmitted', '1');
  return Response.redirect(url, 303);
}
