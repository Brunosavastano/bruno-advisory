import {
  portalInviteModel,
  suitabilityQuestionnaireV1,
  suitabilityQuestionnaireVersion,
  type SuitabilityQuestion,
  type SuitabilitySectionDefinition
} from '@savastano-advisory/core';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  getCurrentClientProfile,
  getSession,
  getStoredLeadById,
  listAssessmentsByLead
} from '../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value));
}

function renderQuestion(question: SuitabilityQuestion, sectionKey: string) {
  const inputName = `${sectionKey}__${question.id}`;
  if (question.inputType === 'single_select') {
    return (
      <fieldset key={question.id} style={{ border: '1px solid #d4d4d4', padding: 12, borderRadius: 8 }}>
        <legend><strong>{question.prompt}</strong></legend>
        <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
          {question.options.map((option) => (
            <label key={option.value} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="radio" name={inputName} value={option.value} required />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  // multi_select
  return (
    <fieldset key={question.id} style={{ border: '1px solid #d4d4d4', padding: 12, borderRadius: 8 }}>
      <legend><strong>{question.prompt}</strong> <span className="hint">(marque uma ou mais)</span></legend>
      <div style={{ display: 'grid', gap: 6, marginTop: 6 }}>
        {question.options.map((option) => (
          <label key={option.value} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" name={`${inputName}[]`} value={option.value} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function renderSection(section: SuitabilitySectionDefinition) {
  return (
    <section key={section.key} className="card" style={{ marginTop: 16 }}>
      <div className="kicker">{section.description}</div>
      <p className="hint">Referência: {section.cvmReference}</p>
      <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
        {section.questions.map((question) => renderQuestion(question, section.key))}
      </div>
    </section>
  );
}

export default async function PortalSuitabilityPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(portalInviteModel.cookie.name)?.value ?? null;
  if (!sessionToken) redirect('/portal/login');

  const session = getSession(sessionToken);
  if (!session) redirect('/portal/login');

  const lead = getStoredLeadById(session.leadId);
  if (!lead) redirect('/portal/login');

  const profile = getCurrentClientProfile(session.leadId);
  const assessments = listAssessmentsByLead(session.leadId);
  const lastOpen = assessments.find((a) => a.status === 'draft' || a.status === 'submitted' || a.status === 'review_required' || a.status === 'needs_clarification');

  const showForm = !profile || profile.status === 'none' || profile.status === 'expired' || profile.status === 'superseded';
  const inAnalysis = lastOpen && (lastOpen.status === 'submitted' || lastOpen.status === 'review_required');
  const needsClarification = lastOpen && lastOpen.status === 'needs_clarification';

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Portal do cliente — Suitability</div>
          <h1>Análise de Perfil de Investimento</h1>
          <p>Resolução CVM 30/2021. Suas respostas são usadas para definir o perfil de adequação.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/portal/dashboard">Voltar ao dashboard</a>
        </div>
      </div>

      <section className="card">
        <div className="kicker">Status atual</div>
        {profile && profile.status === 'active' && (
          <>
            <p>Perfil aprovado: <strong>{profile.riskProfile}</strong></p>
            <p>Validade até: <strong>{formatDate(profile.validUntil)}</strong></p>
            <p className="hint">Última revisão: {formatDate(profile.lastReviewedAt)}</p>
          </>
        )}
        {profile && profile.status === 'expired' && (
          <p>Seu perfil de adequação <strong>venceu</strong> em {formatDate(profile.validUntil)}. Por favor, refaça abaixo.</p>
        )}
        {(!profile || profile.status === 'none') && !inAnalysis && !needsClarification && (
          <p>Você ainda não tem um perfil de adequação registrado. Preencha o questionário abaixo.</p>
        )}
        {inAnalysis && lastOpen && (
          <p>Suas respostas estão <strong>em análise</strong> pelo consultor. Você será notificado quando o perfil for aprovado ou se houver pedido de esclarecimento.</p>
        )}
        {needsClarification && lastOpen && (
          <>
            <p>O consultor pediu <strong>esclarecimentos</strong> sobre suas respostas.</p>
            <a className="btn" href={`/portal/suitability/${lastOpen.assessmentId}/clarify`}>Revisar e responder</a>
          </>
        )}
      </section>

      {showForm && !inAnalysis && !needsClarification && (
        <form method="post" action="/api/portal/suitability" style={{ display: 'block' }}>
          <input type="hidden" name="questionnaireVersion" value={suitabilityQuestionnaireVersion} />
          {suitabilityQuestionnaireV1.map(renderSection)}
          <div className="card" style={{ marginTop: 16, textAlign: 'right' }}>
            <button className="btn" type="submit">Enviar para análise</button>
          </div>
        </form>
      )}
    </main>
  );
}
