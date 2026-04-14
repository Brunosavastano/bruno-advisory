export const localBillingChargeProgressionModel = {
  canonicalArtifact: 'packages/core/src/local-billing-charge-progression-model.ts',
  tranche: 'T3',
  cycle: 8,
  objective: 'Canonical next recurring local charge progression rule after a prior recurring charge is settled.',
  billingChargeCanonSource: 'packages/core/src/local-billing-charge-model.ts',
  billingSettlementCanonSource: 'packages/core/src/local-billing-settlement-model.ts',
  requiredBillingRecordStatus: 'active_local' as const,
  requiredPriorChargeStatus: 'settled_local' as const,
  blockedPendingChargeStatus: 'pending_local' as const,
  nextChargeKind: 'monthly_recurring' as const,
  dueDateRule: 'next recurring charge due date = prior recurring charge due date + 1 calendar month',
  eventTrail: ['charge_created', 'charge_posted'] as const
} as const;
