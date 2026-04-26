import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  commercialStageModel,
  isOperatorCommercialStage,
  type OperatorCommercialStage
} from '@savastano-advisory/core';
import {
  type IntakeAnalyticsEvent,
  type LeadStatus,
  type PublicIntakePayload,
  type SourceChannel
} from '@savastano-advisory/core/intake-contract';
import type {
  IntakeEventRecord,
  LeadBillingCharge,
  LeadBillingReadiness,
  LeadBillingRecord,
  LeadBillingSettlement,
  LeadCommercialStageAuditRecord,
  LeadFitLevel,
  LeadInternalNote,
  LeadInternalTask,
  LeadInternalTaskAuditRecord,
  LeadTaskStatus,
  StoredLead
} from './types';

function findRepoRoot(startDir: string) {
  let currentDir = path.resolve(startDir);

  while (true) {
    const projectMarker = path.join(currentDir, 'project.yaml');
    const webAppMarker = path.join(currentDir, 'apps', 'web');
    const coreMarker = path.join(currentDir, 'packages', 'core');

    if (fs.existsSync(projectMarker) && fs.existsSync(webAppMarker) && fs.existsSync(coreMarker)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error(`Could not locate Savastano Advisory repo root from ${startDir}`);
    }

    currentDir = parentDir;
  }
}

const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(findRepoRoot(process.cwd()), 'data', 'dev');
export const databasePath = path.join(dataDir, 'savastano-advisory.sqlite3');
const legacyLeadsJsonlPath = path.join(dataDir, 'intake-leads.jsonl');
const legacyEventsJsonlPath = path.join(dataDir, 'intake-events.jsonl');
export const leadsTable = 'intake_leads';
export const eventsTable = 'intake_events';
export const stageAuditTable = 'lead_stage_audit';
export const notesTable = 'lead_internal_notes';
export const tasksTable = 'lead_internal_tasks';
export const taskAuditTable = 'lead_internal_task_audit';
export const billingRecordsTable = 'lead_billing_records';
export const billingEventsTable = 'lead_billing_events';
export const billingChargesTable = 'lead_billing_charges';
export const billingChargeEventsTable = 'lead_billing_charge_events';
export const billingSettlementsTable = 'lead_billing_settlements';
export const billingSettlementEventsTable = 'lead_billing_settlement_events';
export const portalInvitesTable = 'portal_invites';
export const portalSessionsTable = 'portal_sessions';
export const onboardingChecklistItemsTable = 'onboarding_checklist_items';
export const leadDocumentsTable = 'lead_documents';
export const leadRecommendationsTable = 'lead_recommendations';
export const researchWorkflowsTable = 'research_workflows';
export const researchWorkflowEventsTable = 'research_workflow_events';
export const memosTable = 'memos';
export const memoEventsTable = 'memo_events';
export const leadPendingFlagsTable = 'lead_pending_flags';
export const auditLogTable = 'audit_log';
export const cockpitUsersTable = 'cockpit_users';
export const cockpitSessionsTable = 'cockpit_sessions';
export const aiJobsTable = 'ai_jobs';
export const aiArtifactsTable = 'ai_artifacts';
export const aiMessagesTable = 'ai_messages';
export const aiPromptTemplatesTable = 'ai_prompt_templates';
export const aiGuardrailResultsTable = 'ai_guardrail_results';
export const aiBudgetCapsTable = 'ai_budget_caps';
export const aiModelVersionsTable = 'ai_model_versions';
export const aiEvalCasesTable = 'ai_eval_cases';
export const aiEvalRunsTable = 'ai_eval_runs';

let database: DatabaseSync | undefined;

function ensureDataDir() {
  fs.mkdirSync(dataDir, { recursive: true });
}

function readJsonLines<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) {
    return [];
  }

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export function serializeMetadata(metadata?: Record<string, string | number | boolean | null>) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }

  return JSON.stringify(metadata);
}

export function parseMetadata(raw: unknown) {
  if (typeof raw !== 'string' || raw.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as Record<string, string | number | boolean | null>;
  } catch {
    return undefined;
  }
}

export function toOptionalString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function toOptionalDateString(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function toOptionalNullableString(value: unknown) {
  return value === null ? null : toOptionalString(value) ?? null;
}

function toOptionalFitLevel(value: unknown): LeadFitLevel | null {
  return value === 'alto' || value === 'medio' || value === 'baixo' ? value : null;
}

export function normalizeLeadRow(row: Record<string, unknown>): StoredLead {
  const commercialStage = row.commercialStage;
  const normalizedCommercialStage = isOperatorCommercialStage(commercialStage)
    ? commercialStage
    : commercialStageModel.defaultStage;

  return {
    leadId: String(row.leadId),
    fullName: String(row.fullName),
    email: String(row.email),
    phone: String(row.phone),
    city: toOptionalString(row.city),
    state: toOptionalString(row.state),
    investableAssetsBand: row.investableAssetsBand as PublicIntakePayload['investableAssetsBand'],
    primaryChallenge: String(row.primaryChallenge),
    sourceChannel: row.sourceChannel as SourceChannel,
    sourceLabel: String(row.sourceLabel),
    sourceCampaign: toOptionalString(row.sourceCampaign),
    sourceMedium: toOptionalString(row.sourceMedium),
    sourceContent: toOptionalString(row.sourceContent),
    intakeFormVersion: String(row.intakeFormVersion),
    privacyConsentAccepted: Number(row.privacyConsentAccepted) === 1,
    termsConsentAccepted: Number(row.termsConsentAccepted) === 1,
    status: row.status as LeadStatus,
    commercialStage: normalizedCommercialStage,
    statusReason: row.statusReason === null ? null : String(row.statusReason),
    fitSummary: row.fitSummary === null ? null : String(row.fitSummary),
    internalOwner: row.internalOwner === null ? null : String(row.internalOwner),
    cidadeEstado: toOptionalNullableString(row.cidadeEstado),
    ocupacaoPerfil: toOptionalNullableString(row.ocupacaoPerfil),
    nivelDeFit: toOptionalFitLevel(row.nivelDeFit),
    motivoSemFit: toOptionalNullableString(row.motivoSemFit),
    owner: toOptionalNullableString(row.owner),
    dataCallQualificacao: toOptionalNullableString(row.dataCallQualificacao),
    resumoCall: toOptionalNullableString(row.resumoCall),
    interesseNaOferta: toOptionalFitLevel(row.interesseNaOferta),
    checklistOnboarding: toOptionalNullableString(row.checklistOnboarding),
    cadenciaAcordada: toOptionalNullableString(row.cadenciaAcordada),
    proximoPasso: toOptionalNullableString(row.proximoPasso),
    riscoDeChurn: toOptionalFitLevel(row.riscoDeChurn),
    submittedAt: String(row.submittedAt),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    firstCapturedAt: String(row.firstCapturedAt),
    lastStatusChangedAt: String(row.lastStatusChangedAt)
  };
}

function makeLegacyEventId(record: IntakeEventRecord) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        eventName: record.eventName,
        occurredAt: record.occurredAt,
        metadata: record.metadata ?? null,
        relatedLeadId: record.relatedLeadId ?? null
      })
    )
    .digest('hex');
}

function migrateLegacyJsonlData(db: DatabaseSync) {
  const legacyLeads = readJsonLines<StoredLead>(legacyLeadsJsonlPath);
  const legacyEvents = readJsonLines<IntakeEventRecord>(legacyEventsJsonlPath);

  if (legacyLeads.length === 0 && legacyEvents.length === 0) {
    return;
  }

  const insertLead = db.prepare(`
    INSERT OR IGNORE INTO ${leadsTable} (
      lead_id,
      full_name,
      email,
      phone,
      city,
      state,
      investable_assets_band,
      primary_challenge,
      source_channel,
      source_label,
      source_campaign,
      source_medium,
      source_content,
      intake_form_version,
      privacy_consent_accepted,
      terms_consent_accepted,
      status,
      commercial_stage,
      status_reason,
      fit_summary,
      internal_owner,
      submitted_at,
      created_at,
      updated_at,
      first_captured_at,
      last_status_changed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvent = db.prepare(`
    INSERT OR IGNORE INTO ${eventsTable} (
      event_id,
      event_name,
      occurred_at,
      metadata_json,
      related_lead_id
    ) VALUES (?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');

  try {
    for (const lead of legacyLeads) {
      insertLead.run(
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
        lead.commercialStage ?? commercialStageModel.defaultStage,
        lead.statusReason,
        lead.fitSummary,
        lead.internalOwner,
        lead.submittedAt,
        lead.createdAt,
        lead.updatedAt,
        lead.firstCapturedAt,
        lead.lastStatusChangedAt
      );
    }

    for (const event of legacyEvents) {
      const relatedLeadId =
        event.relatedLeadId ??
        (typeof event.metadata?.leadId === 'string' ? event.metadata.leadId : null);

      insertEvent.run(
        event.eventId ?? makeLegacyEventId(event),
        event.eventName,
        event.occurredAt,
        serializeMetadata(event.metadata),
        relatedLeadId
      );
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function getTableColumnNames(db: DatabaseSync, tableName: string) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return new Set(columns.map((column) => column.name));
}

function getLeadColumnNames(db: DatabaseSync) {
  return getTableColumnNames(db, leadsTable);
}

function addNullableColumnIfMissing(db: DatabaseSync, tableName: string, columnName: string, sqlType = 'TEXT') {
  const columns = getTableColumnNames(db, tableName);
  if (!columns.has(columnName)) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${sqlType}`);
  }
}

function addNullableLeadColumnIfMissing(db: DatabaseSync, columnName: string, sqlType = 'TEXT') {
  addNullableColumnIfMissing(db, leadsTable, columnName, sqlType);
}

function ensureCommercialStageColumn(db: DatabaseSync) {
  const columns = getLeadColumnNames(db);
  const hasCommercialStage = columns.has('commercial_stage');

  if (!hasCommercialStage) {
    db.exec(
      `ALTER TABLE ${leadsTable} ADD COLUMN commercial_stage TEXT NOT NULL DEFAULT '${commercialStageModel.defaultStage}'`
    );
  }
}

function ensureLeadCrmColumns(db: DatabaseSync) {
  addNullableLeadColumnIfMissing(db, 'cidade_estado');
  addNullableLeadColumnIfMissing(db, 'ocupacao_perfil');
  addNullableLeadColumnIfMissing(db, 'nivel_de_fit');
  addNullableLeadColumnIfMissing(db, 'motivo_sem_fit');
  addNullableLeadColumnIfMissing(db, 'owner');
  addNullableLeadColumnIfMissing(db, 'data_call_qualificacao');
  addNullableLeadColumnIfMissing(db, 'resumo_call');
  addNullableLeadColumnIfMissing(db, 'interesse_na_oferta');
  addNullableLeadColumnIfMissing(db, 'checklist_onboarding');
  addNullableLeadColumnIfMissing(db, 'cadencia_acordada');
  addNullableLeadColumnIfMissing(db, 'proximo_passo');
  addNullableLeadColumnIfMissing(db, 'risco_de_churn');
}

function ensureReviewQueueColumns(db: DatabaseSync) {
  addNullableColumnIfMissing(db, researchWorkflowsTable, 'review_rejection_reason');
  addNullableColumnIfMissing(db, researchWorkflowsTable, 'reviewed_at');
  addNullableColumnIfMissing(db, memosTable, 'review_rejection_reason');
  addNullableColumnIfMissing(db, memosTable, 'reviewed_at');
}

function ensureCockpitAuthColumns(db: DatabaseSync) {
  // T6 cycle 1: audit_log gains a nullable actor_id to identify individual
  // cockpit users. Legacy rows stay NULL (pre-RBAC) and bearer-secret
  // fallback sessions will write the sentinel 'legacy-secret' (see T7).
  addNullableColumnIfMissing(db, auditLogTable, 'actor_id');
}

export function getDatabase() {
  if (database) {
    return database;
  }

  ensureDataDir();

  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${leadsTable} (
      lead_id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT,
      state TEXT,
      investable_assets_band TEXT NOT NULL,
      primary_challenge TEXT NOT NULL,
      source_channel TEXT NOT NULL,
      source_label TEXT NOT NULL,
      source_campaign TEXT,
      source_medium TEXT,
      source_content TEXT,
      intake_form_version TEXT NOT NULL,
      privacy_consent_accepted INTEGER NOT NULL CHECK (privacy_consent_accepted IN (0, 1)),
      terms_consent_accepted INTEGER NOT NULL CHECK (terms_consent_accepted IN (0, 1)),
      status TEXT NOT NULL,
      commercial_stage TEXT NOT NULL DEFAULT 'intake_novo',
      status_reason TEXT,
      fit_summary TEXT,
      internal_owner TEXT,
      cidade_estado TEXT,
      ocupacao_perfil TEXT,
      nivel_de_fit TEXT,
      motivo_sem_fit TEXT,
      owner TEXT,
      data_call_qualificacao TEXT,
      resumo_call TEXT,
      interesse_na_oferta TEXT,
      checklist_onboarding TEXT,
      cadencia_acordada TEXT,
      proximo_passo TEXT,
      risco_de_churn TEXT,
      submitted_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      first_captured_at TEXT NOT NULL,
      last_status_changed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_intake_leads_created_at ON ${leadsTable}(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_intake_leads_status ON ${leadsTable}(status);

    CREATE TABLE IF NOT EXISTS ${eventsTable} (
      event_id TEXT PRIMARY KEY,
      event_name TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      metadata_json TEXT,
      related_lead_id TEXT,
      FOREIGN KEY (related_lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_intake_events_occurred_at ON ${eventsTable}(occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_intake_events_name ON ${eventsTable}(event_name);

    CREATE TABLE IF NOT EXISTS ${stageAuditTable} (
      audit_id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      note TEXT,
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_stage_audit_lead ON ${stageAuditTable}(lead_id, changed_at DESC);

    CREATE TABLE IF NOT EXISTS ${notesTable} (
      note_id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      content TEXT NOT NULL,
      author_marker TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_internal_notes_lead ON ${notesTable}(lead_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${tasksTable} (
      task_id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      due_date TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_internal_tasks_lead ON ${tasksTable}(lead_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_lead_internal_tasks_status ON ${tasksTable}(lead_id, status);

    CREATE TABLE IF NOT EXISTS ${taskAuditTable} (
      audit_id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      task_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_at TEXT NOT NULL,
      changed_by TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id),
      FOREIGN KEY (task_id) REFERENCES ${tasksTable}(task_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_internal_task_audit_task ON ${taskAuditTable}(task_id, changed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_lead_internal_task_audit_lead ON ${taskAuditTable}(lead_id, changed_at DESC);

    CREATE TABLE IF NOT EXISTS ${billingRecordsTable} (
      billing_record_id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      currency TEXT NOT NULL,
      entry_fee_cents INTEGER NOT NULL,
      monthly_fee_cents INTEGER NOT NULL,
      minimum_commitment_months INTEGER NOT NULL,
      activated_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_billing_records_lead ON ${billingRecordsTable}(lead_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${billingEventsTable} (
      billing_event_id TEXT PRIMARY KEY,
      billing_record_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      actor TEXT NOT NULL,
      note TEXT,
      FOREIGN KEY (billing_record_id) REFERENCES ${billingRecordsTable}(billing_record_id),
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_billing_events_record ON ${billingEventsTable}(billing_record_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_lead_billing_events_lead ON ${billingEventsTable}(lead_id, occurred_at DESC);

    CREATE TABLE IF NOT EXISTS ${billingChargesTable} (
      charge_id TEXT PRIMARY KEY,
      billing_record_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      charge_sequence INTEGER NOT NULL,
      charge_kind TEXT NOT NULL,
      status TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      posted_at TEXT,
      created_at TEXT NOT NULL,
      UNIQUE (billing_record_id, charge_sequence),
      FOREIGN KEY (billing_record_id) REFERENCES ${billingRecordsTable}(billing_record_id),
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_billing_charges_record ON ${billingChargesTable}(billing_record_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_lead_billing_charges_lead ON ${billingChargesTable}(lead_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${billingChargeEventsTable} (
      charge_event_id TEXT PRIMARY KEY,
      charge_id TEXT NOT NULL,
      billing_record_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      actor TEXT NOT NULL,
      note TEXT,
      FOREIGN KEY (charge_id) REFERENCES ${billingChargesTable}(charge_id),
      FOREIGN KEY (billing_record_id) REFERENCES ${billingRecordsTable}(billing_record_id),
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_billing_charge_events_charge ON ${billingChargeEventsTable}(charge_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_lead_billing_charge_events_lead ON ${billingChargeEventsTable}(lead_id, occurred_at DESC);

    CREATE TABLE IF NOT EXISTS ${billingSettlementsTable} (
      settlement_id TEXT PRIMARY KEY,
      charge_id TEXT NOT NULL UNIQUE,
      billing_record_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      status TEXT NOT NULL,
      settlement_kind TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      settled_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (charge_id) REFERENCES ${billingChargesTable}(charge_id),
      FOREIGN KEY (billing_record_id) REFERENCES ${billingRecordsTable}(billing_record_id),
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_billing_settlements_charge ON ${billingSettlementsTable}(charge_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_lead_billing_settlements_lead ON ${billingSettlementsTable}(lead_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${billingSettlementEventsTable} (
      settlement_event_id TEXT PRIMARY KEY,
      settlement_id TEXT NOT NULL,
      charge_id TEXT NOT NULL,
      billing_record_id TEXT NOT NULL,
      lead_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      occurred_at TEXT NOT NULL,
      actor TEXT NOT NULL,
      note TEXT,
      FOREIGN KEY (settlement_id) REFERENCES ${billingSettlementsTable}(settlement_id),
      FOREIGN KEY (charge_id) REFERENCES ${billingChargesTable}(charge_id),
      FOREIGN KEY (billing_record_id) REFERENCES ${billingRecordsTable}(billing_record_id),
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_billing_settlement_events_settlement ON ${billingSettlementEventsTable}(settlement_id, occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_lead_billing_settlement_events_lead ON ${billingSettlementEventsTable}(lead_id, occurred_at DESC);

    CREATE TABLE IF NOT EXISTS ${portalInvitesTable} (
      invite_id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      used_at TEXT,
      revoked_at TEXT,
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_portal_invites_lead ON ${portalInvitesTable}(lead_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_portal_invites_status ON ${portalInvitesTable}(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${portalSessionsTable} (
      session_id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      invite_id TEXT NOT NULL,
      session_token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id),
      FOREIGN KEY (invite_id) REFERENCES ${portalInvitesTable}(invite_id)
    );

    CREATE INDEX IF NOT EXISTS idx_portal_sessions_lead ON ${portalSessionsTable}(lead_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires ON ${portalSessionsTable}(expires_at DESC);

    CREATE TABLE IF NOT EXISTS ${onboardingChecklistItemsTable} (
      item_id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending', 'completed')),
      created_at TEXT NOT NULL,
      completed_at TEXT,
      created_by TEXT NOT NULL,
      completed_by TEXT CHECK (completed_by IN ('client', 'operator') OR completed_by IS NULL),
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_onboarding_checklist_items_lead ON ${onboardingChecklistItemsTable}(lead_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_onboarding_checklist_items_status ON ${onboardingChecklistItemsTable}(lead_id, status, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${leadDocumentsTable} (
      document_id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      stored_filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('received', 'processing', 'accepted', 'rejected')),
      uploaded_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT,
      review_note TEXT,
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_documents_lead ON ${leadDocumentsTable}(lead_id, uploaded_at DESC);
    CREATE INDEX IF NOT EXISTS idx_lead_documents_status ON ${leadDocumentsTable}(lead_id, status, uploaded_at DESC);

    CREATE TABLE IF NOT EXISTS ${leadRecommendationsTable} (
      recommendation_id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      category TEXT CHECK (category IN ('asset_allocation', 'risk_management', 'tax_planning', 'general') OR category IS NULL),
      visibility TEXT NOT NULL CHECK (visibility IN ('draft', 'published')),
      created_at TEXT NOT NULL,
      published_at TEXT,
      created_by TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_recommendations_lead ON ${leadRecommendationsTable}(lead_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_lead_recommendations_visibility ON ${leadRecommendationsTable}(lead_id, visibility, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${researchWorkflowsTable} (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      title TEXT NOT NULL,
      topic TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'in_progress', 'review', 'approved', 'rejected', 'delivered')),
      review_rejection_reason TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_research_workflows_lead ON ${researchWorkflowsTable}(lead_id, updated_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_research_workflows_status ON ${researchWorkflowsTable}(lead_id, status, updated_at DESC);

    CREATE TABLE IF NOT EXISTS ${researchWorkflowEventsTable} (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('approved', 'rejected')),
      reason TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (entity_id) REFERENCES ${researchWorkflowsTable}(id)
    );

    CREATE INDEX IF NOT EXISTS idx_research_workflow_events_entity ON ${researchWorkflowEventsTable}(entity_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${memosTable} (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      research_workflow_id TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'published')),
      review_rejection_reason TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id),
      FOREIGN KEY (research_workflow_id) REFERENCES ${researchWorkflowsTable}(id)
    );

    CREATE INDEX IF NOT EXISTS idx_memos_lead ON ${memosTable}(lead_id, updated_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_memos_status ON ${memosTable}(lead_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_memos_research_workflow ON ${memosTable}(research_workflow_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS ${memoEventsTable} (
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('approved', 'rejected')),
      reason TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (entity_id) REFERENCES ${memosTable}(id)
    );

    CREATE INDEX IF NOT EXISTS idx_memo_events_entity ON ${memoEventsTable}(entity_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${leadPendingFlagsTable} (
      flag_id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL,
      flag_type TEXT NOT NULL CHECK (flag_type IN ('pending_document', 'pending_call', 'pending_payment', 'pending_contract', 'pending_other')),
      note TEXT,
      set_at TEXT NOT NULL,
      set_by TEXT NOT NULL,
      cleared_at TEXT,
      cleared_by TEXT,
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_lead_pending_flags_lead_active ON ${leadPendingFlagsTable}(lead_id, cleared_at, set_at DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_pending_flags_active_unique ON ${leadPendingFlagsTable}(lead_id, flag_type) WHERE cleared_at IS NULL;

    CREATE TABLE IF NOT EXISTS ${auditLogTable} (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      lead_id TEXT,
      actor_type TEXT NOT NULL CHECK (actor_type IN ('operator', 'client', 'system')),
      detail TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON ${auditLogTable}(created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_log_lead ON ${auditLogTable}(lead_id, created_at DESC, id DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action ON ${auditLogTable}(action, created_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS ${aiJobsTable} (
      job_id TEXT PRIMARY KEY,
      lead_id TEXT,
      job_type TEXT NOT NULL,
      surface TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'blocked_budget', 'blocked_guardrail')),
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      model_version_id TEXT,
      prompt_template_id TEXT NOT NULL,
      prompt_template_version TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      input_redaction_level TEXT NOT NULL,
      output_hash TEXT,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cached_input_tokens INTEGER NOT NULL DEFAULT 0,
      cost_cents INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER,
      budget_key TEXT,
      cost_breakdown_json TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      cancelled_at TEXT,
      cancel_reason TEXT,
      error_message TEXT,
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at ON ${aiJobsTable}(created_at DESC, job_id DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_jobs_lead ON ${aiJobsTable}(lead_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ${aiJobsTable}(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${aiArtifactsTable} (
      artifact_id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      lead_id TEXT,
      artifact_type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      json_payload TEXT,
      requires_grounding INTEGER NOT NULL DEFAULT 0 CHECK (requires_grounding IN (0, 1)),
      status TEXT NOT NULL CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'archived')),
      created_at TEXT NOT NULL,
      reviewed_by TEXT,
      reviewed_at TEXT,
      rejection_reason TEXT,
      archived_at TEXT,
      FOREIGN KEY (job_id) REFERENCES ${aiJobsTable}(job_id),
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_artifacts_job ON ${aiArtifactsTable}(job_id);
    CREATE INDEX IF NOT EXISTS idx_ai_artifacts_status ON ${aiArtifactsTable}(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_artifacts_lead ON ${aiArtifactsTable}(lead_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${aiMessagesTable} (
      message_id TEXT PRIMARY KEY,
      lead_id TEXT,
      surface TEXT NOT NULL CHECK (surface IN ('public_chat', 'portal_copilot', 'cockpit_copilot', 'email_inbound', 'email_outbound', 'email_auto_draft', 'whatsapp_inbound', 'whatsapp_outbound', 'marketing_copilot')),
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tool')),
      content TEXT NOT NULL,
      classification TEXT,
      ai_job_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (lead_id) REFERENCES ${leadsTable}(lead_id),
      FOREIGN KEY (ai_job_id) REFERENCES ${aiJobsTable}(job_id)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_messages_lead_surface ON ${aiMessagesTable}(lead_id, surface, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_messages_job ON ${aiMessagesTable}(ai_job_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${aiPromptTemplatesTable} (
      template_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      purpose TEXT NOT NULL,
      body TEXT NOT NULL,
      output_schema TEXT,
      requires_grounding INTEGER NOT NULL DEFAULT 0 CHECK (requires_grounding IN (0, 1)),
      model_compatibility_min TEXT,
      model_compatibility_max TEXT,
      allowed_surfaces TEXT,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL,
      deactivated_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_prompt_templates_name_version ON ${aiPromptTemplatesTable}(name, version);

    CREATE TABLE IF NOT EXISTS ${aiGuardrailResultsTable} (
      result_id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      rule_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pass', 'warn', 'block')),
      detail TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES ${aiJobsTable}(job_id)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_guardrail_results_job ON ${aiGuardrailResultsTable}(job_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${aiBudgetCapsTable} (
      cap_id TEXT PRIMARY KEY,
      scope_type TEXT NOT NULL CHECK (scope_type IN ('global', 'surface', 'job_type', 'lead')),
      scope_value TEXT NOT NULL,
      period TEXT NOT NULL CHECK (period IN ('day', 'month')),
      cap_cents INTEGER NOT NULL,
      action_on_exceed TEXT NOT NULL CHECK (action_on_exceed IN ('warn', 'block')),
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deactivated_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_budget_caps_scope ON ${aiBudgetCapsTable}(scope_type, scope_value, period);

    CREATE TABLE IF NOT EXISTS ${aiModelVersionsTable} (
      model_version_id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      model_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('candidate', 'active', 'deprecated', 'blocked')),
      input_price_json TEXT,
      output_price_json TEXT,
      pinned_at TEXT,
      deprecated_at TEXT,
      blocked_at TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_model_versions_provider_model ON ${aiModelVersionsTable}(provider, model_id, status) WHERE status = 'active';
    CREATE INDEX IF NOT EXISTS idx_ai_model_versions_status ON ${aiModelVersionsTable}(status, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${aiEvalCasesTable} (
      case_id TEXT PRIMARY KEY,
      surface TEXT NOT NULL,
      name TEXT NOT NULL,
      input_json TEXT NOT NULL,
      expected_constraints_json TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
      created_at TEXT NOT NULL,
      deactivated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_ai_eval_cases_surface_active ON ${aiEvalCasesTable}(surface, active);

    CREATE TABLE IF NOT EXISTS ${aiEvalRunsTable} (
      run_id TEXT PRIMARY KEY,
      model_version_id TEXT NOT NULL,
      prompt_template_id TEXT NOT NULL,
      case_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pass', 'warn', 'fail')),
      metrics_json TEXT,
      output_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (model_version_id) REFERENCES ${aiModelVersionsTable}(model_version_id),
      FOREIGN KEY (prompt_template_id) REFERENCES ${aiPromptTemplatesTable}(template_id),
      FOREIGN KEY (case_id) REFERENCES ${aiEvalCasesTable}(case_id)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_eval_runs_case ON ${aiEvalRunsTable}(case_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_ai_eval_runs_model_version ON ${aiEvalRunsTable}(model_version_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ${cockpitUsersTable} (
      user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
      password_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cockpit_users_email ON ${cockpitUsersTable}(email);
    CREATE INDEX IF NOT EXISTS idx_cockpit_users_role_active ON ${cockpitUsersTable}(role, is_active);

    CREATE TABLE IF NOT EXISTS ${cockpitSessionsTable} (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_token TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES ${cockpitUsersTable}(user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_cockpit_sessions_token ON ${cockpitSessionsTable}(session_token);
    CREATE INDEX IF NOT EXISTS idx_cockpit_sessions_user ON ${cockpitSessionsTable}(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cockpit_sessions_expires ON ${cockpitSessionsTable}(expires_at DESC);
  `);

  ensureCommercialStageColumn(db);
  ensureLeadCrmColumns(db);
  ensureReviewQueueColumns(db);
  ensureCockpitAuthColumns(db);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_intake_leads_commercial_stage ON ${leadsTable}(commercial_stage);`);
  migrateLegacyJsonlData(db);

  database = db;
  return db;
}

export function normalizeLeadBillingRecord(row: Record<string, unknown>): LeadBillingRecord | null {
  if (!row.status || typeof row.status !== 'string') {
    return null;
  }

  return {
    billingRecordId: String(row.billingRecordId),
    leadId: String(row.leadId),
    status: row.status as LeadBillingRecord['status'],
    currency: String(row.currency),
    entryFeeCents: Number(row.entryFeeCents),
    monthlyFeeCents: Number(row.monthlyFeeCents),
    minimumCommitmentMonths: Number(row.minimumCommitmentMonths),
    activatedAt: row.activatedAt === null ? null : String(row.activatedAt),
    createdAt: String(row.createdAt)
  };
}

export function normalizeLeadBillingCharge(row: Record<string, unknown>): LeadBillingCharge | null {
  if (!row.status || typeof row.status !== 'string') {
    return null;
  }

  return {
    chargeId: String(row.chargeId),
    billingRecordId: String(row.billingRecordId),
    leadId: String(row.leadId),
    chargeSequence: Number(row.chargeSequence),
    chargeKind: String(row.chargeKind),
    status: row.status as LeadBillingCharge['status'],
    currency: String(row.currency),
    amountCents: Number(row.amountCents),
    dueDate: String(row.dueDate),
    postedAt: row.postedAt === null ? null : String(row.postedAt),
    createdAt: String(row.createdAt)
  };
}

export function normalizeLeadBillingSettlement(row: Record<string, unknown>): LeadBillingSettlement | null {
  if (!row.status || typeof row.status !== 'string') {
    return null;
  }

  return {
    settlementId: String(row.settlementId),
    chargeId: String(row.chargeId),
    billingRecordId: String(row.billingRecordId),
    leadId: String(row.leadId),
    status: row.status as LeadBillingSettlement['status'],
    settlementKind: String(row.settlementKind),
    currency: String(row.currency),
    amountCents: Number(row.amountCents),
    settledAt: String(row.settledAt),
    createdAt: String(row.createdAt)
  };
}

export function getIntakeStoragePaths() {
  return {
    database: databasePath,
    leadsTable,
    eventsTable,
    stageAuditTable,
    notesTable,
    tasksTable,
    taskAuditTable,
    billingRecordsTable,
    billingEventsTable,
    billingChargesTable,
    billingChargeEventsTable,
    billingSettlementsTable,
    billingSettlementEventsTable,
    portalInvitesTable,
    portalSessionsTable,
    onboardingChecklistItemsTable,
    leadDocumentsTable,
    leadRecommendationsTable,
    researchWorkflowsTable,
    researchWorkflowEventsTable,
    memosTable,
    memoEventsTable,
    leadPendingFlagsTable,
    auditLogTable,
    cockpitUsersTable,
    cockpitSessionsTable
  };
}
