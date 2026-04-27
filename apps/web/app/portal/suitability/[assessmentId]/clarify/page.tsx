import {
  portalInviteModel,
  suitabilityQuestionnaireV1,
  type SuitabilityAnswerValue,
  type SuitabilityQuestion,
  type SuitabilitySectionDefinition,
  type SuitabilitySectionKey
} from '@savastano-advisory/core';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import {
  getAssessment,
  getSession,
  getStoredLeadById
} from '../../../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

type StoredAnswers = Partial<Record<SuitabilitySectionKey, Record<string, SuitabilityAnswerValue>>>;

function loadStoredAnswers(json: string): Record<string, SuitabilityAnswerValue> {
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isOptionSelected(stored: SuitabilityAnswerValue | undefined, optionValue: string): boolean {
  if (stored === undefined) return false;
  if (typeof stored === 'string') return stored === optionValue;
  if (Array.isArray(stored)) return stored.includes(optionValue);
  return false;
}

function renderQuestion(
  question: SuitabilityQuestion,
  sectionKey: string,
  storedAnswer: SuitabilityAnswerValue | undefined
) {
  const inputName = `${sectionKey}__${question.id}`;
  if (question.inputType === 'single_select') {
    return (
      <fieldset key={question.id} style={{ border: '1px solid #d4d4d4', padding: 12, borderRadius: 8 }}>
        <legend><strong>{question.prompt}</strong></legend>
        <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
          {question.options.map((option) => (
            <label key={option.value} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="radio"
                name={inputName}
                value={option.value}
                defaultChecked={isOptionSelected(storedAnswer, option.value)}
                required
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <fieldset key={question.id} style={{ border: '1px solid #d4d4d4', padding: 12, borderRadius: 8 }}>
      <legend><strong>{question.prompt}</strong> <span className="hint">(marque uma ou mais)</span></legend>
      <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
        {question.options.map((option) => (
          <label key={option.value} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              name={`${inputName}[]`}
              value={option.value}
              defaultChecked={isOptionSelected(storedAnswer, option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function renderSection(section: SuitabilitySectionDefinition, storedSection: Record<string, SuitabilityAnswerValue>) {
  return (
    <section key={section.key} className="card" style={{ marginTop: 16 }}>
      <div className="kicker">{section.description}</div>
      <p className="hint">Referência: {section.cvmReference}</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {section.questions.map((question) => renderQuestion(question, section.key, storedSection[question.id]))}
      </div>
    </section>
  );
}

export default async function PortalSuitabilityClarifyPage({
  params
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(portalInviteModel.cookie.name)?.value ?? null;
  if (!sessionToken) redirect('/portal/login');

  const session = getSession(sessionToken);
  if (!session) redirect('/portal/login');

  const lead = getStoredLeadById(session.leadId);
  if (!lead) redirect('/portal/login');

  const assessment = getAssessment(assessmentId);
  if (!assessment || assessment.leadId !== session.leadId) {
    notFound();
  }

  if (assessment.status !== 'needs_clarification') {
    redirect('/portal/suitability');
  }

  const storedAnswers: StoredAnswers = {
    objectives: loadStoredAnswers(assessment.objectivesJson),
    financial_situation: loadStoredAnswers(assessment.financialSituationJson),
    knowledge_experience: loadStoredAnswers(assessment.knowledgeExperienceJson),
    liquidity_needs: loadStoredAnswers(assessment.liquidityNeedsJson),
    restrictions: loadStoredAnswers(assessment.restrictionsJson)
  };

  const clarificationRequests = (() => {
    if (!assessment.clarificationRequestsJson) return [];
    try {
      const parsed = JSON.parse(assessment.clarificationRequestsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  })();

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Portal — Esclarecimentos solicitados</div>
          <h1>Revisar respostas</h1>
          <p>O consultor pediu esclarecimentos. Revise as respostas abaixo e envie novamente.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/portal/suitability">Voltar</a>
        </div>
      </div>

      {clarificationRequests.length > 0 && (
        <section className="card" style={{ background: '#fffbeb' }}>
          <div className="kicker">Pedidos de esclarecimento</div>
          {clarificationRequests.map((entry: { message?: string; requestedAt?: string }, idx: number) => (
            <p key={idx}>
              <strong>{entry.requestedAt ? new Date(entry.requestedAt).toLocaleString('pt-BR') : '-'}:</strong>{' '}
              {entry.message ?? ''}
            </p>
          ))}
        </section>
      )}

      <form method="post" action={`/api/portal/suitability/${assessmentId}/clarify`}>
        {suitabilityQuestionnaireV1.map((section) =>
          renderSection(section, storedAnswers[section.key] ?? {})
        )}
        <div className="card" style={{ marginTop: 16, textAlign: 'right' }}>
          <button className="btn" type="submit">Reenviar para análise</button>
        </div>
      </form>
    </main>
  );
}
