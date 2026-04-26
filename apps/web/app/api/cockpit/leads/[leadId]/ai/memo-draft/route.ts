// First AI surface: generate a memo draft for a lead via the LLM gateway.
// Output lands in ai_artifacts with status='pending_review'. NEVER published. Operator reviews,
// edits, approves/rejects, and only then can the artifact body be transferred to a real memo via
// the existing memos route (manual copy-paste in the cockpit UI for now).
//
// Auth: requireCockpitSession. Both legacy COCKPIT_SECRET and real session cookies accepted.
// Audit: every call writes ai_job_created + ai_job_status_changed (running) + (succeeded|failed|
// blocked_budget) + ai_artifact_created (only on success) into audit_log.

import { createAiArtifact } from '../../../../../../../lib/storage/ai-artifacts';
import { getStoredLeadById } from '../../../../../../../lib/storage/leads';
import { listRecommendations } from '../../../../../../../lib/storage/recommendations';
import { listMemos } from '../../../../../../../lib/storage/memos';
import { listAuditLog } from '../../../../../../../lib/storage/audit-log';
import { requireCockpitSession } from '../../../../../../../lib/cockpit-session';
import { getActiveProvider, isAiEnabled } from '../../../../../../../lib/ai/provider';
import { runAiJob } from '../../../../../../../lib/ai/run-job';

type MemoDraftPayload = {
  focusHint?: string;
};

function summarizeLeadContext(leadId: string): string {
  const lead = getStoredLeadById(leadId);
  if (!lead) return '(lead não encontrado)';

  const recommendations = listRecommendations(leadId).slice(0, 3);
  const memos = listMemos(leadId).slice(0, 3);
  const audit = listAuditLog({ leadId, limit: 10 });

  const parts: string[] = [];
  parts.push(`Lead: ${lead.fullName} (${lead.email})`);
  parts.push(`Faixa de patrimônio investível: ${lead.investableAssetsBand}`);
  if (lead.primaryChallenge) parts.push(`Desafio principal declarado: ${lead.primaryChallenge}`);
  if (lead.commercialStage) parts.push(`Estágio comercial: ${lead.commercialStage}`);
  if (lead.fitSummary) parts.push(`Fit summary: ${lead.fitSummary}`);

  if (recommendations.length > 0) {
    parts.push('');
    parts.push('Recomendações já registradas (mais recentes):');
    for (const rec of recommendations) {
      parts.push(`- [${rec.category ?? 'geral'}] ${rec.title}`);
    }
  }

  if (memos.length > 0) {
    parts.push('');
    parts.push('Memos existentes (mais recentes):');
    for (const memo of memos) {
      parts.push(`- [${memo.status}] ${memo.title}`);
    }
  }

  if (audit.length > 0) {
    parts.push('');
    parts.push('Eventos recentes (audit log):');
    for (const entry of audit.slice(0, 5)) {
      parts.push(`- ${entry.createdAt}: ${entry.action}`);
    }
  }

  return parts.join('\n');
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const check = await requireCockpitSession(request);
  if (!check.ok) return Response.json(check.body, { status: check.status });

  const { leadId } = await context.params;
  const lead = getStoredLeadById(leadId);
  if (!lead) {
    return Response.json({ ok: false, error: 'lead_not_found' }, { status: 404 });
  }

  if (!isAiEnabled()) {
    return Response.json(
      { ok: false, error: 'ai_disabled', reason: 'Set AI_ENABLED=true to enable AI features.' },
      { status: 503 }
    );
  }

  const payload = (await request.json().catch(() => ({}))) as MemoDraftPayload;
  const focusHint = payload.focusHint?.trim() || null;

  const leadContext = summarizeLeadContext(leadId);
  const userPrompt = focusHint
    ? `Contexto do lead:\n${leadContext}\n\nFoco específico solicitado pelo consultor: ${focusHint}`
    : `Contexto do lead:\n${leadContext}`;

  let provider;
  try {
    provider = getActiveProvider();
  } catch (error) {
    return Response.json(
      { ok: false, error: 'provider_unavailable', reason: error instanceof Error ? error.message : String(error) },
      { status: 503 }
    );
  }

  const result = await runAiJob({
    provider,
    jobType: 'memo_draft',
    surface: 'cockpit_copilot',
    leadId,
    systemPrompt: 'Você é um assistente interno de um consultor de valores mobiliários registrado na CVM. Gere rascunho INTERNO para revisão humana.',
    userPrompt,
    maxOutputTokens: 1500,
    promptTemplateName: 'memo_internal_draft',
    inputRedactionLevel: 'strict',
    createdBy: check.context.actorId,
    actorId: check.context.actorId
  });

  if (!result.ok) {
    const status =
      result.errorCode === 'blocked_budget' ? 402 :
      result.errorCode === 'ai_disabled' ? 503 :
      result.errorCode === 'no_active_template' || result.errorCode === 'no_active_model' ? 500 :
      result.errorCode === 'provider_failure' ? 502 :
      500;

    return Response.json(
      {
        ok: false,
        error: result.errorCode,
        reason: result.errorMessage,
        jobId: result.job?.jobId ?? null,
        budgetCheck: result.budgetCheck ?? null
      },
      { status }
    );
  }

  // Create the artifact in pending_review for the existing review queue UI.
  const artifact = createAiArtifact({
    jobId: result.job.jobId,
    leadId,
    artifactType: 'memo_draft',
    title: `Rascunho de memo (${new Date().toISOString().slice(0, 10)})`,
    body: result.content,
    requiresGrounding: false,
    status: 'pending_review',
    actorId: check.context.actorId
  });

  return Response.json(
    {
      ok: true,
      jobId: result.job.jobId,
      artifactId: artifact.artifactId,
      status: artifact.status,
      costCents: result.job.costCents,
      latencyMs: result.job.latencyMs
    },
    { status: 201 }
  );
}
