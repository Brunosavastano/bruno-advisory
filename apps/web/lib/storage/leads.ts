import { randomUUID } from 'node:crypto';
import { commercialStageModel, isOperatorCommercialStage, type OperatorCommercialStage } from '@bruno-advisory/core';
import { intakeContract, type PublicIntakePayload, type SourceChannel } from '@bruno-advisory/core/intake-contract';
import {
  getDatabase,
  leadsTable,
  stageAuditTable,
  normalizeLeadRow
} from './db';
import { writeAuditLog } from './audit-log';
import type { LeadCommercialStageAuditRecord, LeadCrmFieldsUpdate, LeadFitLevel, StoredLead } from './types';

const leadSelectColumns = `
  lead_id AS leadId, full_name AS fullName, email, phone, city, state,
  investable_assets_band AS investableAssetsBand, primary_challenge AS primaryChallenge,
  source_channel AS sourceChannel, source_label AS sourceLabel, source_campaign AS sourceCampaign,
  source_medium AS sourceMedium, source_content AS sourceContent,
  intake_form_version AS intakeFormVersion, privacy_consent_accepted AS privacyConsentAccepted,
  terms_consent_accepted AS termsConsentAccepted, status, commercial_stage AS commercialStage,
  status_reason AS statusReason, fit_summary AS fitSummary, internal_owner AS internalOwner,
  cidade_estado AS cidadeEstado, ocupacao_perfil AS ocupacaoPerfil, nivel_de_fit AS nivelDeFit,
  motivo_sem_fit AS motivoSemFit, owner, data_call_qualificacao AS dataCallQualificacao,
  resumo_call AS resumoCall, interesse_na_oferta AS interesseNaOferta,
  checklist_onboarding AS checklistOnboarding, cadencia_acordada AS cadenciaAcordada,
  proximo_passo AS proximoPasso, risco_de_churn AS riscoDeChurn,
  submitted_at AS submittedAt, created_at AS createdAt, updated_at AS updatedAt,
  first_captured_at AS firstCapturedAt, last_status_changed_at AS lastStatusChangedAt
`;

function isLeadFitLevel(value: unknown): value is LeadFitLevel {
  return value === 'alto' || value === 'medio' || value === 'baixo';
}

function normalizeNullableString(value: string | null | undefined) {
  if (value === null) {
    return null;
  }

  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeNullableFitLevel(value: LeadFitLevel | null | undefined) {
  return isLeadFitLevel(value) ? value : null;
}

export function persistLeadFromIntake(params: {
  payload: PublicIntakePayload;
  sourceChannel: SourceChannel;
  sourceCampaign?: string;
  sourceMedium?: string;
  sourceContent?: string;
}) {
  const now = new Date().toISOString();

  const lead: StoredLead = {
    leadId: randomUUID(),
    fullName: params.payload.fullName,
    email: params.payload.email,
    phone: params.payload.phone,
    city: params.payload.city,
    state: params.payload.state,
    investableAssetsBand: params.payload.investableAssetsBand,
    primaryChallenge: params.payload.primaryChallenge,
    sourceChannel: params.sourceChannel,
    sourceLabel: params.payload.sourceLabel,
    sourceCampaign: params.sourceCampaign,
    sourceMedium: params.sourceMedium,
    sourceContent: params.sourceContent,
    intakeFormVersion: intakeContract.leadDefaults.intakeFormVersion,
    privacyConsentAccepted: params.payload.privacyConsentAccepted,
    termsConsentAccepted: params.payload.termsConsentAccepted,
    status: intakeContract.leadDefaults.status,
    commercialStage: commercialStageModel.defaultStage,
    statusReason: intakeContract.leadDefaults.statusReason,
    fitSummary: intakeContract.leadDefaults.fitSummary,
    internalOwner: intakeContract.leadDefaults.internalOwner,
    cidadeEstado: null,
    ocupacaoPerfil: null,
    nivelDeFit: null,
    motivoSemFit: null,
    owner: null,
    dataCallQualificacao: null,
    resumoCall: null,
    interesseNaOferta: null,
    checklistOnboarding: null,
    cadenciaAcordada: null,
    proximoPasso: null,
    riscoDeChurn: null,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    firstCapturedAt: now,
    lastStatusChangedAt: now
  };

  const db = getDatabase();
  db.prepare(`
    INSERT INTO ${leadsTable} (
      lead_id, full_name, email, phone, city, state, investable_assets_band, primary_challenge,
      source_channel, source_label, source_campaign, source_medium, source_content,
      intake_form_version, privacy_consent_accepted, terms_consent_accepted, status,
      commercial_stage, status_reason, fit_summary, internal_owner,
      cidade_estado, ocupacao_perfil, nivel_de_fit, motivo_sem_fit, owner,
      data_call_qualificacao, resumo_call, interesse_na_oferta, checklist_onboarding,
      cadencia_acordada, proximo_passo, risco_de_churn,
      submitted_at, created_at, updated_at, first_captured_at, last_status_changed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    lead.leadId,
    lead.fullName,
    lead.email,
    lead.phone,
    lead.city ?? null,
    lead.state ?? null,
    lead.investableAssetsBand,
    lead.primaryChallenge,
    lead.sourceChannel,
    lead.sourceLabel,
    lead.sourceCampaign ?? null,
    lead.sourceMedium ?? null,
    lead.sourceContent ?? null,
    lead.intakeFormVersion,
    lead.privacyConsentAccepted ? 1 : 0,
    lead.termsConsentAccepted ? 1 : 0,
    lead.status,
    lead.commercialStage,
    lead.statusReason,
    lead.fitSummary,
    lead.internalOwner,
    lead.cidadeEstado,
    lead.ocupacaoPerfil,
    lead.nivelDeFit,
    lead.motivoSemFit,
    lead.owner,
    lead.dataCallQualificacao,
    lead.resumoCall,
    lead.interesseNaOferta,
    lead.checklistOnboarding,
    lead.cadenciaAcordada,
    lead.proximoPasso,
    lead.riscoDeChurn,
    lead.submittedAt,
    lead.createdAt,
    lead.updatedAt,
    lead.firstCapturedAt,
    lead.lastStatusChangedAt
  );

  return lead;
}

export function listStoredLeads() {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      ${leadSelectColumns}
    FROM ${leadsTable}
    ORDER BY created_at DESC, lead_id DESC
  `).all() as Record<string, unknown>[];

  return rows.map(normalizeLeadRow);
}

export function getStoredLeadById(leadId: string) {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT
      ${leadSelectColumns}
    FROM ${leadsTable}
    WHERE lead_id = ?
    LIMIT 1
  `).get(leadId) as Record<string, unknown> | undefined;

  return row ? normalizeLeadRow(row) : null;
}

export function updateLeadCommercialStage(params: {
  leadId: string;
  toStage: OperatorCommercialStage;
  changedBy: string;
  note?: string;
}) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const cleanNote = params.note?.trim();
  const currentLead = db
    .prepare(`SELECT lead_id AS leadId, commercial_stage AS commercialStage FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`)
    .get(params.leadId) as { leadId: string; commercialStage: unknown } | undefined;

  if (!currentLead) {
    return null;
  }

  const fromStage = isOperatorCommercialStage(currentLead.commercialStage)
    ? currentLead.commercialStage
    : commercialStageModel.defaultStage;

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE ${leadsTable} SET commercial_stage = ?, updated_at = ?, last_status_changed_at = ? WHERE lead_id = ?`)
      .run(params.toStage, now, now, params.leadId);

    db.prepare(`INSERT INTO ${stageAuditTable} (audit_id, lead_id, from_stage, to_stage, changed_at, changed_by, note) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(randomUUID(), params.leadId, fromStage, params.toStage, now, params.changedBy, cleanNote || null);

    writeAuditLog({
      action: 'commercial_stage_changed',
      entityType: 'lead',
      entityId: params.leadId,
      leadId: params.leadId,
      actorType: 'operator',
      detail: {
        fromStage,
        toStage: params.toStage,
        changedBy: params.changedBy,
        note: cleanNote || null
      }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    lead: getStoredLeadById(params.leadId),
    changedFrom: fromStage,
    changedTo: params.toStage,
    changedAt: now,
    note: cleanNote || null
  };
}

export function updateLeadCrmFields(params: { leadId: string; fields: LeadCrmFieldsUpdate }) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const currentLead = getStoredLeadById(params.leadId);

  if (!currentLead) {
    return null;
  }

  const nextFields = {
    cidadeEstado: normalizeNullableString(params.fields.cidadeEstado),
    ocupacaoPerfil: normalizeNullableString(params.fields.ocupacaoPerfil),
    nivelDeFit: normalizeNullableFitLevel(params.fields.nivelDeFit),
    motivoSemFit: normalizeNullableString(params.fields.motivoSemFit),
    owner: normalizeNullableString(params.fields.owner),
    dataCallQualificacao: normalizeNullableString(params.fields.dataCallQualificacao),
    resumoCall: normalizeNullableString(params.fields.resumoCall),
    interesseNaOferta: normalizeNullableFitLevel(params.fields.interesseNaOferta),
    checklistOnboarding: normalizeNullableString(params.fields.checklistOnboarding),
    cadenciaAcordada: normalizeNullableString(params.fields.cadenciaAcordada),
    proximoPasso: normalizeNullableString(params.fields.proximoPasso),
    riscoDeChurn: normalizeNullableFitLevel(params.fields.riscoDeChurn)
  } satisfies LeadCrmFieldsUpdate;

  db.prepare(`
    UPDATE ${leadsTable}
    SET cidade_estado = ?, ocupacao_perfil = ?, nivel_de_fit = ?, motivo_sem_fit = ?, owner = ?,
        data_call_qualificacao = ?, resumo_call = ?, interesse_na_oferta = ?, checklist_onboarding = ?,
        cadencia_acordada = ?, proximo_passo = ?, risco_de_churn = ?, updated_at = ?
    WHERE lead_id = ?
  `).run(
    nextFields.cidadeEstado,
    nextFields.ocupacaoPerfil,
    nextFields.nivelDeFit,
    nextFields.motivoSemFit,
    nextFields.owner,
    nextFields.dataCallQualificacao,
    nextFields.resumoCall,
    nextFields.interesseNaOferta,
    nextFields.checklistOnboarding,
    nextFields.cadenciaAcordada,
    nextFields.proximoPasso,
    nextFields.riscoDeChurn,
    now,
    params.leadId
  );

  return {
    lead: getStoredLeadById(params.leadId),
    updatedAt: now
  };
}

export function listLeadCommercialStageAudit(leadId: string, limit = 50): LeadCommercialStageAuditRecord[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      audit_id AS auditId, lead_id AS leadId, from_stage AS fromStage, to_stage AS toStage,
      changed_at AS changedAt, changed_by AS changedBy, note
    FROM ${stageAuditTable}
    WHERE lead_id = ?
    ORDER BY changed_at DESC, audit_id DESC
    LIMIT ?
  `).all(leadId, limit) as Record<string, unknown>[];

  return rows
    .filter((row) => isOperatorCommercialStage(row.toStage))
    .map((row) => ({
      auditId: String(row.auditId),
      leadId: String(row.leadId),
      fromStage: isOperatorCommercialStage(row.fromStage) ? row.fromStage : null,
      toStage: row.toStage as OperatorCommercialStage,
      changedAt: String(row.changedAt),
      changedBy: String(row.changedBy),
      note: row.note === null ? null : String(row.note)
    }));
}
