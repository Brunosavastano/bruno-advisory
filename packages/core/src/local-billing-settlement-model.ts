export const localBillingSettlementStatuses = ['settled_local'] as const;
export type LocalBillingSettlementStatus = (typeof localBillingSettlementStatuses)[number];

export const localBillingSettlementEventTypes = ['settlement_recorded', 'charge_settled'] as const;
export type LocalBillingSettlementEventType = (typeof localBillingSettlementEventTypes)[number];

export const localBillingSettlementModel = {
  canonicalArtifact: 'packages/core/src/local-billing-settlement-model.ts',
  tranche: 'T3',
  cycle: 7,
  objective: 'Canonical first local settlement and settlement-event model for an existing local billing charge.',
  billingChargeCanonSource: 'packages/core/src/local-billing-charge-model.ts',
  billingCanonSource: 'packages/core/src/local-billing-model.ts',
  settlementStatuses: localBillingSettlementStatuses,
  eventTypes: localBillingSettlementEventTypes,
  eligibleChargeStatuses: ['pending_local'] as const,
  resultingChargeStatus: 'settled_local' as const,
  settlementKind: 'manual_local_settlement' as const,
  persistence: {
    settlementTable: 'lead_billing_settlements',
    settlementEventTable: 'lead_billing_settlement_events'
  }
} as const;

export type LocalBillingSettlementRecord = {
  settlementId: string;
  chargeId: string;
  billingRecordId: string;
  leadId: string;
  status: LocalBillingSettlementStatus;
  settlementKind: typeof localBillingSettlementModel.settlementKind;
  currency: string;
  amountCents: number;
  settledAt: string;
  createdAt: string;
};

export type LocalBillingSettlementEventRecord = {
  settlementEventId: string;
  settlementId: string;
  chargeId: string;
  billingRecordId: string;
  leadId: string;
  eventType: LocalBillingSettlementEventType;
  occurredAt: string;
  actor: string;
  note: string | null;
};

export function isLocalBillingSettlementStatus(value: unknown): value is LocalBillingSettlementStatus {
  return typeof value === 'string' && localBillingSettlementStatuses.includes(value as LocalBillingSettlementStatus);
}

export function isLocalBillingSettlementEventType(value: unknown): value is LocalBillingSettlementEventType {
  return typeof value === 'string' && localBillingSettlementEventTypes.includes(value as LocalBillingSettlementEventType);
}
