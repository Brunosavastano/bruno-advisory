export const localBillingChargeStatuses = ['pending_local', 'settled_local'] as const;
export type LocalBillingChargeStatus = (typeof localBillingChargeStatuses)[number];

export const localBillingChargeEventTypes = ['charge_created', 'charge_posted', 'charge_settled'] as const;
export type LocalBillingChargeEventType = (typeof localBillingChargeEventTypes)[number];

export const localBillingChargeModel = {
  canonicalArtifact: 'packages/core/src/local-billing-charge-model.ts',
  tranche: 'T3',
  cycle: 6,
  objective: 'Canonical first recurring local charge and charge-event model tied to an active local billing record.',
  billingCanonSource: 'packages/core/src/local-billing-model.ts',
  pricingCanonSource: 'docs/t1-commercial-foundation.md',
  firstChargeKind: 'monthly_recurring',
  firstChargeSequence: 1,
  initialChargeStatus: 'pending_local' as LocalBillingChargeStatus,
  chargeStatuses: localBillingChargeStatuses,
  eventTypes: localBillingChargeEventTypes
} as const;

export function isLocalBillingChargeStatus(value: unknown): value is LocalBillingChargeStatus {
  return typeof value === 'string' && localBillingChargeStatuses.includes(value as LocalBillingChargeStatus);
}

export function isLocalBillingChargeEventType(value: unknown): value is LocalBillingChargeEventType {
  return typeof value === 'string' && localBillingChargeEventTypes.includes(value as LocalBillingChargeEventType);
}
