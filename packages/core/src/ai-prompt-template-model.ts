export const aiPromptTemplateModel = {
  canonicalArtifact: 'packages/core/src/ai-prompt-template-model.ts',
  fields: [
    'templateId',
    'name',
    'version',
    'purpose',
    'body',
    'outputSchema',
    'requiresGrounding',
    'modelCompatibilityMin',
    'modelCompatibilityMax',
    'allowedSurfaces',
    'active',
    'createdAt',
    'deactivatedAt'
  ] as const,
  objective: 'Versioned prompt definition with output schema, grounding flag, and allowed surfaces.'
} as const;

export type AiPromptTemplateRecord = {
  templateId: string;
  name: string;
  version: string;
  purpose: string;
  body: string;
  outputSchema: string | null;
  requiresGrounding: boolean;
  modelCompatibilityMin: string | null;
  modelCompatibilityMax: string | null;
  allowedSurfaces: string[] | null;
  active: boolean;
  createdAt: string;
  deactivatedAt: string | null;
};
