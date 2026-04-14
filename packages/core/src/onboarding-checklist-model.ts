export const onboardingChecklistStatuses = ['pending', 'completed'] as const;
export type OnboardingChecklistStatus = (typeof onboardingChecklistStatuses)[number];

export const onboardingChecklistCompletionActors = ['client', 'operator'] as const;
export type OnboardingChecklistCompletionActor = (typeof onboardingChecklistCompletionActors)[number];

export const onboardingChecklistModel = {
  canonicalArtifact: 'packages/core/src/onboarding-checklist-model.ts',
  statuses: onboardingChecklistStatuses,
  fields: ['itemId', 'leadId', 'title', 'description', 'status', 'createdAt', 'completedAt', 'completedBy']
} as const;

export type OnboardingChecklistItem = {
  itemId: string;
  leadId: string;
  title: string;
  description: string | null;
  status: OnboardingChecklistStatus;
  createdAt: string;
  completedAt: string | null;
  completedBy: OnboardingChecklistCompletionActor | null;
};
