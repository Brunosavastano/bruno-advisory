export const localBillingOverviewModel = {
  canonicalArtifact: 'packages/core/src/local-billing-overview-model.ts',
  tranche: 'T3',
  cycle: 10,
  objective: 'Canonical cross-lead local billing operations overview for truthful cockpit observability.',
  billingCanonSources: [
    'packages/core/src/local-billing-model.ts',
    'packages/core/src/local-billing-charge-model.ts',
    'packages/core/src/local-billing-settlement-model.ts',
    'packages/core/src/local-billing-settlement-targeting-model.ts'
  ] as const,
  cockpitSurface: '/cockpit/billing',
  overviewColumns: [
    'leadId',
    'fullName',
    'commercialStage',
    'billingRecordStatus',
    'latestChargeSequence',
    'latestChargeStatus',
    'latestChargeDueDate',
    'latestSettlementStatus',
    'latestSettlementAt',
    'pendingChargeCount',
    'hasOutstandingCharges'
  ] as const,
  noBillingYetMessage: 'Nenhum estado de billing local persistido ainda.'
} as const;
