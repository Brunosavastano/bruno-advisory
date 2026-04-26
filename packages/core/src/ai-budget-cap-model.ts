export const aiBudgetScopeTypes = ['global', 'surface', 'job_type', 'lead'] as const;
export type AiBudgetScopeType = (typeof aiBudgetScopeTypes)[number];

export const aiBudgetPeriods = ['day', 'month'] as const;
export type AiBudgetPeriod = (typeof aiBudgetPeriods)[number];

export const aiBudgetActionsOnExceed = ['warn', 'block'] as const;
export type AiBudgetActionOnExceed = (typeof aiBudgetActionsOnExceed)[number];

export const aiBudgetCapModel = {
  canonicalArtifact: 'packages/core/src/ai-budget-cap-model.ts',
  scopeTypes: aiBudgetScopeTypes,
  periods: aiBudgetPeriods,
  actionsOnExceed: aiBudgetActionsOnExceed,
  defaultActionOnExceed: 'block' as AiBudgetActionOnExceed,
  fields: [
    'capId',
    'scopeType',
    'scopeValue',
    'period',
    'capCents',
    'actionOnExceed',
    'active',
    'createdAt',
    'updatedAt',
    'deactivatedAt'
  ] as const,
  objective: 'Cost ceiling per scope and period; warn or block before the provider call when projected spend exceeds the cap.'
} as const;

export type AiBudgetCapRecord = {
  capId: string;
  scopeType: AiBudgetScopeType;
  scopeValue: string;
  period: AiBudgetPeriod;
  capCents: number;
  actionOnExceed: AiBudgetActionOnExceed;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  deactivatedAt: string | null;
};
