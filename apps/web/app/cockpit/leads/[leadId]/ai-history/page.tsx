// AI jobs history per lead. Shows what ran, when, cost, status, and latency.
// Useful for tracking spend per client and debugging failures.

import { notFound } from 'next/navigation';
import { listAiJobs } from '../../../../../lib/storage/ai-jobs';
import { listArtifactsForLead } from '../../../../../lib/storage/ai-artifacts';
import { getStoredLeadById } from '../../../../../lib/storage/leads';

export const dynamic = 'force-dynamic';

function formatLatency(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '-';
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusColor(status: string): string {
  if (status === 'succeeded') return '#027a48';
  if (status === 'running' || status === 'queued') return '#b54708';
  return '#b42318';
}

export default async function LeadAiHistoryPage({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  const lead = getStoredLeadById(leadId);
  if (!lead) notFound();

  const jobs = listAiJobs({ leadId, limit: 100 });
  const artifacts = listArtifactsForLead({ leadId });
  const artifactByJobId = new Map(artifacts.map((a) => [a.jobId, a]));

  const totalCostCents = jobs.reduce((sum, j) => sum + j.costCents, 0);
  const succeededCount = jobs.filter((j) => j.status === 'succeeded').length;

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge">Cockpit interno</div>
          <h1>Histórico de IA — {lead.fullName}</h1>
          <p>
            {jobs.length} job{jobs.length === 1 ? '' : 's'} registrados · {succeededCount} succeeded · custo
            total {totalCostCents}¢ (US$ {(totalCostCents / 100).toFixed(2)})
          </p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href={`/cockpit/leads/${lead.leadId}`}>
            Voltar para lead
          </a>
          <a className="btn btn-secondary" href="/cockpit/review-queue">
            Review queue
          </a>
        </div>
      </div>

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Jobs</div>
        {jobs.length === 0 ? (
          <p>Nenhum job de IA registrado para este lead.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>createdAt</th>
                  <th>jobType</th>
                  <th>status</th>
                  <th>tokens (in/out)</th>
                  <th>cost</th>
                  <th>latency</th>
                  <th>artifact</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const artifact = artifactByJobId.get(j.jobId);
                  return (
                    <tr key={j.jobId}>
                      <td>{j.createdAt}</td>
                      <td>{j.jobType}</td>
                      <td style={{ color: statusColor(j.status), fontWeight: 600 }}>{j.status}</td>
                      <td>
                        {j.inputTokens}/{j.outputTokens}
                      </td>
                      <td>{j.costCents}¢</td>
                      <td>{formatLatency(j.latencyMs)}</td>
                      <td>
                        {artifact ? (
                          <a href={`/cockpit/ai-artifacts/${artifact.artifactId}`}>
                            {artifact.status} — abrir
                          </a>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
