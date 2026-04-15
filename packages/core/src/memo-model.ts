export const memoStatuses = ['draft', 'pending_review', 'approved', 'rejected', 'published'] as const;
export type MemoStatus = (typeof memoStatuses)[number];

export const memoModel = {
  canonicalArtifact: 'packages/core/src/memo-model.ts',
  statuses: memoStatuses,
  defaultStatus: 'draft' as MemoStatus,
  fields: ['id', 'leadId', 'researchWorkflowId', 'title', 'body', 'status', 'reviewRejectionReason', 'reviewedAt', 'createdAt', 'updatedAt'] as const,
  objective: 'Manual-first memo container without AI generation.'
} as const;

export type MemoRecord = {
  id: string;
  leadId: string;
  researchWorkflowId: string | null;
  title: string;
  body: string;
  status: MemoStatus;
  reviewRejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
