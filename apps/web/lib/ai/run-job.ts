// runAiJob — the single orchestration point for every LLM call.
//
// Flow (AI-1 Cycle 3):
//   1. Resolve active model version + prompt template (via storage helpers).
//   2. Apply redaction to the user prompt (strip CPF/CNPJ/RG/card by default).
//   3. Estimate cost from the redacted prompt; check budgets.
//   4. createAiJob (status=queued) with the input_hash computed from the redacted prompt.
//   5. updateAiJobStatus(running).
//   6. provider.generate(...) — already wrapped with retry by getActiveProvider().
//   7a. On provider failure: updateAiJobStatus(failed) with error_message.
//   7b. On provider success: run output guardrails + (if applicable) JSON schema validation,
//       persist each result to ai_guardrail_results, and decide:
//         - any block → updateAiJobStatus(blocked_guardrail), no artifact
//         - all pass/warn → compute real cost, updateAiJobStatus(succeeded), return content
//
// Caller responsibility: create ai_artifact from the returned content.

import { createHash } from 'node:crypto';
import { computeCostCents, estimateInputTokens, parsePricing } from './costs';
import { checkBudgetForJob, type BudgetCheckResult } from './budgets';
import { runGuardrails, type GuardrailNamedResult, type GuardrailRunResult } from './guardrails';
import { validateOutputAgainstSchema } from './grounding';
import { isAiEnabled } from './provider';
import { redact } from './redaction';
import type { AiProvider } from './types';
import {
  cancelAiJob,
  createAiJob,
  type CreateAiJobParams,
  updateAiJobStatus
} from '../storage/ai-jobs';
import { getActiveModelVersion } from '../storage/ai-model-versions';
import { getActiveTemplate } from '../storage/ai-prompt-templates';
import { recordGuardrailResult } from '../storage/ai-guardrail-results';
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
  promptTemplateVersion?: string;
  inputRedactionLevel?: AiJobInputRedactionLevel;
  budgetKey?: string | null;
  createdBy: string;
  actorId?: string | null;
};

export type RunAiJobOk = {
  ok: true;
  job: AiJobRecord;
  content: string;
  guardrails: GuardrailRunResult;
};

export type RunAiJobFailure = {
  ok: false;
  job: AiJobRecord | null;
  errorCode:
    | 'ai_disabled'
    | 'no_active_template'
    | 'no_active_model'
    | 'blocked_budget'
    | 'blocked_guardrail'
    | 'provider_failure'
    | 'internal';
  errorMessage: string;
  budgetCheck?: BudgetCheckResult;
  guardrails?: GuardrailRunResult;
};

export type RunAiJobResult = RunAiJobOk | RunAiJobFailure;

function hashInput(systemPrompt: string, userPrompt: string): string {
  return `sha256:${createHash('sha256').update(`${systemPrompt}\n---\n${userPrompt}`).digest('hex')}`;
}

function persistGuardrailResults(jobId: string, results: GuardrailNamedResult[], actorId: string | null) {
  for (const r of results) {
    recordGuardrailResult({
      jobId,
      ruleName: r.name,
      status: r.status,
      detail: r.detail ?? null,
      actorId
    });
  }
}

export async function runAiJob(params: RunAiJobParams): Promise<RunAiJobResult> {
  if (!isAiEnabled()) {
    return { ok: false, job: null, errorCode: 'ai_disabled', errorMessage: 'AI_ENABLED is not set to true.' };
  }

  // 1. Resolve template
  const template = getActiveTemplate({ name: params.promptTemplateName, version: params.promptTemplateVersion });
  if (!template) {
    return {
      ok: false,
      job: null,
      errorCode: 'no_active_template',
      errorMessage: `No active prompt template named '${params.promptTemplateName}'`
    };
  }

  // 2. Resolve model version
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

  // 3. Redact user prompt before anything else touches it
  const redactionLevel: AiJobInputRedactionLevel = params.inputRedactionLevel ?? 'strict';
  const { redactedText: redactedUserPrompt, counts: redactionCounts } = redact(params.userPrompt, redactionLevel);

  // 4. Cost estimate (uses redacted prompt — that's what's actually billed)
  const pricing = parsePricing(modelVersion.inputPriceJson, modelVersion.outputPriceJson, modelId);
  const estimatedInputTokens = estimateInputTokens(params.systemPrompt, redactedUserPrompt);
  const estimatedCostCents = computeCostCents({
    inputTokens: estimatedInputTokens,
    outputTokens: params.maxOutputTokens,
    pricing
  });

  // 5. Budget check
  const budgetCheck = checkBudgetForJob({
    surface: params.surface,
    jobType: params.jobType,
    leadId: params.leadId,
    estimatedCostCents
  });

  // 6. Create job (input_hash from REDACTED text — audit trail reflects what we actually sent)
  const jobCreate: CreateAiJobParams = {
    leadId: params.leadId,
    jobType: params.jobType,
    surface: params.surface,
    provider: upstreamProvider,
    model: modelId,
    modelVersionId: modelVersion.modelVersionId,
    promptTemplateId: template.templateId,
    promptTemplateVersion: template.version,
    inputHash: hashInput(params.systemPrompt, redactedUserPrompt),
    inputRedactionLevel: redactionLevel,
    budgetKey: params.budgetKey ?? null,
    createdBy: params.createdBy,
    actorId: params.actorId ?? null
  };

  if (!budgetCheck.ok) {
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
  const running = updateAiJobStatus({ jobId: job.jobId, status: 'running', actorId: params.actorId ?? null });

  // 7. Provider call (already retried by getActiveProvider wrapper)
  const callResult = await params.provider.generate({
    modelId,
    systemPrompt: params.systemPrompt,
    userPrompt: redactedUserPrompt,
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

  // 8. Guardrails on output
  const guardrailContext = {
    surface: params.surface,
    jobType: params.jobType,
    requiresGrounding: template.requiresGrounding
  };
  const guardrailRun = runGuardrails(callResult.content, guardrailContext);
  persistGuardrailResults(job.jobId, guardrailRun.results, params.actorId ?? null);

  // 9. Schema validation if template declares output_schema
  let schemaErrors: string[] = [];
  if (template.outputSchema) {
    const validation = validateOutputAgainstSchema(callResult.content, template.outputSchema);
    if (!validation.ok) {
      schemaErrors = validation.errors;
      const status = template.requiresGrounding ? 'block' : 'warn';
      recordGuardrailResult({
        jobId: job.jobId,
        ruleName: 'output_schema_valid',
        status,
        detail: validation.errors.join('; '),
        actorId: params.actorId ?? null
      });
    } else {
      recordGuardrailResult({
        jobId: job.jobId,
        ruleName: 'output_schema_valid',
        status: 'pass',
        detail: null,
        actorId: params.actorId ?? null
      });
    }
  }

  const schemaBlocked = template.outputSchema !== null && schemaErrors.length > 0 && template.requiresGrounding;

  // 10. Decide: block on guardrail or schema?
  if (guardrailRun.blocked || schemaBlocked) {
    const blockingReason = guardrailRun.blocked
      ? `guardrail '${guardrailRun.blockingRule}' blocked output`
      : `output_schema validation failed: ${schemaErrors.join('; ')}`;

    const realCostCents = computeCostCents({
      inputTokens: callResult.inputTokens,
      outputTokens: callResult.outputTokens,
      cachedInputTokens: callResult.cachedInputTokens,
      pricing
    });

    const outputHash = createHash('sha256').update(callResult.content).digest('hex');

    const blocked = updateAiJobStatus({
      jobId: job.jobId,
      status: 'blocked_guardrail',
      outputHash: `sha256:${outputHash}`,
      inputTokens: callResult.inputTokens,
      outputTokens: callResult.outputTokens,
      cachedInputTokens: callResult.cachedInputTokens,
      costCents: realCostCents,
      latencyMs: callResult.latencyMs,
      costBreakdownJson: JSON.stringify({
        pricing,
        redactionCounts,
        guardrailResults: guardrailRun.results,
        schemaErrors,
        providerResponseHash: callResult.rawProviderResponseHash
      }),
      errorMessage: blockingReason,
      actorId: params.actorId ?? null
    });

    return {
      ok: false,
      job: blocked ?? running ?? job,
      errorCode: 'blocked_guardrail',
      errorMessage: blockingReason,
      budgetCheck,
      guardrails: guardrailRun
    };
  }

  // 11. Pass: record real cost and mark succeeded
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
      redactionCounts,
      guardrailResults: guardrailRun.results,
      providerResponseHash: callResult.rawProviderResponseHash,
      estimate: { inputTokens: estimatedInputTokens, costCents: estimatedCostCents }
    }),
    actorId: params.actorId ?? null
  });

  if (!succeeded) {
    return { ok: false, job: running ?? job, errorCode: 'internal', errorMessage: 'Failed to update job to succeeded' };
  }

  return { ok: true, job: succeeded, content: callResult.content, guardrails: guardrailRun };
}

export function discardJob(jobId: string, reason: string) {
  cancelAiJob({ jobId, reason });
}

export function getJobsTable(): string {
  return aiJobsTable;
}

export function _runJobDb() {
  return getDatabase();
}
