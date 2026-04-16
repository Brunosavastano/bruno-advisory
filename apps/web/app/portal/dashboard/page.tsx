import { commercialStageModel, portalInviteModel } from '@savastano-advisory/core';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession, getStoredLeadById, listChecklistItems } from '../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

export default async function PortalDashboardPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(portalInviteModel.cookie.name)?.value ?? null;

  if (!sessionToken) {
    redirect('/portal/login');
  }

  const session = getSession(sessionToken);
  if (!session) {
    redirect('/portal/login');
  }

  const lead = getStoredLeadById(session.leadId);
  if (!lead) {
    redirect('/portal/login');
  }

  const checklistItems = listChecklistItems(session.leadId);
  const completedCount = checklistItems.filter((item) => item.status === 'completed').length;

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Portal do cliente</div>
          <h1>Olá, {session.fullName}</h1>
          <p>Acompanhe seu onboarding e o estágio comercial atual.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/portal/ledger">Recomendações</a>
          <a className="btn btn-secondary" href="/portal/research">Research</a>
          <a className="btn btn-secondary" href="/portal/memos">Memos</a>
          <a className="btn btn-secondary" href="/portal/documents">Documentos</a>
          <form method="post" action="/portal/logout">
            <button className="btn btn-secondary" type="submit">Sair</button>
          </form>
        </div>
      </div>

      <section className="card">
        <div className="kicker">Status atual</div>
        <p>
          Estágio do lead:{' '}
          <strong>
            {commercialStageModel.labels[session.commercialStage as keyof typeof commercialStageModel.labels] ?? session.commercialStage}
          </strong>
        </p>
        <p>Resumo call: <strong>{lead.resumoCall ?? '-'}</strong></p>
        <p>Próximo passo: <strong>{lead.proximoPasso ?? '-'}</strong></p>
        <p>Contexto comercial: <strong>{lead.cadenciaAcordada ?? lead.ocupacaoPerfil ?? '-'}</strong></p>
        <p className="hint">Lead ID: {session.leadId}</p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Recomendações</div>
        <p>Acompanhe as recomendações publicadas no ledger do portal.</p>
        <a className="btn" href="/portal/ledger">Abrir ledger</a>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Research</div>
        <p>Acompanhe os itens de research já entregues no portal.</p>
        <a className="btn" href="/portal/research">Abrir research</a>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Memos</div>
        <p>Acompanhe os memos publicados no portal.</p>
        <a className="btn" href="/portal/memos">Abrir memos</a>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Documentos</div>
        <p>Envie e acompanhe seus documentos na área dedicada do portal.</p>
        <a className="btn" href="/portal/documents">Abrir documentos</a>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Checklist de onboarding</div>
        <p>
          Itens concluídos: <strong>{completedCount}</strong> de <strong>{checklistItems.length}</strong>
        </p>

        {checklistItems.length === 0 ? (
          <p>Nenhum item de onboarding foi criado ainda.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {checklistItems.map((item) => (
              <div key={item.itemId} className="card" style={{ marginTop: 0 }}>
                <p>
                  <strong>{item.title}</strong>
                </p>
                {item.description ? <p>{item.description}</p> : null}
                {item.status === 'completed' ? (
                  <p className="hint">
                    ✅ Concluído em {formatDateTime(item.completedAt)}
                  </p>
                ) : (
                  <form method="post" action={`/api/portal/checklist/${item.itemId}`}>
                    <input type="hidden" name="returnTo" value="/portal/dashboard" />
                    <button className="btn" type="submit">Mark complete</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
