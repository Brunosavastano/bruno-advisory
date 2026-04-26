// runAiJob — the single orchestration point for every LLM call.
//
// Flow:
//   1. Resolve active model version + prompt template (via storage helpers).
//   2. Estimate input tokens and projected cost. (Output assumed at maxOutputTokens for safety.)
//   3. checkBudgetForJob → if blocked, create job with status=blocked_budget and return early.
//   4. createAiJob (status=queued).
//   5. updateAiJobStatus(running).
//   6. provider.generate(...).
//   7. On ok: compute real cost, updateAiJobStatus(succeeded) with tokens/cost/output_hash.
//      On failure: updateAiJobStatus(failed) with error_message.
//   8. Return job + content (or error) to caller; caller decides what artifact to create.
//
// Caller responsibility: create ai_artifact from the returned content (artifact creation is
// surface-specific so it stays out of run-job).

import { createHash } from 'node:crypto';
import { computeCostCents, estimateInputTokens, parsePricing } from './costs';
import { checkBudgetForJob, type BudgetCheckResult } from './budgets';
import { isAiEnabled } from './provider';
import type { AiProvider } from './types';
import {
  cancelAiJob,
  createAiJob,
  type CreateAiJobParams,
  type UpdateAiJobStatusParams,
  updateAiJobStatus
} from '../storage/ai-jobs';
import { getActiveModelVersion } from '../storage/ai-model-versions';
import { getActiveTemplate } from '../storage/ai-prompt-templates';
import { aiJobsTable, getDatabase } from '../storage/db';
import type { AiJobInputRedactionLevel, AiJobRecord } from '@savastano-advisory/core';

export type RunAiJobParams = {
  provider: AiProvider;
  jobType: string;
  surface: string;
  leadId: string | null;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
  promptTemplateName: string;
  promptTemplateVersion?: string; // if omitted, uses latest active
  inputRedactionLevel?: AiJobInputRedactionLevel;
  budgetKey?: string | null;
  createdBy: string;
  actorId?: string | null;
};

export type RunAiJobOk = {
  ok: true;
  job: AiJobRecord;
  content: string;
};

export type RunAiJobFailure = {
  ok: false;
  job: AiJobRecord | null;
  errorCode: 'ai_disabled' | 'no_active_template' | 'no_active_model' | 'blocked_budget' | 'provider_failure' | 'internal';
  errorMessage: string;
  budgetCheck?: BudgetCheckResult;
};

export type RunAiJobResult = RunAiJobOk | RunAiJobFailure;

function hashInput(systemPrompt: string, userPrompt: string): string {
  return `sha256:${createHash('sha256').update(`${systemPrompt}\n---\n${userPrompt}`).digest('hex')}`;
}

export async function runAiJob(params: RunAiJobParams): Promise<RunAiJobResult> {
  if (!isAiEnabled()) {
    return { ok: false, job: null, errorCode: 'ai_disabled', errorMessage: 'AI_ENABLED is not set to true.' };
  }

  // Resolve template
  const template = getActiveTemplate({ name: params.promptTemplateName, version: params.promptTemplateVersion });
  if (!template) {
    return {
      ok: false,
      job: null,
      errorCode: 'no_active_template',
      errorMessage: `No active prompt template named '${params.promptTemplateName}'`
    };
  }

  // Resolve model version. The model_version row reflects the upstream service
  // (e.g., 'anthropic'), not the runtime adapter (which may be 'mock' during testing).
  // Use AI_PROVIDER env to find the row; fall back to the adapter name only if no env var is set.
  const upstreamProvider = (process.env.AI_PROVIDER ?? params.provider.name).toLowerCase();
  const modelId = process.env.AI_MODEL ?? 'claude-sonnet-4-6';
  const modelVersion = getActiveModelVersion({ provider: upstreamProvider, modelId });
  if (!modelVersion) {
    return {
      ok: false,
      job: null,
      errorCode: 'no_active_model',
      errorMessage: `No active model version for provider=${upstreamProvider} modelId=${modelId}`
    };
  }

  // Estimate cost
  const pricing = parsePricing(modelVersion.inputPriceJson, modelVersion.outputPriceJson, modelId);
  const estimatedInputTokens = estimateInputTokens(params.systemPrompt, params.userPrompt);
  const estimatedCostCents = computeCostCents({
    inputTokens: estimatedInputTokens,
    outputTokens: params.maxOutputTokens,
    pricing
  });

  // Budget check
  const budgetCheck = checkBudgetForJob({
    surface: params.surface,
    jobType: params.jobType,
    leadId: params.leadId,
    estimatedCostCents
  });

  // Build job creation params. We record the upstream provider (anthropic), not the adapter
  // name, so cost reports and audits reflect the real-world service even when mocked locally.
  const jobCreate: CreateAiJobParams = {
    leadId: params.leadId,
    jobType: params.jobType,
    surface: params.surface,
    provider: upstreamProvider,
    model: modelId,
    modelVersionId: modelVersion.modelVersionId,
    promptTemplateId: template.templateId,
    promptTemplateVersion: template.version,
    inputHash: hashInput(params.systemPrompt, params.userPrompt),
    inputRedactionLevel: params.inputRedactionLevel ?? 'strict',
    budgetKey: params.budgetKey ?? null,
    createdBy: params.createdBy,
    actorId: params.actorId ?? null
  };

  if (!budgetCheck.ok) {
    // Create the job, then mark it blocked_budget. Caller still gets a job record for telemetry.
    const job = createAiJob(jobCreate);
    const blocked = updateAiJobStatus({
      jobId: job.jobId,
      status: 'blocked_budget',
      costBreakdownJson: JSON.stringify({ blocking: budgetCheck.blocking, evaluations: budgetCheck.evaluations }),
      errorMessage: `Blocked by cap ${budgetCheck.blocking.capId} (${budgetCheck.blocking.scopeType}=${budgetCheck.blocking.scopeValue}, ${budgetCheck.blocking.period})`,
      actorId: params.actorId ?? null
    });
    return {
      ok: false,
      job: blocked ?? job,
      errorCode: 'blocked_budget',
      errorMessage: 'Budget cap would be exceeded',
      budgetCheck
    };
  }

  const job = createAiJob(jobCreate);

  const running = updateAiJobStatus({
    jobId: job.jobId,
    status: 'running',
    actorId: params.actorId ?? null
  });

  // Provider call
  const callResult = await params.provider.generate({
    modelId,
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    maxOutputTokens: params.maxOutputTokens
  });

  if (!callResult.ok) {
    const failed = updateAiJobStatus({
      jobId: job.jobId,
      status: 'failed',
      latencyMs: callResult.latencyMs,
      errorMessage: `${callResult.errorCode}: ${callResult.errorMessage}`,
      actorId: params.actorId ?? null
    });
    return {
      ok: false,
      job: failed ?? running ?? job,
      errorCode: 'provider_failure',
      errorMessage: callResult.errorMessage,
      budgetCheck
    };
  }

  const realCostCents = computeCostCents({
    inputTokens: callResult.inputTokens,
    outputTokens: callResult.outputTokens,
    cachedInputTokens: callResult.cachedInputTokens,
    pricing
  });

  const outputHash = createHash('sha256').update(callResult.content).digest('hex');

  const succeeded = updateAiJobStatus({
    jobId: job.jobId,
    status: 'succeeded',
    outputHash: `sha256:${outputHash}`,
    inputTokens: callResult.inputTokens,
    outputTokens: callResult.outputTokens,
    cachedInputTokens: callResult.cachedInputTokens,
    costCents: realCostCents,
    latencyMs: callResult.latencyMs,
    costBreakdownJson: JSON.stringify({
      pricing,
      providerResponseHash: callResult.rawProviderResponseHash,
      estimate: { inputTokens: estimatedInputTokens, costCents: estimatedCostCents }
    }),
    actorId: params.actorId ?? null
  });

  if (!succeeded) {
    return { ok: false, job: running ?? job, errorCode: 'internal', errorMessage: 'Failed to update job to succeeded' };
  }

  return { ok: true, job: succeeded, content: callResult.content };
}

// Utility for tests/admin: delete a partial run if needed (not exposed to routes).
export function discardJob(jobId: string, reason: string) {
  cancelAiJob({ jobId, reason });
}

export function getJobsTable(): string {
  return aiJobsTable; // re-exported so dev tooling doesn't have to know storage internals
}

export function _runJobDb() {
  return getDatabase();
}
