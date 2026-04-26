export const aiEvalRunStatuses = ['pass', 'warn', 'fail'] as const;
export type AiEvalRunStatus = (typeof aiEvalRunStatuses)[number];

export const aiEvalRunModel = {
  canonicalArtifact: 'packages/core/src/ai-eval-run-model.ts',
  statuses: aiEvalRunStatuses,
  fields: [
    'runId',
    'modelVersionId',
    'promptTemplateId',
    'caseId',
    'status',
    'metricsJson',
    'outputJson',
    'createdAt'
  ] as const,
  objective: 'Append-only result of running one eval case against one model_version + prompt_template pair.'
} as const;

export type AiEvalRunRecord = {
  runId: string;
  modelVersionId: string;
  promptTemplateId: string;
  caseId: string;
  status: AiEvalRunStatus;
  metricsJson: string | null;
  outputJson: string | null;
  createdAt: string;
};
