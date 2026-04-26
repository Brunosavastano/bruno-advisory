export const aiEvalCaseModel = {
  canonicalArtifact: 'packages/core/src/ai-eval-case-model.ts',
  fields: [
    'caseId',
    'surface',
    'name',
    'inputJson',
    'expectedConstraintsJson',
    'active',
    'createdAt',
    'deactivatedAt'
  ] as const,
  objective: 'Golden-set case used to compare model versions before promoting a candidate.'
} as const;

export type AiEvalCaseRecord = {
  caseId: string;
  surface: string;
  name: string;
  inputJson: string;
  expectedConstraintsJson: string;
  active: boolean;
  createdAt: string;
  deactivatedAt: string | null;
};
