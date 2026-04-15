import { memoModel, portalInviteModel } from '@bruno-advisory/core';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession, listMemos } from '../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(value));
}

export default async function PortalMemosPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(portalInviteModel.cookie.name)?.value ?? null;

  if (!sessionToken) {
    redirect('/portal/login');
  }

  const session = getSession(sessionToken);
  if (!session) {
    redirect('/portal/login');
  }

  const memos = listMemos(session.leadId, 'published');

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Portal do cliente</div>
          <h1>Memos publicados</h1>
          <p>Memos já aprovados e publicados para acompanhamento.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/portal/dashboard">Voltar ao dashboard</a>
        </div>
      </div>

      <section className="card">
        <div className="kicker">Memo ledger</div>
        <p className="hint">Modelo canônico: <code>{memoModel.canonicalArtifact}</code></p>

        {memos.length === 0 ? (
          <p>Ainda não há memos publicados para este cliente.</p>
        ) : (
          <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
            {memos.map((memo) => (
              <article key={memo.id} className="card" style={{ marginTop: 0 }}>
                <p><strong>{memo.title}</strong></p>
                <p className="hint">Status: {memo.status} | Atualizado em {formatDate(memo.updatedAt)}</p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{memo.body}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
