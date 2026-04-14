export const localBillingRecordStatuses = ['draft_local', 'active_local'] as const;
export type LocalBillingRecordStatus = (typeof localBillingRecordStatuses)[number];

export const localBillingEventTypes = ['billing_record_created', 'billing_record_activated'] as const;
export type LocalBillingEventType = (typeof localBillingEventTypes)[number];

export const localBillingModel = {
  canonicalArtifact: 'packages/core/src/local-billing-model.ts',
  tranche: 'T3',
  cycle: 5,
  objective: 'Canonical local billing record and billing event model gated by billing-readiness.',
  pricingCanonSource: 'docs/t1-commercial-foundation.md',
  pricingDefaults: {
    currency: 'BRL',
    entryFeeCents: 950000,
    monthlyFeeCents: 350000,
    minimumCommitmentMonths: 6
  },
  initialRecordStatus: 'active_local' as LocalBillingRecordStatus,
  recordStatuses: localBillingRecordStatuses,
  eventTypes: localBillingEventTypes
} as const;

export function isLocalBillingRecordStatus(value: unknown): value is LocalBillingRecordStatus {
  return typeof value === 'string' && localBillingRecordStatuses.includes(value as LocalBillingRecordStatus);
}

export function isLocalBillingEventType(value: unknown): value is LocalBillingEventType {
  return typeof value === 'string' && localBillingEventTypes.includes(value as LocalBillingEventType);
}
