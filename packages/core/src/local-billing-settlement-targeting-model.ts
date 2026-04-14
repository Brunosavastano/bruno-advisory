export const localBillingSettlementTargetingModel = {
  canonicalArtifact: 'packages/core/src/local-billing-settlement-targeting-model.ts',
  tranche: 'T3',
  cycle: 9,
  objective: 'Canonical charge-targeted local settlement rule for recurring billing history with explicit chargeId control.',
  billingSettlementCanonSource: 'packages/core/src/local-billing-settlement-model.ts',
  billingChargeCanonSource: 'packages/core/src/local-billing-charge-model.ts',
  requiredBillingRecordStatus: 'active_local' as const,
  targetKey: 'chargeId' as const,
  requiredChargeStatus: 'pending_local' as const,
  blockedChargeStatus: 'settled_local' as const,
  explicitOwnershipCheck: true,
  explicitSettlementControlSurface: 'lead-detail charge row action by chargeId'
} as const;
