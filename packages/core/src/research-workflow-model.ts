export const researchWorkflowStatuses = ['draft', 'in_progress', 'review', 'approved', 'rejected', 'delivered'] as const;
export type ResearchWorkflowStatus = (typeof researchWorkflowStatuses)[number];

export const researchWorkflowModel = {
  canonicalArtifact: 'packages/core/src/research-workflow-model.ts',
  statuses: researchWorkflowStatuses,
  defaultStatus: 'draft' as ResearchWorkflowStatus,
  fields: ['id', 'leadId', 'title', 'topic', 'status', 'reviewRejectionReason', 'reviewedAt', 'createdAt', 'updatedAt'] as const,
  objective: 'Manual-first research workflow container without AI integration.'
} as const;

export type ResearchWorkflowRecord = {
  id: string;
  leadId: string;
  title: string;
  topic: string;
  status: ResearchWorkflowStatus;
  reviewRejectionReason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
