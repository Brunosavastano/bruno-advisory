import { listAllAuditLog, listAuditLog } from '../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

function getParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseOffset(value: string | undefined) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, parsed);
}

function buildHref(leadId: string, offset: number) {
  const params = new URLSearchParams();
  if (leadId) {
    params.set('leadId', leadId);
  }
  if (offset > 0) {
    params.set('offset', String(offset));
  }

  const query = params.toString();
  return query ? `/cockpit/audit-log?${query}` : '/cockpit/audit-log';
}

function renderDetail(detail: Record<string, unknown> | null) {
  if (!detail) {
    return '-';
  }

  return JSON.stringify(detail);
}

export default async function AuditLogPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const leadId = getParam(resolvedSearchParams?.leadId)?.trim() || '';
  const offset = parseOffset(getParam(resolvedSearchParams?.offset));
  const limit = 20;
  const entries = leadId
    ? listAuditLog({ leadId, limit, offset })
    : listAllAuditLog({ limit, offset });
  const previousOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Cockpit interno</div>
          <h1>Unified audit log</h1>
          <p>Registro único das ações críticas de billing, portal, review e cockpit.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/cockpit/leads">
            Leads
          </a>
          <a className="btn btn-secondary" href="/cockpit/review-queue">
            Review queue
          </a>
          <a className="btn btn-secondary" href="/cockpit/billing">
            Billing overview
          </a>
        </div>
      </div>

      <section className="card">
        <form className="form" method="get" action="/cockpit/audit-log">
          <label>
            Filtrar por leadId (opcional)
            <input name="leadId" type="text" defaultValue={leadId} placeholder="lead uuid" />
          </label>
          <button className="btn" type="submit">
            Aplicar filtro
          </button>
        </form>
        <p className="hint">Pagina atual: offset {offset}, limite {limit}.</p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        {entries.length === 0 ? (
          <p>Nenhum evento auditado para este filtro.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>createdAt</th>
                  <th>action</th>
                  <th>entityType</th>
                  <th>entityId</th>
                  <th>leadId</th>
                  <th>actorType</th>
                  <th>detail</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.createdAt}</td>
                    <td>{entry.action}</td>
                    <td>{entry.entityType}</td>
                    <td>{entry.entityId}</td>
                    <td>{entry.leadId ?? '-'}</td>
                    <td>{entry.actorType}</td>
                    <td>{renderDetail(entry.detail)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="actions" style={{ marginTop: 12 }}>
          {offset > 0 ? (
            <a className="btn btn-secondary" href={buildHref(leadId, previousOffset)}>
              Página anterior
            </a>
          ) : null}
          {entries.length === limit ? (
            <a className="btn btn-secondary" href={buildHref(leadId, nextOffset)}>
              Próxima página
            </a>
          ) : null}
        </div>
      </section>
    </main>
  );
}
