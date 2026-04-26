// Shared handler for cockpit AI surfaces that follow the same shape:
//   - Auth via requireCockpitSession
//   - Lead lookup + context build
//   - AI_ENABLED + provider check
//   - runAiJob with the surface-specific prompt template
//   - Create ai_artifact (pending_review) on success
//   - Map runAiJob errors to HTTP status codes
//
// Each concrete surface (memo-draft, research-summary, pre-call-brief, etc.) supplies a small
// LeadAiSurfaceConfig and the handler does the rest. Keeps individual route files at ~15 lines and
// guarantees uniform behaviour across surfaces (audit, redaction, guardrails, retry all inherited).

import type { AiArtifactRecord } from '@savastano-advisory/core';
import { createAiArtifact } from '../storage/ai-artifacts';
import { listAuditLog } from '../storage/audit-log';
import { getStoredLeadById } from '../storage/leads';
import { listMemos } from '../storage/memos';
import { listRecommendations } from '../storage/recommendations';
import { requireCockpitSession } from '../cockpit-session';
import { getActiveProvider, isAiEnabled } from './provider';
import { runAiJob, type RunAiJobResult } from './run-job';
import type { AiJobInputRedactionLevel } from '@savastano-advisory/core';

export type LeadAiSurfaceConfig = {
  jobType: string;
  artifactType: string;
  artifactTitle: () => string;
  promptTemplateName: string;
  systemPrompt: string;
  buildUserPrompt: (params: { leadId: string; focusHint: string | null; leadContext: string }) => string;
  maxOutputTokens?: number;
  inputRedactionLevel?: AiJobInputRedactionLevel;
};

export function summarizeLeadContext(leadId: string): string {
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

function statusForError(errorCode: Extract<RunAiJobResult, { ok: false }>['errorCode']): number {
  switch (errorCode) {
    case 'blocked_budget':
      return 402;
    case 'blocked_guardrail':
      return 422;
    case 'ai_disabled':
      return 503;
    case 'no_active_template':
    case 'no_active_model':
    case 'internal':
      return 500;
    case 'provider_failure':
      return 502;
    default:
      return 500;
  }
}

export type LeadAiSurfaceSuccessBody = {
  ok: true;
  jobId: string;
  artifactId: string;
  status: AiArtifactRecord['status'];
  costCents: number;
  latencyMs: number | null;
};

export async function handleLeadAiSurfacePost(
  request: Request,
  context: { params: Promise<{ leadId: string }> },
  config: LeadAiSurfaceConfig
): Promise<Response> {
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

  const payload = (await request.json().catch(() => ({}))) as { focusHint?: string };
  const focusHint = payload.focusHint?.trim() || null;

  let provider;
  try {
    provider = getActiveProvider();
  } catch (error) {
    return Response.json(
      { ok: false, error: 'provider_unavailable', reason: error instanceof Error ? error.message : String(error) },
      { status: 503 }
    );
  }

  const leadContext = summarizeLeadContext(leadId);
  const userPrompt = config.buildUserPrompt({ leadId, focusHint, leadContext });

  const result = await runAiJob({
    provider,
    jobType: config.jobType,
    surface: 'cockpit_copilot',
    leadId,
    systemPrompt: config.systemPrompt,
    userPrompt,
    maxOutputTokens: config.maxOutputTokens ?? 1500,
    promptTemplateName: config.promptTemplateName,
    inputRedactionLevel: config.inputRedactionLevel ?? 'strict',
    createdBy: check.context.actorId,
    actorId: check.context.actorId
  });

  if (!result.ok) {
    return Response.json(
      {
        ok: false,
        error: result.errorCode,
        reason: result.errorMessage,
        jobId: result.job?.jobId ?? null,
        budgetCheck: result.budgetCheck ?? null,
        guardrails: result.guardrails ?? null
      },
      { status: statusForError(result.errorCode) }
    );
  }

  const artifact = createAiArtifact({
    jobId: result.job.jobId,
    leadId,
    artifactType: config.artifactType,
    title: config.artifactTitle(),
    body: result.content,
    requiresGrounding: false,
    status: 'pending_review',
    actorId: check.context.actorId
  });

  const body: LeadAiSurfaceSuccessBody = {
    ok: true,
    jobId: result.job.jobId,
    artifactId: artifact.artifactId,
    status: artifact.status,
    costCents: result.job.costCents,
    latencyMs: result.job.latencyMs
  };

  return Response.json(body, { status: 201 });
}
