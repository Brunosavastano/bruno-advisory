import {
  clientRiskProfiles,
  suitabilityQuestionnaireV1,
  type SuitabilityAnswerValue
} from '@savastano-advisory/core';
import { notFound } from 'next/navigation';
import {
  getAssessment,
  getCurrentClientProfile,
  getStoredLeadById
} from '../../../../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function safeParseJson<T = unknown>(json: string | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function answerLabel(sectionKey: string, questionId: string, answer: SuitabilityAnswerValue): string {
  const section = suitabilityQuestionnaireV1.find((s) => s.key === sectionKey);
  const question = section?.questions.find((q) => q.id === questionId);
  if (!question) return Array.isArray(answer) ? answer.join(', ') : String(answer);

  if (typeof answer === 'string') {
    const opt = question.options.find((o) => o.value === answer);
    return opt ? opt.label : answer;
  }

  return answer
    .map((value) => question.options.find((o) => o.value === value)?.label ?? value)
    .join(', ');
}

export default async function CockpitSuitabilityReviewPage({
  params,
  searchParams
}: {
  params: Promise<{ leadId: string; assessmentId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { leadId, assessmentId } = await params;
  const resolvedSearch = searchParams ? await searchParams : undefined;
  const action = typeof resolvedSearch?.action === 'string' ? resolvedSearch.action : null;

  const lead = getStoredLeadById(leadId);
  const assessment = getAssessment(assessmentId);
  if (!lead || !assessment || assessment.leadId !== leadId) {
    notFound();
  }

  const profile = getCurrentClientProfile(leadId);

  const answers = {
    objectives: safeParseJson<Record<string, SuitabilityAnswerValue>>(assessment.objectivesJson) ?? {},
    financial_situation: safeParseJson<Record<string, SuitabilityAnswerValue>>(assessment.financialSituationJson) ?? {},
    knowledge_experience: safeParseJson<Record<string, SuitabilityAnswerValue>>(assessment.knowledgeExperienceJson) ?? {},
    liquidity_needs: safeParseJson<Record<string, SuitabilityAnswerValue>>(assessment.liquidityNeedsJson) ?? {},
    restrictions: safeParseJson<Record<string, SuitabilityAnswerValue>>(assessment.restrictionsJson) ?? {}
  };

  const breakdown = safeParseJson<Record<string, number>>(assessment.breakdownJson) ?? {};
  const constraints = safeParseJson<Array<{ section: string; questionId: string; labels: string[] }>>(assessment.constraintsJson) ?? [];
  const reviewFlags = safeParseJson<Array<{ code: string; severity: string; message: string }>>(assessment.reviewFlagsJson) ?? [];
  const capsApplied = safeParseJson<Array<{ reasonCode: string; maxProfile: string }>>(assessment.capsAppliedJson) ?? [];
  const clarificationRequests = safeParseJson<Array<{ message: string; requestedAt: string; requestedBy: string | null }>>(assessment.clarificationRequestsJson) ?? [];

  const canApprove = assessment.status === 'submitted' || assessment.status === 'review_required';
  const canRequestClarification = canApprove;
  const isApproved = assessment.status === 'approved';

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Cockpit — Suitability</div>
          <h1>Revisar perfil de adequação</h1>
          <p>Lead: <strong>{lead.fullName}</strong> ({lead.email})</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href={`/cockpit/leads/${leadId}`}>← Voltar ao lead</a>
        </div>
      </div>

      {action === 'approved' && (
        <section className="card" style={{ background: '#1f4e79', color: '#fff' }}>
          <p>✓ Suitability aprovada com sucesso.</p>
        </section>
      )}
      {action === 'clarification_requested' && (
        <section className="card" style={{ background: '#fffbeb' }}>
          <p>✓ Pedido de esclarecimento enviado ao cliente.</p>
        </section>
      )}

      <section className="card">
        <div className="kicker">Resumo do scoring</div>
        <p>Status: <strong>{assessment.status}</strong></p>
        <p>Score: <strong>{assessment.score ?? '-'}</strong> / 100</p>
        <p>Perfil computado: <strong>{assessment.computedRiskProfile ?? '-'}</strong></p>
        <p>Perfil capped (após caps prudenciais): <strong>{assessment.cappedRiskProfile ?? '-'}</strong></p>
        {isApproved && (
          <>
            <p>Perfil aprovado: <strong>{assessment.approvedRiskProfile ?? '-'}</strong></p>
            <p>Validade até: <strong>{assessment.expiresAt ?? '-'}</strong></p>
            {assessment.overrideReason && <p className="hint">Override: {assessment.overrideReason}</p>}
          </>
        )}
        <p className="hint">Calibração: {assessment.scoringCalibrationVersion ?? '-'} • Hash respostas: {assessment.answersHash?.slice(0, 12) ?? '-'}...</p>
        <p className="hint">Submetido por: {assessment.submittedBy ?? '-'} ({assessment.submittedByRole ?? '-'}) em {formatDateTime(assessment.submittedAt)}</p>
        {profile && (
          <p className="hint">Perfil vigente do cliente: {profile.status} ({profile.riskProfile ?? 'sem perfil'})</p>
        )}
      </section>

      {capsApplied.length > 0 && (
        <section className="card" style={{ marginTop: 16, background: '#fff5e6' }}>
          <div className="kicker">Caps prudenciais aplicados</div>
          <ul>
            {capsApplied.map((cap, idx) => (
              <li key={idx}>
                <strong>{cap.reasonCode}</strong> → perfil máximo: {cap.maxProfile}
              </li>
            ))}
          </ul>
        </section>
      )}

      {reviewFlags.length > 0 && (
        <section className="card" style={{ marginTop: 16, background: '#ffe6e6' }}>
          <div className="kicker">Flags de revisão</div>
          <ul>
            {reviewFlags.map((flag, idx) => (
              <li key={idx}>
                <strong>[{flag.severity}]</strong> {flag.message} <span className="hint">({flag.code})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {constraints.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="kicker">Restrições declaradas</div>
          <ul>
            {constraints.map((c, idx) => (
              <li key={idx}>{c.section} → {c.labels.join(', ')}</li>
            ))}
          </ul>
        </section>
      )}

      {clarificationRequests.length > 0 && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="kicker">Esclarecimentos solicitados</div>
          <ul>
            {clarificationRequests.map((req, idx) => (
              <li key={idx}>
                {formatDateTime(req.requestedAt)}: {req.message}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Respostas detalhadas</div>
        {suitabilityQuestionnaireV1.map((section) => (
          <div key={section.key} style={{ marginTop: 12 }}>
            <h3 style={{ marginBottom: 4 }}>{section.description}</h3>
            <p className="hint" style={{ marginTop: 0 }}>
              {section.cvmReference} • Score normalizado: {breakdown[section.key]?.toFixed?.(1) ?? '-'}
            </p>
            <ul>
              {section.questions.map((q) => (
                <li key={q.id} style={{ marginTop: 4 }}>
                  <strong>{q.prompt}</strong>
                  <br />
                  {answers[section.key]?.[q.id] !== undefined
                    ? answerLabel(section.key, q.id, answers[section.key][q.id])
                    : '—'}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {canApprove && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="kicker">Aprovar perfil</div>
          <form
            method="post"
            action={`/cockpit/leads/${leadId}/suitability/${assessmentId}/submit-action?action=approve`}
            style={{ display: 'grid', gap: 12 }}
          >
            <label>
              Perfil aprovado (default: <strong>{assessment.cappedRiskProfile}</strong>)
              <br />
              <select name="approvedRiskProfile" defaultValue={assessment.cappedRiskProfile ?? ''}>
                {clientRiskProfiles.map((profile) => (
                  <option key={profile} value={profile}>{profile}</option>
                ))}
              </select>
            </label>
            <label>
              Validade até (YYYY-MM-DD)
              <br />
              <input
                type="date"
                name="validUntil"
                defaultValue={new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                required
              />
            </label>
            <label>
              Notas de aprovação (opcional)
              <br />
              <textarea name="approvalNotes" rows={2} style={{ width: '100%' }} />
            </label>
            <label>
              Razão do override (obrigatório se mudar o perfil)
              <br />
              <textarea name="overrideReason" rows={2} style={{ width: '100%' }} />
            </label>
            <div>
              <button className="btn" type="submit">Aprovar suitability</button>
            </div>
          </form>
        </section>
      )}

      {canRequestClarification && (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="kicker">Pedir esclarecimento</div>
          <form
            method="post"
            action={`/cockpit/leads/${leadId}/suitability/${assessmentId}/submit-action?action=clarify`}
            style={{ display: 'grid', gap: 12 }}
          >
            <label>
              Mensagem para o cliente (obrigatória)
              <br />
              <textarea name="message" rows={3} style={{ width: '100%' }} required />
            </label>
            <div>
              <button className="btn btn-secondary" type="submit">Enviar pedido de esclarecimento</button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
