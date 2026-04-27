// Estado vigente do perfil de adequação de um lead/cliente. Este registro
// guarda apenas o snapshot operacional atual. O histórico completo e imutável
// permanece em suitability_assessments.
//
// Design intencional:
// - computedRiskProfile: resultado do algoritmo de scoring;
// - approvedRiskProfile: perfil aprovado pelo consultor responsável;
// - riskProfile: perfil vigente usado pelos gates de recomendação, normalmente
//   igual ao approvedRiskProfile.

export const clientProfileStatuses = ['none', 'active', 'expired', 'superseded'] as const;
export type ClientProfileStatus = (typeof clientProfileStatuses)[number];

export const clientTypes = ['individual', 'legal_entity'] as const;
export type ClientType = (typeof clientTypes)[number];

export const investorCategories = ['retail', 'qualified', 'professional'] as const;
export type InvestorCategory = (typeof investorCategories)[number];

export const clientRiskProfiles = [
  'conservador',
  'moderado_conservador',
  'moderado',
  'moderado_arrojado',
  'arrojado'
] as const;
export type ClientRiskProfile = (typeof clientRiskProfiles)[number];

// Mantém compatibilidade com os imports existentes do projeto.
export const riskProfiles = clientRiskProfiles;
export type RiskProfile = ClientRiskProfile;

export const clientProfileSources = [
  'self_declared',
  'algorithmic_scoring',
  'consultant_approved',
  'manual_override',
  'imported'
] as const;
export type ClientProfileSource = (typeof clientProfileSources)[number];

export const clientProfileModel = {
  canonicalArtifact: 'packages/core/src/client-profile-model.ts',
  statuses: clientProfileStatuses,
  defaultStatus: 'none' as ClientProfileStatus,
  clientTypes,
  investorCategories,
  riskProfiles: clientRiskProfiles,
  profileSources: clientProfileSources,
  fields: [
    'clientProfileId',
    'leadId',
    'clientType',
    'investorCategory',
    'status',
    'currentAssessmentId',
    'computedRiskProfile',
    'approvedRiskProfile',
    'riskProfile',
    'validFrom',
    'validUntil',
    'lastReviewedAt',
    'nextReviewDueAt',
    'profileSource',
    'qualifiedInvestorAttestationArtifactId',
    'professionalInvestorAttestationArtifactId',
    'overrideReason',
    'createdAt',
    'updatedAt'
  ] as const,
  invariants: [
    'status=active exige currentAssessmentId, riskProfile, validFrom e validUntil',
    'status=expired não permite nova recomendação personalizada',
    'status=none não permite nova recomendação personalizada',
    'riskProfile deve refletir o approvedRiskProfile salvo override documentado'
  ] as const,
  objective:
    'Perfil de adequação vigente do cliente (Resolução CVM 30/2021): aponta a suitability_assessment aprovada, validade operacional, categoria de investidor e perfil de risco usado pelos gates de recomendação.'
} as const;

export type ClientProfileRecord = {
  clientProfileId: string;
  leadId: string;
  clientType: ClientType;
  investorCategory: InvestorCategory;
  status: ClientProfileStatus;
  currentAssessmentId: string | null;
  computedRiskProfile: ClientRiskProfile | null;
  approvedRiskProfile: ClientRiskProfile | null;
  riskProfile: ClientRiskProfile | null;
  validFrom: string | null;
  validUntil: string | null;
  lastReviewedAt: string | null;
  nextReviewDueAt: string | null;
  profileSource: ClientProfileSource;
  qualifiedInvestorAttestationArtifactId: string | null;
  professionalInvestorAttestationArtifactId: string | null;
  overrideReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientProfileRecommendationEligibility = {
  readonly ok: boolean;
  readonly reasons: readonly string[];
};

export function isClientProfileActiveForRecommendation(
  profile: Pick<
    ClientProfileRecord,
    'status' | 'currentAssessmentId' | 'riskProfile' | 'validUntil'
  >,
  nowIso = new Date().toISOString()
): ClientProfileRecommendationEligibility {
  const reasons: string[] = [];

  if (profile.status !== 'active') {
    reasons.push(`client_profile_status_is_${profile.status}`);
  }

  if (!profile.currentAssessmentId) {
    reasons.push('missing_current_assessment_id');
  }

  if (!profile.riskProfile) {
    reasons.push('missing_risk_profile');
  }

  if (!profile.validUntil) {
    reasons.push('missing_valid_until');
  } else {
    const validUntilTime = Date.parse(profile.validUntil);
    const nowTime = Date.parse(nowIso);

    if (!Number.isFinite(validUntilTime)) {
      reasons.push('invalid_valid_until');
    } else if (Number.isFinite(nowTime) && validUntilTime < nowTime) {
      reasons.push('profile_expired');
    }
  }

  return {
    ok: reasons.length === 0,
    reasons
  };
}
