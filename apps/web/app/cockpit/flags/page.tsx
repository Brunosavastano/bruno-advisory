import { listAllLeadsWithActiveFlags } from '../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

export default function CockpitFlagsPage() {
  const leads = listAllLeadsWithActiveFlags();

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Cockpit interno</div>
          <h1>Internal pending flags</h1>
          <p>Visão consolidada das pendências internas por lead.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/cockpit/leads">
            Leads
          </a>
          <a className="btn btn-secondary" href="/cockpit/billing">
            Billing overview
          </a>
        </div>
      </div>

      <section className="card">
        {leads.length === 0 ? (
          <p>Nenhuma flag interna ativa.</p>
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {leads.map((lead) => (
              <article key={lead.leadId} className="card" style={{ margin: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div>
                    <div className="kicker">Lead</div>
                    <h2 style={{ margin: '4px 0 8px' }}>{lead.fullName}</h2>
                    <ul style={{ margin: 0, paddingLeft: 20 }}>
                      {lead.flags.map((flag) => (
                        <li key={flag.flagId}>
                          <strong>{flag.flagType}</strong>
                          {flag.note ? `, ${flag.note}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <a className="btn btn-secondary" href={`/cockpit/leads/${lead.leadId}`}>
                    Abrir lead
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
