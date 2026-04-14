import {
  createChecklistItem,
  completeChecklistItem,
  listChecklistItems
} from './checklist';

export function listLeadOnboardingChecklist(leadId: string) {
  return listChecklistItems(leadId);
}

export function createLeadOnboardingChecklistItem(params: { leadId: string; title: string; description?: string | null }) {
  return createChecklistItem(params.leadId, params.title, params.description ?? null);
}

export function completeLeadOnboardingChecklistItem(params: {
  leadId: string;
  itemId: string;
  completedBy: 'client' | 'operator';
}) {
  const item = completeChecklistItem(params.itemId, params.leadId, params.completedBy);
  if (!item) {
    return { ok: false as const, code: 'ITEM_NOT_OWNED_BY_LEAD' };
  }

  return { ok: true as const, item };
}
