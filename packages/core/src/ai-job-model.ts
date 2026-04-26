export const aiJobStatuses = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'blocked_budget',
  'blocked_guardrail'
] as const;
export type AiJobStatus = (typeof aiJobStatuses)[number];

export const aiJobInputRedactionLevels = ['none', 'minimal', 'strict'] as const;
export type AiJobInputRedactionLevel = (typeof aiJobInputRedactionLevels)[number];

// Allowed forward transitions for AI job lifecycle. Reverse transitions are not permitted.
// Terminal states (succeeded, failed, cancelled, blocked_budget, blocked_guardrail) reject further changes.
export const aiJobStatusTransitions: Readonly<Record<AiJobStatus, readonly AiJobStatus[]>> = {
  queued: ['running', 'cancelled', 'blocked_budget', 'blocked_guardrail'],
  running: ['succeeded', 'failed', 'cancelled'],
  succeeded: [],
  failed: [],
  cancelled: [],
  blocked_budget: [],
  blocked_guardrail: []
};

export const aiJobModel = {
  canonicalArtifact: 'packages/core/src/ai-job-model.ts',
  statuses: aiJobStatuses,
  defaultStatus: 'queued' as AiJobStatus,
  inputRedactionLevels: aiJobInputRedactionLevels,
  defaultInputRedactionLevel: 'strict' as AiJobInputRedactionLevel,
  fields: [
    'jobId',
    'leadId',
    'jobType',
    'surface',
    'status',
    'provider',
    'model',
    'modelVersionId',
    'promptTemplateId',
    'promptTemplateVersion',
    'inputHash',
    'inputRedactionLevel',
    'outputHash',
    'inputTokens',
    'outputTokens',
    'cachedInputTokens',
    'costCents',
    'latencyMs',
    'budgetKey',
    'costBreakdownJson',
    'createdBy',
    'createdAt',
    'startedAt',
    'completedAt',
    'cancelledAt',
    'cancelReason',
    'errorMessage'
  ] as const,
  objective: 'Audit row for every LLM call: prompts, tokens, cost, latency, hashes, status, decision.'
} as const;

export type AiJobRecord = {
  jobId: string;
  leadId: string | null;
  jobType: string;
  surface: string;
  status: AiJobStatus;
  provider: string;
  model: string;
  modelVersionId: string | null;
  promptTemplateId: string;
  promptTemplateVersion: string;
  inputHash: string;
  inputRedactionLevel: AiJobInputRedactionLevel;
  outputHash: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costCents: number;
  latencyMs: number | null;
  budgetKey: string | null;
  costBreakdownJson: string | null;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  errorMessage: string | null;
};
