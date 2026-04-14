import { commercialStageModel, localBillingOverviewModel } from '@bruno-advisory/core';
import {
  getIntakeStoragePaths,
  listLeadBillingOverviewRows
} from '../../../lib/intake-storage';

export const dynamic = 'force-dynamic';

function renderValue(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
}

export default function BillingCockpitPage() {
  const rows = listLeadBillingOverviewRows();
  const paths = getIntakeStoragePaths();

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Cockpit interno</div>
          <h1>Billing operations overview</h1>
          <p>Visão cruzada e fiel do billing local persistido por lead.</p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/cockpit/flags">
            Flags overview
          </a>
          <a className="btn btn-secondary" href="/cockpit/leads">
            Leads
          </a>
          <a className="btn btn-secondary" href="/">
            Landing
          </a>
        </div>
      </div>

      <section className="card">
        <div className="kicker">Billing observability T3 cycle 10</div>
        <p>
          Superfície canônica: <code>{localBillingOverviewModel.cockpitSurface}</code>
        </p>
        <p>
          Artefato canônico: <code>{localBillingOverviewModel.canonicalArtifact}</code>
        </p>
        <p className="hint">DB: {paths.database}</p>
        <p className="hint">Tabela de billing records: {paths.billingRecordsTable}</p>
        <p className="hint">Tabela de billing charges: {paths.billingChargesTable}</p>
        <p className="hint">Tabela de billing settlements: {paths.billingSettlementsTable}</p>
      </section>

      <section className="card" style={{ marginTop: 16 }}>
        {rows.length === 0 ? (
          <p>{localBillingOverviewModel.noBillingYetMessage}</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>lead</th>
                  <th>commercialStage</th>
                  <th>billingRecordStatus</th>
                  <th>latestCharge</th>
                  <th>latestChargeDueDate</th>
                  <th>latestSettlement</th>
                  <th>pendingChargeCount</th>
                  <th>outstanding</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.billingRecordId}>
                    <td>
                      <a href={`/cockpit/leads/${row.leadId}`}>{row.fullName}</a>
                      <div className="hint">{row.email}</div>
                    </td>
                    <td>{commercialStageModel.labels[row.commercialStage]}</td>
                    <td>{row.billingRecordStatus}</td>
                    <td>
                      {row.latestChargeSequence === null ? (
                        'Nenhuma cobranca ainda'
                      ) : (
                        <>
                          seq {row.latestChargeSequence} · {renderValue(row.latestChargeStatus)}
                        </>
                      )}
                    </td>
                    <td>{renderValue(row.latestChargeDueDate)}</td>
                    <td>
                      {row.latestSettlementAt ? (
                        <>
                          {renderValue(row.latestSettlementStatus)}
                          <div className="hint">{row.latestSettlementAt}</div>
                        </>
                      ) : (
                        'Nenhuma liquidacao ainda'
                      )}
                    </td>
                    <td>{row.pendingChargeCount}</td>
                    <td>{row.hasOutstandingCharges ? 'YES' : 'NO'}</td>
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
