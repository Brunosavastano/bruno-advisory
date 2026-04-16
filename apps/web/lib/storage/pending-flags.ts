import { pendingFlagTypes, type PendingFlagType } from '@savastano-advisory/core';
import { clearFlag, listActiveFlags, listAllLeadsWithActiveFlags, setFlag } from './flags';

function toFlagType(value: string): PendingFlagType | null {
  return pendingFlagTypes.includes(value as PendingFlagType) ? (value as PendingFlagType) : null;
}

export function listLeadPendingFlags(leadId: string, status: 'all' | 'active' = 'active') {
  void status;
  return listActiveFlags(leadId).map((flag) => ({
    flagId: flag.flagId,
    leadId: flag.leadId,
    flagCode: flag.flagType,
    status: 'active' as const,
    createdAt: flag.setAt,
    createdBy: flag.setBy,
    removedAt: flag.clearedAt,
    removedBy: flag.clearedBy
  }));
}

export function createLeadPendingFlag(leadId: string, flagCode: string, createdBy: string) {
  const flagType = toFlagType(flagCode);
  if (!flagType) {
    return null;
  }

  const flag = setFlag(leadId, flagType, createdBy);
  if (!flag) {
    return null;
  }

  return {
    flagId: flag.flagId,
    leadId: flag.leadId,
    flagCode: flag.flagType,
    status: 'active' as const,
    createdAt: flag.setAt,
    createdBy: flag.setBy,
    removedAt: flag.clearedAt,
    removedBy: flag.clearedBy
  };
}

export function removeLeadPendingFlag(flagId: string, leadId: string, removedBy: string) {
  const activeFlags = listActiveFlags(leadId);
  const match = activeFlags.find((flag) => flag.flagId === flagId);
  if (!match) {
    return null;
  }

  const cleared = clearFlag(leadId, match.flagType, removedBy);
  if (!cleared) {
    return null;
  }

  return {
    flagId: cleared.flagId,
    leadId: cleared.leadId,
    flagCode: cleared.flagType,
    status: 'removed' as const,
    createdAt: cleared.setAt,
    createdBy: cleared.setBy,
    removedAt: cleared.clearedAt,
    removedBy: cleared.clearedBy
  };
}

export function listPendingFlagOverviewRows() {
  return listAllLeadsWithActiveFlags().map((lead) => ({
    leadId: lead.leadId,
    fullName: lead.fullName,
    commercialStage: 'qualificacao' as const,
    activeFlags: lead.flags.map((flag) => flag.flagType),
    activeFlagCount: lead.flags.length
  }));
}
