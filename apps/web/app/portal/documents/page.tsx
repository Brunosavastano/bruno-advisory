import { portalInviteModel, documentUploadModel } from '@savastano-advisory/core';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSession, listDocuments } from '../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export default async function PortalDocumentsPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(portalInviteModel.cookie.name)?.value ?? null;

  if (!sessionToken) {
    redirect('/portal/login');
  }

  const session = getSession(sessionToken);
  if (!session) {
    redirect('/portal/login');
  }

  const documents = listDocuments(session.leadId);

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Portal do cliente</div>
          <h1>Documentos</h1>
          <p>Envie arquivos de até 10MB nos formatos aceitos pelo portal.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/portal/dashboard">Voltar ao dashboard</a>
        </div>
      </div>

      <section className="card">
        <div className="kicker">Upload</div>
        <p className="hint">
          Tipos aceitos: {documentUploadModel.allowedMimeTypes.join(', ')}
        </p>
        <form method="post" action="/api/portal/documents" encType="multipart/form-data" className="form">
          <label>
            Arquivo
            <input name="file" type="file" required />
          </label>
          <button className="btn" type="submit">Enviar documento</button>
        </form>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Arquivos enviados</div>
        {documents.length === 0 ? (
          <p>Nenhum documento enviado ainda.</p>
        ) : (
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Status</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((document) => (
                  <tr key={document.documentId}>
                    <td>{document.originalFilename}</td>
                    <td>{document.status}</td>
                    <td>{formatDateTime(document.uploadedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
