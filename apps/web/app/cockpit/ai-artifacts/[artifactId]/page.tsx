// AI artifact viewer. Shows the full output for review, plus job metadata (cost, latency, tokens,
// guardrails, redaction counts) so the operator has all context before approving or rejecting.
//
// Server component renders the static metadata. The approval/rejection actions live in a client
// component to handle the rejection-reason modal.

import { notFound } from 'next/navigation';
import { getAiArtifact } from '../../../../lib/storage/ai-artifacts';
import { getAiJob } from '../../../../lib/storage/ai-jobs';
import { listGuardrailResultsForJob } from '../../../../lib/storage/ai-guardrail-results';
import { getStoredLeadById } from '../../../../lib/storage/leads';
import { ArtifactReviewActions } from './artifact-review-actions';

export const dynamic = 'force-dynamic';

function formatCost(cents: number): string {
  return `${cents}¢ (US$ ${(cents / 100).toFixed(2)})`;
}

function formatLatency(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '-';
  return `${(ms / 1000).toFixed(1)}s`;
}

function parseBreakdown(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default async function ArtifactViewPage({ params }: { params: Promise<{ artifactId: string }> }) {
  const { artifactId } = await params;
  const artifact = getAiArtifact(artifactId);
  if (!artifact) notFound();

  const job = getAiJob(artifact.jobId);
  const lead = artifact.leadId ? getStoredLeadById(artifact.leadId) : null;
  const guardrails = listGuardrailResultsForJob(artifact.jobId);
  const breakdown = job ? parseBreakdown(job.costBreakdownJson) : null;
  const redactionCounts = breakdown && typeof breakdown.redactionCounts === 'object' ? (breakdown.redactionCounts as Record<string, number>) : {};

  return (
    <main>
      <div className="header">
        <div>
          <div className="badge" style={{ background: '#8B1A1A', color: '#F5F0E8', borderColor: '#8B1A1A' }}>
            IA — {artifact.artifactType}
          </div>
          <h1>{artifact.title}</h1>
          <p>
            Status: <strong>{artifact.status}</strong>
            {artifact.reviewedBy ? ` — revisado por ${artifact.reviewedBy} em ${artifact.reviewedAt}` : ''}
          </p>
        </div>
        <div className="actions">
          <a className="btn btn-secondary" href="/cockpit/review-queue">
            Voltar para review queue
          </a>
          {lead ? (
            <a className="btn btn-secondary" href={`/cockpit/leads/${lead.leadId}`}>
              Abrir lead: {lead.fullName}
            </a>
          ) : null}
          {lead ? (
            <a className="btn btn-secondary" href={`/cockpit/leads/${lead.leadId}/ai-history`}>
              Histórico IA do lead
            </a>
          ) : null}
        </div>
      </div>

      {artifact.status === 'pending_review' && lead ? (
        <ArtifactReviewActions leadId={lead.leadId} artifactId={artifact.artifactId} />
      ) : null}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Conteúdo</div>
        <pre
          style={{
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'inherit',
            fontSize: 14,
            lineHeight: 1.6,
            background: 'rgba(255,255,255,0.03)',
            padding: 16,
            borderRadius: 6,
            margin: 0
          }}
        >
          {artifact.body}
        </pre>
      </section>

      {job ? (
        <section className="card" style={{ marginTop: 16 }}>
          <div className="kicker">Job de IA</div>
          <p>jobId: <code>{job.jobId}</code></p>
          <p>Tipo: <strong>{job.jobType}</strong> · Surface: <strong>{job.surface}</strong></p>
          <p>Provider: <strong>{job.provider}</strong> · Modelo: <strong>{job.model}</strong> ({job.modelVersionId})</p>
          <p>
            Prompt template: <strong>{job.promptTemplateId}</strong> v{job.promptTemplateVersion}
          </p>
          <p>
            Input redaction: <strong>{job.inputRedactionLevel}</strong>
            {Object.keys(redactionCounts).length > 0
              ? ` — PII removida: ${Object.entries(redactionCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`
              : ' — nenhuma PII detectada'}
          </p>
          <p>
            Tokens: <strong>{job.inputTokens}</strong> in / <strong>{job.outputTokens}</strong> out
            {job.cachedInputTokens > 0 ? ` (${job.cachedInputTokens} cached)` : ''}
          </p>
          <p>
            Custo: <strong>{formatCost(job.costCents)}</strong> · Latência: <strong>{formatLatency(job.latencyMs)}</strong>
          </p>
          <p>Status do job: <strong>{job.status}</strong></p>
          <p>Criado em: {job.createdAt}{job.completedAt ? ` · Finalizado em ${job.completedAt}` : ''}</p>
          {job.errorMessage ? <p style={{ color: '#b42318' }}>Erro: {job.errorMessage}</p> : null}
        </section>
      ) : null}

      <section className="card" style={{ marginTop: 16 }}>
        <div className="kicker">Guardrails</div>
        {guardrails.length === 0 ? (
          <p>Nenhum guardrail registrado para este job.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {guardrails.map((g) => {
              const color = g.status === 'pass' ? '#027a48' : g.status === 'warn' ? '#b54708' : '#b42318';
              return (
                <li
                  key={g.resultId}
                  style={{
                    padding: '8px 12px',
                    borderLeft: `3px solid ${color}`,
                    marginBottom: 6,
                    background: 'rgba(255,255,255,0.02)'
                  }}
                >
                  <strong>{g.ruleName}</strong> — <span style={{ color }}>{g.status}</span>
                  {g.detail ? <span> — {g.detail}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
