export const aiArtifactStatuses = ['draft', 'pending_review', 'approved', 'rejected', 'archived'] as const;
export type AiArtifactStatus = (typeof aiArtifactStatuses)[number];

export const aiArtifactStatusTransitions: Readonly<Record<AiArtifactStatus, readonly AiArtifactStatus[]>> = {
  draft: ['pending_review', 'archived'],
  pending_review: ['approved', 'rejected', 'archived'],
  approved: ['archived'],
  rejected: ['archived'],
  archived: []
};

export const aiArtifactModel = {
  canonicalArtifact: 'packages/core/src/ai-artifact-model.ts',
  statuses: aiArtifactStatuses,
  defaultStatus: 'draft' as AiArtifactStatus,
  fields: [
    'artifactId',
    'jobId',
    'leadId',
    'artifactType',
    'title',
    'body',
    'jsonPayload',
    'requiresGrounding',
    'status',
    'createdAt',
    'reviewedBy',
    'reviewedAt',
    'rejectionReason',
    'archivedAt'
  ] as const,
  objective: 'Persisted output of an AI job, with review state and grounding flag for client-facing surfaces.'
} as const;

export type AiArtifactRecord = {
  artifactId: string;
  jobId: string;
  leadId: string | null;
  artifactType: string;
  title: string;
  body: string;
  jsonPayload: string | null;
  requiresGrounding: boolean;
  status: AiArtifactStatus;
  createdAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  archivedAt: string | null;
};
