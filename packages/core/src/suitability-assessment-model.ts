import type { ClientRiskProfile } from './client-profile-model';
import type { SuitabilitySectionKey } from './cvm-30-references';

// Snapshot versionado e auditável do questionário de suitability respondido
// por, ou em nome de, um lead/cliente.
//
// Regras de domínio:
// - draft: respostas editáveis;
// - submitted/review_required: respostas congeladas, salvo fluxo explícito de
//   clarificação;
// - approved/expired/superseded: imutáveis;
// - nova alteração material deve criar novo assessment e superseder o anterior.

export const suitabilityAssessmentStatuses = [
  'draft',
  'submitted',
  'needs_clarification',
  'review_required',
  'approved',
  'expired',
  'superseded'
] as const;
export type SuitabilityAssessmentStatus = (typeof suitabilityAssessmentStatuses)[number];

export const suitabilityAssessmentTransitions: Readonly<
  Record<SuitabilityAssessmentStatus, readonly SuitabilityAssessmentStatus[]>
> = {
  draft: ['submitted'],
  submitted: ['needs_clarification', 'review_required', 'approved', 'superseded'],
  needs_clarification: ['submitted', 'superseded'],
  review_required: ['needs_clarification', 'approved', 'superseded'],
  approved: ['expired', 'superseded'],
  expired: ['superseded'],
  superseded: []
};

export const questionnaireSections: readonly SuitabilitySectionKey[] = [
  'objectives',
  'financial_situation',
  'knowledge_experience',
  'liquidity_needs',
  'restrictions'
] as const;

export const suitabilityAssessmentActorRoles = ['client', 'consultant', 'system', 'admin'] as const;
export type SuitabilityAssessmentActorRole = (typeof suitabilityAssessmentActorRoles)[number];

export const suitabilityAssessmentModel = {
  canonicalArtifact: 'packages/core/src/suitability-assessment-model.ts',
  statuses: suitabilityAssessmentStatuses,
  defaultStatus: 'draft' as SuitabilityAssessmentStatus,
  transitions: suitabilityAssessmentTransitions,
  sections: questionnaireSections,
  fields: [
    'assessmentId',
    'leadId',
    'questionnaireVersion',
    'scoringCalibrationVersion',
    'status',
    'objectivesJson',
    'financialSituationJson',
    'knowledgeExperienceJson',
    'liquidityNeedsJson',
    'restrictionsJson',
    'answersHash',
    'score',
    'computedRiskProfile',
    'cappedRiskProfile',
    'approvedRiskProfile',
    'breakdownJson',
    'constraintsJson',
    'reviewFlagsJson',
    'capsAppliedJson',
    'aiSummaryArtifactId',
    'submittedAt',
    'submittedBy',
    'submittedByRole',
    'computedAt',
    'reviewedAt',
    'approvedAt',
    'approvedBy',
    'approvalNotes',
    'overrideReason',
    'clarificationRequestsJson',
    'expiresAt',
    'supersededByAssessmentId',
    'supersededAt',
    'createdAt',
    'updatedAt'
  ] as const,
  invariants: [
    'approved exige approvedRiskProfile, approvedBy, approvedAt e expiresAt',
    'approvedRiskProfile diferente de cappedRiskProfile exige overrideReason',
    'answersHash deve mudar quando qualquer resposta bruta mudar',
    'approved/expired/superseded são estados imutáveis para respostas brutas'
  ] as const,
  objective:
    'Snapshot versionado do questionário de suitability — entradas brutas por seção, score determinístico, caps prudenciais, flags de revisão, restrições, decisão humana e trilha de auditoria.'
} as const;

export type SuitabilityAssessmentRecord = {
  assessmentId: string;
  leadId: string;
  questionnaireVersion: string;
  scoringCalibrationVersion: string | null;
  status: SuitabilityAssessmentStatus;
  objectivesJson: string;
  financialSituationJson: string;
  knowledgeExperienceJson: string;
  liquidityNeedsJson: string;
  restrictionsJson: string;
  answersHash: string | null;
  score: number | null;
  computedRiskProfile: ClientRiskProfile | null;
  cappedRiskProfile: ClientRiskProfile | null;
  approvedRiskProfile: ClientRiskProfile | null;
  breakdownJson: string | null;
  constraintsJson: string | null;
  reviewFlagsJson: string | null;
  capsAppliedJson: string | null;
  aiSummaryArtifactId: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  submittedByRole: SuitabilityAssessmentActorRole | null;
  computedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  approvalNotes: string | null;
  overrideReason: string | null;
  clarificationRequestsJson: string | null;
  expiresAt: string | null;
  supersededByAssessmentId: string | null;
  supersededAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function canTransitionSuitabilityAssessmentStatus(
  from: SuitabilityAssessmentStatus,
  to: SuitabilityAssessmentStatus
): boolean {
  return suitabilityAssessmentTransitions[from].includes(to);
}

export function areSuitabilityAssessmentAnswersMutable(status: SuitabilityAssessmentStatus): boolean {
  return status === 'draft' || status === 'needs_clarification';
}

export function requiresHumanReviewBeforeApproval(
  assessment: Pick<
    SuitabilityAssessmentRecord,
    'computedRiskProfile' | 'cappedRiskProfile' | 'reviewFlagsJson' | 'capsAppliedJson'
  >
): boolean {
  if (!assessment.computedRiskProfile || !assessment.cappedRiskProfile) {
    return true;
  }

  if (assessment.computedRiskProfile !== assessment.cappedRiskProfile) {
    return true;
  }

  return Boolean(assessment.reviewFlagsJson || assessment.capsAppliedJson);
}
