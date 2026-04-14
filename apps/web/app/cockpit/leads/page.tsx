import { minimumCockpitColumns } from '@bruno-advisory/core/intake-contract';
import { getIntakeStoragePaths, listStoredLeads } from '../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

function renderCellValue(lead: Record<string, unknown>, key: string) {
  const value = lead[key];

  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
}

export default function LeadsCockpitPage() {
  const leads = listStoredLeads();
  const paths = getIntakeStoragePaths();

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Cockpit interno</div>
          <h1>Leads recebidos</h1>
          <p>Leitura direta do storage durável de intake.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/cockpit/billing">
            Billing overview
          </a>
          <a className="btn btn-secondary" href="/">
            Landing
          </a>
          <a className="btn btn-secondary" href="/intake">
            Intake
          </a>
        </div>
      </div>

      <section className="card">
        <div className="kicker">Colunas canônicas mínimas</div>
        <p>{minimumCockpitColumns.join(', ')}</p>
        <p className="hint">DB: {paths.database}</p>
        <p className="hint">Tabela de leads: {paths.leadsTable}</p>
        <p className="hint">Tabela de eventos: {paths.eventsTable}</p>
        <p className="hint">Tabela de auditoria comercial: {paths.stageAuditTable}</p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        {leads.length === 0 ? (
          <p>Nenhum lead capturado ainda.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {minimumCockpitColumns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.leadId}>
                    {minimumCockpitColumns.map((column) => {
                      const cell = renderCellValue(lead as Record<string, unknown>, column);
                      if (column === 'fullName') {
                        return (
                          <td key={`${lead.leadId}-${column}`}>
                            <a href={`/cockpit/leads/${lead.leadId}`}>{cell}</a>
                          </td>
                        );
                      }

                      return <td key={`${lead.leadId}-${column}`}>{cell}</td>;
                    })}
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
