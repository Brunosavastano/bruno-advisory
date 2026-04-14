import { portalInviteModel, recommendationModel } from '@bruno-advisory/core';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession, listRecommendations } from '../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatCategory(value: string | null) {
  if (!value) {
    return 'Sem categoria';
  }

  return value.replaceAll('_', ' ');
}

export default async function PortalLedgerPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(portalInviteModel.cookie.name)?.value ?? null;

  if (!sessionToken) {
    redirect('/portal/login');
  }

  const session = getSession(sessionToken);
  if (!session) {
    redirect('/portal/login');
  }

  const recommendations = listRecommendations(session.leadId, 'published');

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Portal do cliente</div>
          <h1>Ledger de recomendações</h1>
          <p>Recomendações publicadas para o seu acompanhamento.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/portal/dashboard">Voltar ao dashboard</a>
        </div>
      </div>

      <section className="card">
        <div className="kicker">Recomendações publicadas</div>
        <p className="hint">Modelo canônico: <code>{recommendationModel.canonicalArtifact}</code></p>

        {recommendations.length === 0 ? (
          <p>Ainda não há recomendações publicadas para este cliente.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {recommendations.map((recommendation) => (
              <article key={recommendation.recommendationId} className="card" style={{ marginTop: 0 }}>
                <p><strong>{recommendation.title}</strong></p>
                <p className="hint">
                  {formatCategory(recommendation.category)} | {formatDate(recommendation.publishedAt ?? recommendation.createdAt)}
                </p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{recommendation.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
