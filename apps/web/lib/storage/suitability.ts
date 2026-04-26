import { createHash, randomUUID } from 'node:crypto';
import {
  canTransitionSuitabilityAssessmentStatus,
  clientProfileStatuses,
  clientProfileSources,
  clientRiskProfiles,
  clientTypes,
  investorCategories,
  requiresHumanReviewBeforeApproval,
  scoreSuitability,
  suitabilityAssessmentActorRoles,
  suitabilityScoringCalibrationVersion,
  suitabilityQuestionnaireVersion,
  type ClientProfileRecord,
  type ClientProfileSource,
  type ClientProfileStatus,
  type ClientRiskProfile,
  type ClientType,
  type InvestorCategory,
  type SuitabilityAnswers,
  type SuitabilityAssessmentActorRole,
  type SuitabilityAssessmentRecord,
  type SuitabilityAssessmentStatus,
  type SuitabilitySectionKey
} from '@savastano-advisory/core';
import { writeAuditLog } from './audit-log';
import {
  clientProfilesTable,
  getDatabase,
  leadsTable,
  suitabilityAssessmentsTable
} from './db';

// AI-3 Cycle 1 (ampliado) — storage helpers de suitability alinhados ao
// shape canônico revisado por Bruno: caps prudenciais, review flags,
// constraints, override consciente, lifecycle completo. Cycle 1 implementa
// draft → (submitted | review_required) → approved. As demais transições
// (needs_clarification, expired, superseded) ficam reservadas para Cycle 2,
// mas o schema e os models já as suportam.

const ASSESSMENT_SELECT_COLUMNS = `
  assessment_id AS assessmentId,
  lead_id AS leadId,
  questionnaire_version AS questionnaireVersion,
  scoring_calibration_version AS scoringCalibrationVersion,
  status,
  objectives_json AS objectivesJson,
  financial_situation_json AS financialSituationJson,
  knowledge_experience_json AS knowledgeExperienceJson,
  liquidity_needs_json AS liquidityNeedsJson,
  restrictions_json AS restrictionsJson,
  answers_hash AS answersHash,
  score,
  computed_risk_profile AS computedRiskProfile,
  capped_risk_profile AS cappedRiskProfile,
  approved_risk_profile AS approvedRiskProfile,
  breakdown_json AS breakdownJson,
  constraints_json AS constraintsJson,
  review_flags_json AS reviewFlagsJson,
  caps_applied_json AS capsAppliedJson,
  ai_summary_artifact_id AS aiSummaryArtifactId,
  submitted_at AS submittedAt,
  submitted_by AS submittedBy,
  submitted_by_role AS submittedByRole,
  computed_at AS computedAt,
  reviewed_at AS reviewedAt,
  approved_at AS approvedAt,
  approved_by AS approvedBy,
  approval_notes AS approvalNotes,
  override_reason AS overrideReason,
  clarification_requests_json AS clarificationRequestsJson,
  expires_at AS expiresAt,
  superseded_by_assessment_id AS supersededByAssessmentId,
  superseded_at AS supersededAt,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

const PROFILE_SELECT_COLUMNS = `
  client_profile_id AS clientProfileId,
  lead_id AS leadId,
  client_type AS clientType,
  investor_category AS investorCategory,
  status,
  current_assessment_id AS currentAssessmentId,
  computed_risk_profile AS computedRiskProfile,
  approved_risk_profile AS approvedRiskProfile,
  risk_profile AS riskProfile,
  valid_from AS validFrom,
  valid_until AS validUntil,
  last_reviewed_at AS lastReviewedAt,
  next_review_due_at AS nextReviewDueAt,
  profile_source AS profileSource,
  qualified_investor_attestation_artifact_id AS qualifiedInvestorAttestationArtifactId,
  professional_investor_attestation_artifact_id AS professionalInvestorAttestationArtifactId,
  override_reason AS overrideReason,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

function leadExists(leadId: string): boolean {
  const db = getDatabase();
  return Boolean(
    db.prepare(`SELECT lead_id FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`).get(leadId)
  );
}

function nullableRiskProfile(value: unknown): ClientRiskProfile | null {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value);
  return clientRiskProfiles.includes(text as ClientRiskProfile) ? (text as ClientRiskProfile) : null;
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function normalizeAssessmentRow(row: Record<string, unknown>): SuitabilityAssessmentRecord {
  const status = String(row.status) as SuitabilityAssessmentStatus;

  const submittedByRoleRaw = row.submittedByRole === null ? null : String(row.submittedByRole);
  const submittedByRole = submittedByRoleRaw && suitabilityAssessmentActorRoles.includes(submittedByRoleRaw as SuitabilityAssessmentActorRole)
    ? (submittedByRoleRaw as SuitabilityAssessmentActorRole)
    : null;

  return {
    assessmentId: String(row.assessmentId),
    leadId: String(row.leadId),
    questionnaireVersion: String(row.questionnaireVersion),
    scoringCalibrationVersion: nullableString(row.scoringCalibrationVersion),
    status,
    objectivesJson: String(row.objectivesJson),
    financialSituationJson: String(row.financialSituationJson),
    knowledgeExperienceJson: String(row.knowledgeExperienceJson),
    liquidityNeedsJson: String(row.liquidityNeedsJson),
    restrictionsJson: String(row.restrictionsJson),
    answersHash: nullableString(row.answersHash),
    score: nullableNumber(row.score),
    computedRiskProfile: nullableRiskProfile(row.computedRiskProfile),
    cappedRiskProfile: nullableRiskProfile(row.cappedRiskProfile),
    approvedRiskProfile: nullableRiskProfile(row.approvedRiskProfile),
    breakdownJson: nullableString(row.breakdownJson),
    constraintsJson: nullableString(row.constraintsJson),
    reviewFlagsJson: nullableString(row.reviewFlagsJson),
    capsAppliedJson: nullableString(row.capsAppliedJson),
    aiSummaryArtifactId: nullableString(row.aiSummaryArtifactId),
    submittedAt: nullableString(row.submittedAt),
    submittedBy: nullableString(row.submittedBy),
    submittedByRole,
    computedAt: nullableString(row.computedAt),
    reviewedAt: nullableString(row.reviewedAt),
    approvedAt: nullableString(row.approvedAt),
    approvedBy: nullableString(row.approvedBy),
    approvalNotes: nullableString(row.approvalNotes),
    overrideReason: nullableString(row.overrideReason),
    clarificationRequestsJson: nullableString(row.clarificationRequestsJson),
    expiresAt: nullableString(row.expiresAt),
    supersededByAssessmentId: nullableString(row.supersededByAssessmentId),
    supersededAt: nullableString(row.supersededAt),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

function normalizeProfileRow(row: Record<string, unknown>): ClientProfileRecord {
  const status = String(row.status) as ClientProfileStatus;
  if (!clientProfileStatuses.includes(status)) {
    throw new Error(`Invalid client_profiles.status: ${status}`);
  }

  const clientType = String(row.clientType) as ClientType;
  if (!clientTypes.includes(clientType)) {
    throw new Error(`Invalid client_profiles.client_type: ${clientType}`);
  }

  const investorCategory = String(row.investorCategory) as InvestorCategory;
  if (!investorCategories.includes(investorCategory)) {
    throw new Error(`Invalid client_profiles.investor_category: ${investorCategory}`);
  }

  const profileSource = String(row.profileSource) as ClientProfileSource;
  if (!clientProfileSources.includes(profileSource)) {
    throw new Error(`Invalid client_profiles.profile_source: ${profileSource}`);
  }

  return {
    clientProfileId: String(row.clientProfileId),
    leadId: String(row.leadId),
    clientType,
    investorCategory,
    status,
    currentAssessmentId: nullableString(row.currentAssessmentId),
    computedRiskProfile: nullableRiskProfile(row.computedRiskProfile),
    approvedRiskProfile: nullableRiskProfile(row.approvedRiskProfile),
    riskProfile: nullableRiskProfile(row.riskProfile),
    validFrom: nullableString(row.validFrom),
    validUntil: nullableString(row.validUntil),
    lastReviewedAt: nullableString(row.lastReviewedAt),
    nextReviewDueAt: nullableString(row.nextReviewDueAt),
    profileSource,
    qualifiedInvestorAttestationArtifactId: nullableString(row.qualifiedInvestorAttestationArtifactId),
    professionalInvestorAttestationArtifactId: nullableString(row.professionalInvestorAttestationArtifactId),
    overrideReason: nullableString(row.overrideReason),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

export type ClientProfileSeed = {
  readonly clientType?: ClientType;
  readonly investorCategory?: InvestorCategory;
  readonly profileSource?: ClientProfileSource;
};

function ensureClientProfileRow(leadId: string, now: string, seed: ClientProfileSeed): void {
  const db = getDatabase();
  const existing = db
    .prepare(`SELECT client_profile_id FROM ${clientProfilesTable} WHERE lead_id = ? LIMIT 1`)
    .get(leadId);

  if (existing) {
    return;
  }

  const clientType: ClientType = seed.clientType ?? 'individual';
  const investorCategory: InvestorCategory = seed.investorCategory ?? 'retail';
  const profileSource: ClientProfileSource = seed.profileSource ?? 'self_declared';

  if (!clientTypes.includes(clientType)) {
    throw new Error(`Invalid clientType: ${clientType}`);
  }
  if (!investorCategories.includes(investorCategory)) {
    throw new Error(`Invalid investorCategory: ${investorCategory}`);
  }
  if (!clientProfileSources.includes(profileSource)) {
    throw new Error(`Invalid profileSource: ${profileSource}`);
  }

  db.prepare(`
    INSERT INTO ${clientProfilesTable} (
      client_profile_id, lead_id, client_type, investor_category, status,
      current_assessment_id, computed_risk_profile, approved_risk_profile,
      risk_profile, valid_from, valid_until, last_reviewed_at, next_review_due_at,
      profile_source, qualified_investor_attestation_artifact_id,
      professional_investor_attestation_artifact_id, override_reason,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'none', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ?, NULL, NULL, NULL, ?, ?)
  `).run(randomUUID(), leadId, clientType, investorCategory, profileSource, now, now);
}

function buildSectionsPayload(answers: SuitabilityAnswers) {
  return {
    objectives: JSON.stringify(answers.objectives ?? {}),
    financial_situation: JSON.stringify(answers.financial_situation ?? {}),
    knowledge_experience: JSON.stringify(answers.knowledge_experience ?? {}),
    liquidity_needs: JSON.stringify(answers.liquidity_needs ?? {}),
    restrictions: JSON.stringify(answers.restrictions ?? {})
  } as Record<SuitabilitySectionKey, string>;
}

function canonicalAnswersHash(payload: Record<SuitabilitySectionKey, string>): string {
  // Hash determinístico independente da ordem das chaves dentro de cada seção.
  // Para garantir determinismo, re-parse + sort keys.
  const sorted: Record<string, Record<string, unknown>> = {};
  for (const key of Object.keys(payload).sort()) {
    const sectionRaw = JSON.parse(payload[key as SuitabilitySectionKey]) as Record<string, unknown>;
    const sortedSection: Record<string, unknown> = {};
    for (const innerKey of Object.keys(sectionRaw).sort()) {
      sortedSection[innerKey] = sectionRaw[innerKey];
    }
    sorted[key] = sortedSection;
  }
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex');
}

export type CreateDraftAssessmentResult =
  | { ok: true; assessment: SuitabilityAssessmentRecord }
  | { ok: false; errorCode: 'lead_not_found' | 'invalid_questionnaire_version' };

export function createDraftAssessment(params: {
  leadId: string;
  questionnaireVersion: string;
  answers: SuitabilityAnswers;
  actorId: string | null;
  clientProfileSeed?: ClientProfileSeed;
}): CreateDraftAssessmentResult {
  const { leadId, questionnaireVersion, answers, actorId } = params;

  if (!leadExists(leadId)) {
    return { ok: false, errorCode: 'lead_not_found' };
  }
  if (questionnaireVersion !== suitabilityQuestionnaireVersion) {
    return { ok: false, errorCode: 'invalid_questionnaire_version' };
  }

  const db = getDatabase();
  const assessmentId = randomUUID();
  const now = new Date().toISOString();
  const sections = buildSectionsPayload(answers);
  const answersHash = canonicalAnswersHash(sections);

  db.exec('BEGIN');
  try {
    ensureClientProfileRow(leadId, now, params.clientProfileSeed ?? {});

    db.prepare(`
      INSERT INTO ${suitabilityAssessmentsTable} (
        assessment_id, lead_id, questionnaire_version, scoring_calibration_version, status,
        objectives_json, financial_situation_json, knowledge_experience_json,
        liquidity_needs_json, restrictions_json, answers_hash,
        score, computed_risk_profile, capped_risk_profile, approved_risk_profile,
        breakdown_json, constraints_json, review_flags_json, caps_applied_json,
        ai_summary_artifact_id, submitted_at, submitted_by, submitted_by_role,
        computed_at, reviewed_at, approved_at, approved_by, approval_notes,
        override_reason, clarification_requests_json, expires_at,
        superseded_by_assessment_id, superseded_at,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, NULL, 'draft',
        ?, ?, ?, ?, ?, ?,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL,
        NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, NULL,
        NULL, NULL,
        ?, ?
      )
    `).run(
      assessmentId,
      leadId,
      questionnaireVersion,
      sections.objectives,
      sections.financial_situation,
      sections.knowledge_experience,
      sections.liquidity_needs,
      sections.restrictions,
      answersHash,
      now,
      now
    );

    writeAuditLog({
      action: 'suitability.draft.created',
      entityType: 'suitability_assessment',
      entityId: assessmentId,
      leadId,
      actorType: 'operator',
      actorId,
      detail: { questionnaireVersion, answersHash }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const assessment = getAssessment(assessmentId);
  if (!assessment) {
    throw new Error(`Suitability assessment ${assessmentId} not found after insert`);
  }
  return { ok: true, assessment };
}

export function getAssessment(assessmentId: string): SuitabilityAssessmentRecord | null {
  const db = getDatabase();
  const row = db
    .prepare(`SELECT ${ASSESSMENT_SELECT_COLUMNS} FROM ${suitabilityAssessmentsTable} WHERE assessment_id = ? LIMIT 1`)
    .get(assessmentId) as Record<string, unknown> | undefined;
  return row ? normalizeAssessmentRow(row) : null;
}

export function listAssessmentsByLead(leadId: string): SuitabilityAssessmentRecord[] {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT ${ASSESSMENT_SELECT_COLUMNS}
      FROM ${suitabilityAssessmentsTable}
      WHERE lead_id = ?
      ORDER BY created_at DESC, assessment_id DESC
    `)
    .all(leadId) as Record<string, unknown>[];
  return rows.map(normalizeAssessmentRow);
}

export function getCurrentClientProfile(leadId: string): ClientProfileRecord | null {
  const db = getDatabase();
  const row = db
    .prepare(`SELECT ${PROFILE_SELECT_COLUMNS} FROM ${clientProfilesTable} WHERE lead_id = ? LIMIT 1`)
    .get(leadId) as Record<string, unknown> | undefined;
  return row ? normalizeProfileRow(row) : null;
}

export type SubmitAssessmentResult =
  | { ok: true; assessment: SuitabilityAssessmentRecord; routedToReview: boolean }
  | {
      ok: false;
      errorCode: 'assessment_not_found' | 'invalid_transition' | 'scoring_failed';
      detail?: unknown;
    };

export function submitAssessment(params: {
  assessmentId: string;
  actorId: string | null;
  submittedByRole?: SuitabilityAssessmentActorRole;
}): SubmitAssessmentResult {
  const { assessmentId, actorId } = params;
  const role: SuitabilityAssessmentActorRole = params.submittedByRole ?? 'consultant';

  const current = getAssessment(assessmentId);
  if (!current) {
    return { ok: false, errorCode: 'assessment_not_found' };
  }

  // Aceitamos partir de 'draft' para 'submitted'. O routing para 'review_required'
  // é uma segunda transição imediata se o resultado do scoring indicar que humano
  // precisa decidir antes de aprovar. Ambas estão habilitadas no transitions canônico.
  if (!canTransitionSuitabilityAssessmentStatus(current.status, 'submitted')) {
    return { ok: false, errorCode: 'invalid_transition', detail: { from: current.status, to: 'submitted' } };
  }

  const answers: SuitabilityAnswers = {
    objectives: JSON.parse(current.objectivesJson),
    financial_situation: JSON.parse(current.financialSituationJson),
    knowledge_experience: JSON.parse(current.knowledgeExperienceJson),
    liquidity_needs: JSON.parse(current.liquidityNeedsJson),
    restrictions: JSON.parse(current.restrictionsJson)
  };

  const scoring = scoreSuitability(answers);
  if (!scoring.ok) {
    return { ok: false, errorCode: 'scoring_failed', detail: scoring };
  }

  const breakdownJson = JSON.stringify(scoring.breakdown);
  const constraintsJson = JSON.stringify(scoring.constraints);
  const reviewFlagsJson = JSON.stringify(scoring.reviewFlags);
  const capsAppliedJson = JSON.stringify(scoring.capsApplied);

  // requiresHumanReviewBeforeApproval considera reviewFlagsJson e capsAppliedJson
  // como booleanos (truthy = exige revisão). JSON.stringify de array vazio
  // retorna '[]' que é truthy, então passamos null quando a lista está vazia
  // para preservar a semântica do invariante canônico.
  const needsHumanReview = requiresHumanReviewBeforeApproval({
    computedRiskProfile: scoring.computedRiskProfile,
    cappedRiskProfile: scoring.cappedRiskProfile,
    reviewFlagsJson: scoring.reviewFlags.length > 0 ? reviewFlagsJson : null,
    capsAppliedJson: scoring.capsApplied.length > 0 ? capsAppliedJson : null
  });

  const targetStatus: SuitabilityAssessmentStatus = needsHumanReview ? 'review_required' : 'submitted';

  // Se vamos pular para review_required, precisamos passar pela transição submitted→review_required
  // que está habilitada. Aplicamos diretamente o status final via UPDATE — o invariante de transitions
  // é validado acima (draft→submitted) e a segunda etapa (submitted→review_required) é igualmente válida.
  const db = getDatabase();
  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE ${suitabilityAssessmentsTable}
      SET status = ?,
          scoring_calibration_version = ?,
          score = ?,
          computed_risk_profile = ?,
          capped_risk_profile = ?,
          breakdown_json = ?,
          constraints_json = ?,
          review_flags_json = ?,
          caps_applied_json = ?,
          submitted_at = ?,
          submitted_by = ?,
          submitted_by_role = ?,
          computed_at = ?,
          reviewed_at = ?,
          updated_at = ?
      WHERE assessment_id = ?
    `).run(
      targetStatus,
      suitabilityScoringCalibrationVersion,
      scoring.score,
      scoring.computedRiskProfile,
      scoring.cappedRiskProfile,
      breakdownJson,
      constraintsJson,
      reviewFlagsJson,
      capsAppliedJson,
      now,
      actorId,
      role,
      now,
      needsHumanReview ? now : null,
      now,
      assessmentId
    );

    // Espelha computedRiskProfile no client_profile (riskProfile vigente fica em approve).
    db.prepare(`
      UPDATE ${clientProfilesTable}
      SET computed_risk_profile = ?,
          updated_at = ?
      WHERE lead_id = ?
    `).run(scoring.computedRiskProfile, now, current.leadId);

    writeAuditLog({
      action: needsHumanReview ? 'suitability.review_required' : 'suitability.submitted',
      entityType: 'suitability_assessment',
      entityId: assessmentId,
      leadId: current.leadId,
      actorType: 'operator',
      actorId,
      detail: {
        score: scoring.score,
        computedRiskProfile: scoring.computedRiskProfile,
        cappedRiskProfile: scoring.cappedRiskProfile,
        capsApplied: scoring.capsApplied.length,
        reviewFlags: scoring.reviewFlags.length,
        scoringCalibrationVersion: suitabilityScoringCalibrationVersion
      }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const refreshed = getAssessment(assessmentId);
  if (!refreshed) {
    throw new Error(`Suitability assessment ${assessmentId} disappeared after submit`);
  }
  return { ok: true, assessment: refreshed, routedToReview: needsHumanReview };
}

export type ApproveAssessmentResult =
  | { ok: true; assessment: SuitabilityAssessmentRecord; profile: ClientProfileRecord }
  | {
      ok: false;
      errorCode:
        | 'assessment_not_found'
        | 'invalid_transition'
        | 'missing_capped_profile'
        | 'invalid_approved_risk_profile'
        | 'override_requires_reason'
        | 'invalid_valid_until';
      detail?: unknown;
    };

export function approveAssessment(params: {
  assessmentId: string;
  approvedBy: string;
  approvedRiskProfile?: ClientRiskProfile;
  validUntil: string;
  approvalNotes?: string;
  overrideReason?: string;
}): ApproveAssessmentResult {
  const { assessmentId, approvedBy, validUntil } = params;
  const current = getAssessment(assessmentId);
  if (!current) {
    return { ok: false, errorCode: 'assessment_not_found' };
  }

  if (!canTransitionSuitabilityAssessmentStatus(current.status, 'approved')) {
    return { ok: false, errorCode: 'invalid_transition', detail: { from: current.status, to: 'approved' } };
  }

  if (!current.cappedRiskProfile) {
    return { ok: false, errorCode: 'missing_capped_profile' };
  }

  const approvedRiskProfile: ClientRiskProfile = params.approvedRiskProfile ?? current.cappedRiskProfile;
  if (!clientRiskProfiles.includes(approvedRiskProfile)) {
    return { ok: false, errorCode: 'invalid_approved_risk_profile' };
  }

  const isOverride = approvedRiskProfile !== current.cappedRiskProfile;
  const overrideReason = (params.overrideReason ?? '').trim();
  if (isOverride && !overrideReason) {
    return { ok: false, errorCode: 'override_requires_reason' };
  }

  if (!/^\d{4}-\d{2}-\d{2}/.test(validUntil) || Number.isNaN(Date.parse(validUntil))) {
    return { ok: false, errorCode: 'invalid_valid_until' };
  }

  const approvalNotes = params.approvalNotes?.trim() ?? null;

  const db = getDatabase();
  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE ${suitabilityAssessmentsTable}
      SET status = 'approved',
          approved_at = ?,
          approved_by = ?,
          approved_risk_profile = ?,
          approval_notes = ?,
          override_reason = ?,
          expires_at = ?,
          updated_at = ?
      WHERE assessment_id = ?
    `).run(
      now,
      approvedBy,
      approvedRiskProfile,
      approvalNotes,
      isOverride ? overrideReason : null,
      validUntil,
      now,
      assessmentId
    );

    // Marca quaisquer outros assessments aprovados deste lead como 'superseded'
    // antes de promover este. Mantém invariante de "apenas um perfil ativo por lead".
    db.prepare(`
      UPDATE ${suitabilityAssessmentsTable}
      SET status = 'superseded',
          superseded_by_assessment_id = ?,
          superseded_at = ?,
          updated_at = ?
      WHERE lead_id = ?
        AND assessment_id != ?
        AND status IN ('approved', 'submitted', 'review_required', 'needs_clarification')
    `).run(assessmentId, now, now, current.leadId, assessmentId);

    db.prepare(`
      UPDATE ${clientProfilesTable}
      SET status = 'active',
          current_assessment_id = ?,
          approved_risk_profile = ?,
          risk_profile = ?,
          valid_from = ?,
          valid_until = ?,
          last_reviewed_at = ?,
          override_reason = ?,
          profile_source = ?,
          updated_at = ?
      WHERE lead_id = ?
    `).run(
      assessmentId,
      approvedRiskProfile,
      approvedRiskProfile,
      now,
      validUntil,
      now,
      isOverride ? overrideReason : null,
      isOverride ? 'manual_override' : 'consultant_approved',
      now,
      current.leadId
    );

    writeAuditLog({
      action: 'suitability.approved',
      entityType: 'suitability_assessment',
      entityId: assessmentId,
      leadId: current.leadId,
      actorType: 'operator',
      actorId: approvedBy,
      detail: {
        approvedRiskProfile,
        cappedRiskProfile: current.cappedRiskProfile,
        computedRiskProfile: current.computedRiskProfile,
        score: current.score,
        validUntil,
        override: isOverride,
        overrideReason: isOverride ? overrideReason : null
      }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const refreshed = getAssessment(assessmentId);
  const profile = getCurrentClientProfile(current.leadId);
  if (!refreshed || !profile) {
    throw new Error(`Suitability assessment ${assessmentId} or profile missing after approve`);
  }
  return { ok: true, assessment: refreshed, profile };
}

// ---------------------------------------------------------------------------
// AI-3 Cycle 1.5 — lifecycle completo: clarification, resubmit, supersede
// manual e expiração automática (cron). Usa transitions canônicas e mantém
// supersede automática do Cycle 1 intacta.
// ---------------------------------------------------------------------------

type ClarificationRequestEntry = {
  readonly requestedAt: string;
  readonly requestedBy: string | null;
  readonly message: string;
};

function appendClarificationRequest(
  currentJson: string | null,
  entry: ClarificationRequestEntry
): string {
  let list: ClarificationRequestEntry[] = [];
  if (currentJson) {
    try {
      const parsed = JSON.parse(currentJson);
      if (Array.isArray(parsed)) {
        list = parsed as ClarificationRequestEntry[];
      }
    } catch {
      list = [];
    }
  }
  list.push(entry);
  return JSON.stringify(list);
}

export type RequestClarificationResult =
  | { ok: true; assessment: SuitabilityAssessmentRecord }
  | {
      ok: false;
      errorCode: 'assessment_not_found' | 'invalid_transition' | 'message_required';
      detail?: unknown;
    };

export function requestClarification(params: {
  assessmentId: string;
  requestedBy: string | null;
  message: string;
}): RequestClarificationResult {
  const message = params.message?.trim() ?? '';
  if (!message) {
    return { ok: false, errorCode: 'message_required' };
  }

  const current = getAssessment(params.assessmentId);
  if (!current) {
    return { ok: false, errorCode: 'assessment_not_found' };
  }

  if (!canTransitionSuitabilityAssessmentStatus(current.status, 'needs_clarification')) {
    return {
      ok: false,
      errorCode: 'invalid_transition',
      detail: { from: current.status, to: 'needs_clarification' }
    };
  }

  const nextJson = appendClarificationRequest(current.clarificationRequestsJson, {
    requestedAt: new Date().toISOString(),
    requestedBy: params.requestedBy,
    message
  });

  const db = getDatabase();
  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE ${suitabilityAssessmentsTable}
      SET status = 'needs_clarification',
          clarification_requests_json = ?,
          updated_at = ?
      WHERE assessment_id = ?
    `).run(nextJson, now, params.assessmentId);

    writeAuditLog({
      action: 'suitability.clarification_requested',
      entityType: 'suitability_assessment',
      entityId: params.assessmentId,
      leadId: current.leadId,
      actorType: 'operator',
      actorId: params.requestedBy,
      detail: { message, fromStatus: current.status }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const refreshed = getAssessment(params.assessmentId);
  if (!refreshed) {
    throw new Error(`Suitability assessment ${params.assessmentId} missing after clarification`);
  }
  return { ok: true, assessment: refreshed };
}

export type ResubmitAssessmentResult =
  | {
      ok: true;
      assessment: SuitabilityAssessmentRecord;
      routedToReview: boolean;
    }
  | {
      ok: false;
      errorCode: 'assessment_not_found' | 'invalid_transition' | 'scoring_failed';
      detail?: unknown;
    };

export function resubmitAssessment(params: {
  assessmentId: string;
  actorId: string | null;
  submittedByRole?: SuitabilityAssessmentActorRole;
  answers?: SuitabilityAnswers;
}): ResubmitAssessmentResult {
  const current = getAssessment(params.assessmentId);
  if (!current) {
    return { ok: false, errorCode: 'assessment_not_found' };
  }

  if (!canTransitionSuitabilityAssessmentStatus(current.status, 'submitted')) {
    return {
      ok: false,
      errorCode: 'invalid_transition',
      detail: { from: current.status, to: 'submitted' }
    };
  }

  const role: SuitabilityAssessmentActorRole = params.submittedByRole ?? 'consultant';

  // Se o autor passou novas respostas, re-serializa + recalcula answersHash;
  // senão, mantém as respostas atuais e re-roda o scoring sobre elas.
  const answers: SuitabilityAnswers = params.answers ?? {
    objectives: JSON.parse(current.objectivesJson),
    financial_situation: JSON.parse(current.financialSituationJson),
    knowledge_experience: JSON.parse(current.knowledgeExperienceJson),
    liquidity_needs: JSON.parse(current.liquidityNeedsJson),
    restrictions: JSON.parse(current.restrictionsJson)
  };

  const sectionsPayload = buildSectionsPayload(answers);
  const answersHash = canonicalAnswersHash(sectionsPayload);

  const scoring = scoreSuitability(answers);
  if (!scoring.ok) {
    return { ok: false, errorCode: 'scoring_failed', detail: scoring };
  }

  const breakdownJson = JSON.stringify(scoring.breakdown);
  const constraintsJson = JSON.stringify(scoring.constraints);
  const reviewFlagsJson = JSON.stringify(scoring.reviewFlags);
  const capsAppliedJson = JSON.stringify(scoring.capsApplied);

  const needsHumanReview = requiresHumanReviewBeforeApproval({
    computedRiskProfile: scoring.computedRiskProfile,
    cappedRiskProfile: scoring.cappedRiskProfile,
    reviewFlagsJson: scoring.reviewFlags.length > 0 ? reviewFlagsJson : null,
    capsAppliedJson: scoring.capsApplied.length > 0 ? capsAppliedJson : null
  });

  const targetStatus: SuitabilityAssessmentStatus = needsHumanReview ? 'review_required' : 'submitted';

  const db = getDatabase();
  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE ${suitabilityAssessmentsTable}
      SET status = ?,
          objectives_json = ?,
          financial_situation_json = ?,
          knowledge_experience_json = ?,
          liquidity_needs_json = ?,
          restrictions_json = ?,
          answers_hash = ?,
          scoring_calibration_version = ?,
          score = ?,
          computed_risk_profile = ?,
          capped_risk_profile = ?,
          breakdown_json = ?,
          constraints_json = ?,
          review_flags_json = ?,
          caps_applied_json = ?,
          submitted_at = ?,
          submitted_by = ?,
          submitted_by_role = ?,
          computed_at = ?,
          reviewed_at = ?,
          updated_at = ?
      WHERE assessment_id = ?
    `).run(
      targetStatus,
      sectionsPayload.objectives,
      sectionsPayload.financial_situation,
      sectionsPayload.knowledge_experience,
      sectionsPayload.liquidity_needs,
      sectionsPayload.restrictions,
      answersHash,
      suitabilityScoringCalibrationVersion,
      scoring.score,
      scoring.computedRiskProfile,
      scoring.cappedRiskProfile,
      breakdownJson,
      constraintsJson,
      reviewFlagsJson,
      capsAppliedJson,
      now,
      params.actorId,
      role,
      now,
      needsHumanReview ? now : null,
      now,
      params.assessmentId
    );

    db.prepare(`
      UPDATE ${clientProfilesTable}
      SET computed_risk_profile = ?,
          updated_at = ?
      WHERE lead_id = ?
    `).run(scoring.computedRiskProfile, now, current.leadId);

    writeAuditLog({
      action: 'suitability.resubmitted',
      entityType: 'suitability_assessment',
      entityId: params.assessmentId,
      leadId: current.leadId,
      actorType: 'operator',
      actorId: params.actorId,
      detail: {
        previousStatus: current.status,
        nextStatus: targetStatus,
        answersChanged: Boolean(params.answers),
        score: scoring.score,
        cappedRiskProfile: scoring.cappedRiskProfile,
        capsApplied: scoring.capsApplied.length,
        reviewFlags: scoring.reviewFlags.length
      }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const refreshed = getAssessment(params.assessmentId);
  if (!refreshed) {
    throw new Error(`Suitability assessment ${params.assessmentId} missing after resubmit`);
  }
  return { ok: true, assessment: refreshed, routedToReview: needsHumanReview };
}

export type SupersedeAssessmentResult =
  | { ok: true; assessment: SuitabilityAssessmentRecord }
  | {
      ok: false;
      errorCode:
        | 'assessment_not_found'
        | 'superseder_not_found'
        | 'invalid_transition'
        | 'self_supersede'
        | 'cross_lead_supersede';
      detail?: unknown;
    };

export function supersedeAssessment(params: {
  assessmentId: string;
  supersededByAssessmentId: string;
  actorId: string | null;
}): SupersedeAssessmentResult {
  if (params.assessmentId === params.supersededByAssessmentId) {
    return { ok: false, errorCode: 'self_supersede' };
  }

  const current = getAssessment(params.assessmentId);
  if (!current) {
    return { ok: false, errorCode: 'assessment_not_found' };
  }

  const superseder = getAssessment(params.supersededByAssessmentId);
  if (!superseder) {
    return { ok: false, errorCode: 'superseder_not_found' };
  }

  if (superseder.leadId !== current.leadId) {
    return { ok: false, errorCode: 'cross_lead_supersede' };
  }

  if (!canTransitionSuitabilityAssessmentStatus(current.status, 'superseded')) {
    return {
      ok: false,
      errorCode: 'invalid_transition',
      detail: { from: current.status, to: 'superseded' }
    };
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE ${suitabilityAssessmentsTable}
      SET status = 'superseded',
          superseded_by_assessment_id = ?,
          superseded_at = ?,
          updated_at = ?
      WHERE assessment_id = ?
    `).run(params.supersededByAssessmentId, now, now, params.assessmentId);

    writeAuditLog({
      action: 'suitability.superseded.manual',
      entityType: 'suitability_assessment',
      entityId: params.assessmentId,
      leadId: current.leadId,
      actorType: 'operator',
      actorId: params.actorId,
      detail: {
        previousStatus: current.status,
        supersededByAssessmentId: params.supersededByAssessmentId
      }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const refreshed = getAssessment(params.assessmentId);
  if (!refreshed) {
    throw new Error(`Suitability assessment ${params.assessmentId} missing after supersede`);
  }
  return { ok: true, assessment: refreshed };
}

export type ExpiredAssessmentSummary = {
  readonly assessmentId: string;
  readonly leadId: string;
  readonly previousValidUntil: string | null;
};

export type ExpireOverdueAssessmentsResult = {
  readonly expiredCount: number;
  readonly expired: readonly ExpiredAssessmentSummary[];
};

export function expireOverdueAssessments(params: { nowIso?: string } = {}): ExpireOverdueAssessmentsResult {
  const nowIso = params.nowIso ?? new Date().toISOString();
  const db = getDatabase();

  const overdueRows = db.prepare(`
    SELECT assessment_id AS assessmentId,
           lead_id AS leadId,
           expires_at AS expiresAt
    FROM ${suitabilityAssessmentsTable}
    WHERE status = 'approved'
      AND expires_at IS NOT NULL
      AND expires_at <= ?
  `).all(nowIso) as Array<{ assessmentId: string; leadId: string; expiresAt: string }>;

  if (overdueRows.length === 0) {
    return { expiredCount: 0, expired: [] };
  }

  const summaries: ExpiredAssessmentSummary[] = [];

  for (const row of overdueRows) {
    db.exec('BEGIN');
    try {
      db.prepare(`
        UPDATE ${suitabilityAssessmentsTable}
        SET status = 'expired',
            updated_at = ?
        WHERE assessment_id = ? AND status = 'approved'
      `).run(nowIso, row.assessmentId);

      // Sincroniza client_profile correspondente quando este é o assessment vigente.
      db.prepare(`
        UPDATE ${clientProfilesTable}
        SET status = 'expired',
            updated_at = ?
        WHERE lead_id = ?
          AND current_assessment_id = ?
          AND status = 'active'
      `).run(nowIso, row.leadId, row.assessmentId);

      writeAuditLog({
        action: 'suitability.expired.cron',
        entityType: 'suitability_assessment',
        entityId: row.assessmentId,
        leadId: row.leadId,
        actorType: 'system',
        actorId: 'cron-suitability-expire',
        detail: { previousValidUntil: row.expiresAt, expiredAt: nowIso }
      });

      db.exec('COMMIT');

      summaries.push({
        assessmentId: row.assessmentId,
        leadId: row.leadId,
        previousValidUntil: row.expiresAt
      });
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }

  return { expiredCount: summaries.length, expired: summaries };
}
