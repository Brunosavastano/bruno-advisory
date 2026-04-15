import { portalInviteModel, researchWorkflowModel } from '@bruno-advisory/core';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession, listWorkflows } from '../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

export default async function PortalResearchPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(portalInviteModel.cookie.name)?.value ?? null;

  if (!sessionToken) {
    redirect('/portal/login');
  }

  const session = getSession(sessionToken);
  if (!session) {
    redirect('/portal/login');
  }

  const workflows = listWorkflows(session.leadId, 'delivered');

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Portal do cliente</div>
          <h1>Research entregue</h1>
          <p>Itens de research aprovados e já entregues para acompanhamento.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/portal/dashboard">Voltar ao dashboard</a>
        </div>
      </div>

      <section className="card">
        <div className="kicker">Research workflows entregues</div>
        <p className="hint">Modelo canônico: <code>{researchWorkflowModel.canonicalArtifact}</code></p>

        {workflows.length === 0 ? (
          <p>Ainda não há itens de research entregues para este cliente.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {workflows.map((workflow) => (
              <article key={workflow.id} className="card" style={{ marginTop: 0 }}>
                <p><strong>{workflow.title}</strong></p>
                <p className="hint">Tópico: {workflow.topic}</p>
                <p className="hint">Status: {workflow.status} | Atualizado em {formatDate(workflow.updatedAt)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
