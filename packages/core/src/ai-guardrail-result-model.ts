export const aiGuardrailResultStatuses = ['pass', 'warn', 'block'] as const;
export type AiGuardrailResultStatus = (typeof aiGuardrailResultStatuses)[number];

export const aiGuardrailResultModel = {
  canonicalArtifact: 'packages/core/src/ai-guardrail-result-model.ts',
  statuses: aiGuardrailResultStatuses,
  fields: ['resultId', 'jobId', 'ruleName', 'status', 'detail', 'createdAt'] as const,
  objective: 'Append-only outcome of one guardrail rule against one AI job (pass / warn / block).'
} as const;

export type AiGuardrailResultRecord = {
  resultId: string;
  jobId: string;
  ruleName: string;
  status: AiGuardrailResultStatus;
  detail: string | null;
  createdAt: string;
};

export type AiGuardrailResultSummary = {
  passed: number;
  warned: number;
  blocked: number;
};
