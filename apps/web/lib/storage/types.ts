import {
  billingEntryTaskStates,
  type BillingEntryEvaluation,
  type CockpitRole,
  type DocumentUploadRecord,
  type DocumentUploadStatus,
  type LocalBillingChargeEventType,
  type LocalBillingChargeStatus,
  type LocalBillingEventType,
  type LocalBillingRecordStatus,
  type LocalBillingSettlementEventType,
  type LocalBillingSettlementStatus,
  type OperatorCommercialStage,
  type RecommendationRecord
} from '@bruno-advisory/core';
import {
  type IntakeAnalyticsEvent,
  type LeadStatus,
  type PublicIntakePayload,
  type SourceChannel
} from '@bruno-advisory/core/intake-contract';

export type LeadFitLevel = 'alto' | 'medio' | 'baixo';

export type StoredLead = {
  leadId: string;
  fullName: string;
  email: string;
  phone: string;
  city?: string;
  state?: string;
  investableAssetsBand: PublicIntakePayload['investableAssetsBand'];
  primaryChallenge: string;
  sourceChannel: SourceChannel;
  sourceLabel: string;
  sourceCampaign?: string;
  sourceMedium?: string;
  sourceContent?: string;
  intakeFormVersion: string;
  privacyConsentAccepted: boolean;
  termsConsentAccepted: boolean;
  status: LeadStatus;
  commercialStage: OperatorCommercialStage;
  statusReason: string | null;
  fitSummary: string | null;
  internalOwner: string | null;
  cidadeEstado: string | null;
  ocupacaoPerfil: string | null;
  nivelDeFit: LeadFitLevel | null;
  motivoSemFit: string | null;
  owner: string | null;
  dataCallQualificacao: string | null;
  resumoCall: string | null;
  interesseNaOferta: LeadFitLevel | null;
  checklistOnboarding: string | null;
  cadenciaAcordada: string | null;
  proximoPasso: string | null;
  riscoDeChurn: LeadFitLevel | null;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  firstCapturedAt: string;
  lastStatusChangedAt: string;
};

export type LeadCrmFieldsUpdate = Partial<{
  cidadeEstado: string | null;
  ocupacaoPerfil: string | null;
  nivelDeFit: LeadFitLevel | null;
  motivoSemFit: string | null;
  owner: string | null;
  dataCallQualificacao: string | null;
  resumoCall: string | null;
  interesseNaOferta: LeadFitLevel | null;
  checklistOnboarding: string | null;
  cadenciaAcordada: string | null;
  proximoPasso: string | null;
  riscoDeChurn: LeadFitLevel | null;
}>;

export type LeadCommercialStageAuditRecord = {
  auditId: string;
  leadId: string;
  fromStage: OperatorCommercialStage | null;
  toStage: OperatorCommercialStage;
  changedAt: string;
  changedBy: string;
  note: string | null;
};

export const leadTaskStatuses = billingEntryTaskStates;
export type LeadTaskStatus = (typeof leadTaskStatuses)[number];

export type LeadBillingReadiness = BillingEntryEvaluation & {
  leadId: string;
};

export type LeadBillingRecord = {
  billingRecordId: string;
  leadId: string;
  status: LocalBillingRecordStatus;
  currency: string;
  entryFeeCents: number;
  monthlyFeeCents: number;
  minimumCommitmentMonths: number;
  activatedAt: string | null;
  createdAt: string;
};

export type LeadBillingEvent = {
  billingEventId: string;
  billingRecordId: string;
  leadId: string;
  eventType: LocalBillingEventType;
  occurredAt: string;
  actor: string;
  note: string | null;
};

export type LeadBillingCharge = {
  chargeId: string;
  billingRecordId: string;
  leadId: string;
  chargeSequence: number;
  chargeKind: string;
  status: LocalBillingChargeStatus;
  currency: string;
  amountCents: number;
  dueDate: string;
  postedAt: string | null;
  createdAt: string;
};

export type LeadBillingChargeEvent = {
  chargeEventId: string;
  chargeId: string;
  billingRecordId: string;
  leadId: string;
  eventType: LocalBillingChargeEventType;
  occurredAt: string;
  actor: string;
  note: string | null;
};

export type LeadBillingSettlement = {
  settlementId: string;
  chargeId: string;
  billingRecordId: string;
  leadId: string;
  status: LocalBillingSettlementStatus;
  settlementKind: string;
  currency: string;
  amountCents: number;
  settledAt: string;
  createdAt: string;
};

export type LeadBillingSettlementEvent = {
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

export type LeadBillingOverviewRow = {
  leadId: string;
  fullName: string;
  email: string;
  commercialStage: OperatorCommercialStage;
  billingRecordId: string;
  billingRecordStatus: LocalBillingRecordStatus;
  latestChargeId: string | null;
  latestChargeSequence: number | null;
  latestChargeStatus: LocalBillingChargeStatus | null;
  latestChargeDueDate: string | null;
  latestSettlementStatus: LocalBillingSettlementStatus | null;
  latestSettlementAt: string | null;
  pendingChargeCount: number;
  hasOutstandingCharges: boolean;
};

export type LeadInternalNote = {
  noteId: string;
  leadId: string;
  content: string;
  authorMarker: string;
  createdAt: string;
};

export type LeadInternalTask = {
  taskId: string;
  leadId: string;
  title: string;
  status: LeadTaskStatus;
  dueDate: string | null;
  createdAt: string;
};

export type LeadInternalTaskAuditRecord = {
  auditId: string;
  leadId: string;
  taskId: string;
  fromStatus: LeadTaskStatus | null;
  toStatus: LeadTaskStatus;
  changedAt: string;
  changedBy: string;
};

export type IntakeEventRecord = {
  eventId?: string;
  eventName: IntakeAnalyticsEvent;
  occurredAt: string;
  metadata?: Record<string, string | number | boolean | null>;
  relatedLeadId?: string | null;
};

export type PortalInviteCode = {
  inviteId: string;
  codePreview: string;
  codeHash: string;
  createdAt: string;
  createdBy: string;
  revokedAt: string | null;
  revokedBy: string | null;
};

export type PortalSession = {
  sessionId: string;
  inviteId: string;
  sessionTokenHash: string;
  createdAt: string;
  revokedAt: string | null;
  lastSeenAt: string;
};

export type LeadOnboardingChecklistItem = {
  itemId: string;
  leadId: string;
  title: string;
  createdAt: string;
  completedAt: string | null;
  completedBy: string | null;
};

export type LeadDocumentRecord = DocumentUploadRecord;
export type LeadDocumentStatus = DocumentUploadStatus;

export type LeadPortalUpload = {
  uploadId: string;
  leadId: string;
  filename: string;
  storedPath: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  status: string;
};

export type LeadRecommendationRecord = RecommendationRecord;

export type LeadPendingFlagCode = 'pending_document' | 'pending_call' | 'pending_payment';

export type LeadPendingFlagRecord = {
  flagId: string;
  leadId: string;
  flagCode: LeadPendingFlagCode;
  status: 'active' | 'removed';
  createdAt: string;
  createdBy: string;
  removedAt: string | null;
  removedBy: string | null;
};

export type LeadPendingFlagOverviewRow = {
  leadId: string;
  fullName: string;
  commercialStage: StoredLead['commercialStage'];
  activeFlags: LeadPendingFlagCode[];
  activeFlagCount: number;
};

export type ReviewQueueItem = {
  type: 'memo' | 'research_workflow';
  id: string;
  leadId: string;
  leadName: string;
  title: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type AuditActorType = 'operator' | 'client' | 'system';

export type AuditLogEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  leadId: string | null;
  actorType: AuditActorType;
  actorId: string | null;
  detail: Record<string, unknown> | null;
  createdAt: string;
};

export type CockpitUser = {
  userId: string;
  email: string;
  displayName: string;
  role: CockpitRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CockpitUserWithHash = CockpitUser & {
  passwordHash: string;
};

export type CockpitSession = {
  sessionId: string;
  userId: string;
  sessionToken: string;
  createdAt: string;
  expiresAt: string;
};

export type CockpitSessionLookupRow = CockpitSession & {
  email: string;
  displayName: string;
  role: CockpitRole;
  isActive: boolean;
};
