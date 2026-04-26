export const aiModelVersionStatuses = ['candidate', 'active', 'deprecated', 'blocked'] as const;
export type AiModelVersionStatus = (typeof aiModelVersionStatuses)[number];

// Forward-only lifecycle. `blocked` is terminal; `deprecated` is terminal except for archival.
// To roll forward to a new version, register a new `candidate` and promote it to `active`.
export const aiModelVersionStatusTransitions: Readonly<Record<AiModelVersionStatus, readonly AiModelVersionStatus[]>> = {
  candidate: ['active', 'blocked'],
  active: ['deprecated', 'blocked'],
  deprecated: ['blocked'],
  blocked: []
};

export const aiModelVersionModel = {
  canonicalArtifact: 'packages/core/src/ai-model-version-model.ts',
  statuses: aiModelVersionStatuses,
  defaultStatus: 'candidate' as AiModelVersionStatus,
  fields: [
    'modelVersionId',
    'provider',
    'modelId',
    'displayName',
    'status',
    'inputPriceJson',
    'outputPriceJson',
    'pinnedAt',
    'deprecatedAt',
    'blockedAt',
    'notes',
    'createdAt',
    'updatedAt'
  ] as const,
  objective: 'Pinned provider/model identifier with status lifecycle, prices, and golden-set linkage.'
} as const;

export type AiModelVersionRecord = {
  modelVersionId: string;
  provider: string;
  modelId: string;
  displayName: string;
  status: AiModelVersionStatus;
  inputPriceJson: string | null;
  outputPriceJson: string | null;
  pinnedAt: string | null;
  deprecatedAt: string | null;
  blockedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
