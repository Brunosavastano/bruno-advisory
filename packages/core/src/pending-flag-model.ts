export const pendingFlagTypes = [
  'pending_document',
  'pending_call',
  'pending_payment',
  'pending_contract',
  'pending_other'
] as const;

export type PendingFlagType = (typeof pendingFlagTypes)[number];

export const pendingFlagModel = {
  canonicalArtifact: 'packages/core/src/pending-flag-model.ts',
  tableName: 'lead_pending_flags',
  activeUniqueness: 'Only one active flag per flagType per lead where clearedAt is null.',
  types: pendingFlagTypes,
  fields: ['flagId', 'leadId', 'flagType', 'note', 'setAt', 'setBy', 'clearedAt', 'clearedBy']
} as const;

export type PendingFlagRecord = {
  flagId: string;
  leadId: string;
  flagType: PendingFlagType;
  note: string | null;
  setAt: string;
  setBy: string;
  clearedAt: string | null;
  clearedBy: string | null;
};
