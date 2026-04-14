import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  intakeAnalyticsEvents,
  intakeContract,
  type IntakeAnalyticsEvent,
  type LeadStatus,
  type PublicIntakePayload,
  type SourceChannel
} from '@bruno-advisory/core/intake-contract';
import {
  billingEntryTaskStates,
  evaluateBillingEntryReadiness,
  type BillingEntryEvaluation,
  commercialStageModel,
  isLocalBillingChargeEventType,
  isLocalBillingChargeStatus,
  isLocalBillingEventType,
  isLocalBillingRecordStatus,
  isLocalBillingSettlementEventType,
  isLocalBillingSettlementStatus,
  isOperatorCommercialStage,
  localBillingChargeModel,
  localBillingChargeProgressionModel,
  localBillingModel,
  localBillingOverviewModel,
  localBillingSettlementModel,
  localBillingSettlementTargetingModel,
  type LocalBillingChargeEventType,
  type LocalBillingChargeStatus,
  type LocalBillingEventType,
  type LocalBillingRecordStatus,
  type LocalBillingSettlementEventType,
  type LocalBillingSettlementStatus,
  type OperatorCommercialStage
} from '@bruno-advisory/core';

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
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  firstCapturedAt: string;
  lastStatusChangedAt: string;
};

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
      throw new Error(`Could not locate Bruno Advisory repo root from ${startDir}`);
    }

    currentDir = parentDir;
  }
}

const repoRoot = findRepoRoot(process.cwd());
const dataDir = path.join(repoRoot, 'data', 'dev');
const databasePath = path.join(dataDir, 'bruno-advisory-dev.sqlite3');
const legacyLeadsJsonlPath = path.join(dataDir, 'intake-leads.jsonl');
const legacyEventsJsonlPath = path.join(dataDir, 'intake-events.jsonl');
const leadsTable = 'intake_leads';
const eventsTable = 'intake_events';
const stageAuditTable = 'lead_stage_audit';
const notesTable = 'lead_internal_notes';
const tasksTable = 'lead_internal_tasks';
const taskAuditTable = 'lead_internal_task_audit';
const billingRecordsTable = 'lead_billing_records';
const billingEventsTable = 'lead_billing_events';
const billingChargesTable = 'lead_billing_charges';
const billingChargeEventsTable = 'lead_billing_charge_events';
const billingSettlementsTable = 'lead_billing_settlements';
const billingSettlementEventsTable = 'lead_billing_settlement_events';

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

function serializeMetadata(metadata?: Record<string, string | number | boolean | null>) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }

  return JSON.stringify(metadata);
}

function parseMetadata(raw: unknown) {
  if (typeof raw !== 'string' || raw.length === 0) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as Record<string, string | number | boolean | null>;
  } catch {
    return undefined;
  }
}

function toOptionalString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function toOptionalDateString(value: string | undefined) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

export function isLeadTaskStatus(value: unknown): value is LeadTaskStatus {
  return typeof value === 'string' && leadTaskStatuses.includes(value as LeadTaskStatus);
}

function normalizeLeadRow(row: Record<string, unknown>): StoredLead {
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

function ensureCommercialStageColumn(db: DatabaseSync) {
  const columns = db.prepare(`PRAGMA table_info(${leadsTable})`).all() as Array<{ name: string }>;
  const hasCommercialStage = columns.some((column) => column.name === 'commercial_stage');

  if (!hasCommercialStage) {
    db.exec(
      `ALTER TABLE ${leadsTable} ADD COLUMN commercial_stage TEXT NOT NULL DEFAULT '${commercialStageModel.defaultStage}'`
    );
  }
}

function getDatabase() {
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
  `);

  ensureCommercialStageColumn(db);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_intake_leads_commercial_stage ON ${leadsTable}(commercial_stage);`);
  migrateLegacyJsonlData(db);

  database = db;
  return db;
}

export function recordIntakeEvent(record: IntakeEventRecord) {
  if (!intakeAnalyticsEvents.includes(record.eventName)) {
    throw new Error(`Evento de analytics fora do contrato: ${record.eventName}`);
  }

  const db = getDatabase();
  const insertEvent = db.prepare(`
    INSERT INTO ${eventsTable} (
      event_id,
      event_name,
      occurred_at,
      metadata_json,
      related_lead_id
    ) VALUES (?, ?, ?, ?, ?)
  `);

  const relatedLeadId =
    record.relatedLeadId ??
    (typeof record.metadata?.leadId === 'string' ? record.metadata.leadId : null);

  insertEvent.run(
    record.eventId ?? randomUUID(),
    record.eventName,
    record.occurredAt,
    serializeMetadata(record.metadata),
    relatedLeadId
  );
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
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    firstCapturedAt: now,
    lastStatusChangedAt: now
  };

  const db = getDatabase();
  const insertLead = db.prepare(`
    INSERT INTO ${leadsTable} (
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
    lead.commercialStage,
    lead.statusReason,
    lead.fitSummary,
    lead.internalOwner,
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
  const rows = db
    .prepare(`
      SELECT
        lead_id AS leadId,
        full_name AS fullName,
        email AS email,
        phone AS phone,
        city AS city,
        state AS state,
        investable_assets_band AS investableAssetsBand,
        primary_challenge AS primaryChallenge,
        source_channel AS sourceChannel,
        source_label AS sourceLabel,
        source_campaign AS sourceCampaign,
        source_medium AS sourceMedium,
        source_content AS sourceContent,
        intake_form_version AS intakeFormVersion,
        privacy_consent_accepted AS privacyConsentAccepted,
        terms_consent_accepted AS termsConsentAccepted,
        status AS status,
        commercial_stage AS commercialStage,
        status_reason AS statusReason,
        fit_summary AS fitSummary,
        internal_owner AS internalOwner,
        submitted_at AS submittedAt,
        created_at AS createdAt,
        updated_at AS updatedAt,
        first_captured_at AS firstCapturedAt,
        last_status_changed_at AS lastStatusChangedAt
      FROM ${leadsTable}
      ORDER BY created_at DESC, lead_id DESC
    `)
    .all() as Record<string, unknown>[];

  return rows.map(normalizeLeadRow);
}

export function getStoredLeadById(leadId: string) {
  const db = getDatabase();
  const row = db
    .prepare(`
      SELECT
        lead_id AS leadId,
        full_name AS fullName,
        email AS email,
        phone AS phone,
        city AS city,
        state AS state,
        investable_assets_band AS investableAssetsBand,
        primary_challenge AS primaryChallenge,
        source_channel AS sourceChannel,
        source_label AS sourceLabel,
        source_campaign AS sourceCampaign,
        source_medium AS sourceMedium,
        source_content AS sourceContent,
        intake_form_version AS intakeFormVersion,
        privacy_consent_accepted AS privacyConsentAccepted,
        terms_consent_accepted AS termsConsentAccepted,
        status AS status,
        commercial_stage AS commercialStage,
        status_reason AS statusReason,
        fit_summary AS fitSummary,
        internal_owner AS internalOwner,
        submitted_at AS submittedAt,
        created_at AS createdAt,
        updated_at AS updatedAt,
        first_captured_at AS firstCapturedAt,
        last_status_changed_at AS lastStatusChangedAt
      FROM ${leadsTable}
      WHERE lead_id = ?
      LIMIT 1
    `)
    .get(leadId) as Record<string, unknown> | undefined;

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
    .prepare(
      `SELECT lead_id AS leadId, commercial_stage AS commercialStage FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`
    )
    .get(params.leadId) as { leadId: string; commercialStage: unknown } | undefined;

  if (!currentLead) {
    return null;
  }

  const fromStage = isOperatorCommercialStage(currentLead.commercialStage)
    ? currentLead.commercialStage
    : commercialStageModel.defaultStage;

  db.exec('BEGIN');
  try {
    db.prepare(
      `UPDATE ${leadsTable} SET commercial_stage = ?, updated_at = ?, last_status_changed_at = ? WHERE lead_id = ?`
    ).run(params.toStage, now, now, params.leadId);

    db.prepare(
      `INSERT INTO ${stageAuditTable} (audit_id, lead_id, from_stage, to_stage, changed_at, changed_by, note) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(randomUUID(), params.leadId, fromStage, params.toStage, now, params.changedBy, cleanNote || null);

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

export function listLeadCommercialStageAudit(leadId: string, limit = 50): LeadCommercialStageAuditRecord[] {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT
        audit_id AS auditId,
        lead_id AS leadId,
        from_stage AS fromStage,
        to_stage AS toStage,
        changed_at AS changedAt,
        changed_by AS changedBy,
        note AS note
      FROM ${stageAuditTable}
      WHERE lead_id = ?
      ORDER BY changed_at DESC, audit_id DESC
      LIMIT ?
    `)
    .all(leadId, limit) as Record<string, unknown>[];

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

export function createLeadInternalNote(params: {
  leadId: string;
  content: string;
  authorMarker: string;
}): LeadInternalNote | null {
  const db = getDatabase();
  const now = new Date().toISOString();
  const cleanContent = params.content.trim();
  const cleanAuthor = params.authorMarker.trim();

  if (!cleanContent || !cleanAuthor) {
    return null;
  }

  const leadExists = db.prepare(`SELECT 1 FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`).get(params.leadId);
  if (!leadExists) {
    return null;
  }

  const noteId = randomUUID();
  db.prepare(
    `INSERT INTO ${notesTable} (note_id, lead_id, content, author_marker, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(noteId, params.leadId, cleanContent, cleanAuthor, now);

  return {
    noteId,
    leadId: params.leadId,
    content: cleanContent,
    authorMarker: cleanAuthor,
    createdAt: now
  };
}

export function listLeadInternalNotes(leadId: string, limit = 100): LeadInternalNote[] {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT
        note_id AS noteId,
        lead_id AS leadId,
        content AS content,
        author_marker AS authorMarker,
        created_at AS createdAt
      FROM ${notesTable}
      WHERE lead_id = ?
      ORDER BY created_at DESC, note_id DESC
      LIMIT ?
    `)
    .all(leadId, limit) as Record<string, unknown>[];

  return rows.map((row) => ({
    noteId: String(row.noteId),
    leadId: String(row.leadId),
    content: String(row.content),
    authorMarker: String(row.authorMarker),
    createdAt: String(row.createdAt)
  }));
}

export function createLeadInternalTask(params: {
  leadId: string;
  title: string;
  status: LeadTaskStatus;
  dueDate?: string;
}): LeadInternalTask | null {
  const db = getDatabase();
  const now = new Date().toISOString();
  const cleanTitle = params.title.trim();

  if (!cleanTitle || !isLeadTaskStatus(params.status)) {
    return null;
  }

  const leadExists = db.prepare(`SELECT 1 FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`).get(params.leadId);
  if (!leadExists) {
    return null;
  }

  const dueDate = toOptionalDateString(params.dueDate);
  const taskId = randomUUID();
  db.prepare(
    `INSERT INTO ${tasksTable} (task_id, lead_id, title, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(taskId, params.leadId, cleanTitle, params.status, dueDate, now);

  return {
    taskId,
    leadId: params.leadId,
    title: cleanTitle,
    status: params.status,
    dueDate,
    createdAt: now
  };
}

export function listLeadInternalTasks(leadId: string, limit = 100): LeadInternalTask[] {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT
        task_id AS taskId,
        lead_id AS leadId,
        title AS title,
        status AS status,
        due_date AS dueDate,
        created_at AS createdAt
      FROM ${tasksTable}
      WHERE lead_id = ?
      ORDER BY created_at DESC, task_id DESC
      LIMIT ?
    `)
    .all(leadId, limit) as Record<string, unknown>[];

  return rows.filter((row) => isLeadTaskStatus(row.status)).map((row) => ({
    taskId: String(row.taskId),
    leadId: String(row.leadId),
    title: String(row.title),
    status: row.status as LeadTaskStatus,
    dueDate: row.dueDate === null ? null : String(row.dueDate),
    createdAt: String(row.createdAt)
  }));
}

export function updateLeadInternalTaskStatus(params: {
  leadId: string;
  taskId: string;
  toStatus: LeadTaskStatus;
  changedBy: string;
}) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const cleanChangedBy = params.changedBy.trim();

  if (!isLeadTaskStatus(params.toStatus) || !cleanChangedBy) {
    return null;
  }

  const taskRow = db
    .prepare(
      `SELECT task_id AS taskId, lead_id AS leadId, title AS title, status AS status, due_date AS dueDate, created_at AS createdAt
       FROM ${tasksTable}
       WHERE task_id = ? AND lead_id = ?
       LIMIT 1`
    )
    .get(params.taskId, params.leadId) as Record<string, unknown> | undefined;

  if (!taskRow || !isLeadTaskStatus(taskRow.status)) {
    return null;
  }

  const fromStatus = taskRow.status as LeadTaskStatus;

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE ${tasksTable} SET status = ? WHERE task_id = ? AND lead_id = ?`).run(
      params.toStatus,
      params.taskId,
      params.leadId
    );

    db.prepare(
      `INSERT INTO ${taskAuditTable} (audit_id, lead_id, task_id, from_status, to_status, changed_at, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      params.leadId,
      params.taskId,
      fromStatus,
      params.toStatus,
      now,
      cleanChangedBy
    );

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    task: {
      taskId: String(taskRow.taskId),
      leadId: String(taskRow.leadId),
      title: String(taskRow.title),
      status: params.toStatus,
      dueDate: taskRow.dueDate === null ? null : String(taskRow.dueDate),
      createdAt: String(taskRow.createdAt)
    } satisfies LeadInternalTask,
    changedFrom: fromStatus,
    changedTo: params.toStatus,
    changedAt: now,
    changedBy: cleanChangedBy
  };
}

export function listLeadInternalTaskAudit(leadId: string, taskId: string, limit = 100): LeadInternalTaskAuditRecord[] {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT
        audit_id AS auditId,
        lead_id AS leadId,
        task_id AS taskId,
        from_status AS fromStatus,
        to_status AS toStatus,
        changed_at AS changedAt,
        changed_by AS changedBy
      FROM ${taskAuditTable}
      WHERE lead_id = ? AND task_id = ?
      ORDER BY changed_at DESC, audit_id DESC
      LIMIT ?
    `)
    .all(leadId, taskId, limit) as Record<string, unknown>[];

  return rows
    .filter((row) => isLeadTaskStatus(row.toStatus))
    .map((row) => ({
      auditId: String(row.auditId),
      leadId: String(row.leadId),
      taskId: String(row.taskId),
      fromStatus: isLeadTaskStatus(row.fromStatus) ? row.fromStatus : null,
      toStatus: row.toStatus as LeadTaskStatus,
      changedAt: String(row.changedAt),
      changedBy: String(row.changedBy)
    }));
}

function normalizeLeadBillingRecord(row: Record<string, unknown>): LeadBillingRecord | null {
  if (!isLocalBillingRecordStatus(row.status)) {
    return null;
  }

  return {
    billingRecordId: String(row.billingRecordId),
    leadId: String(row.leadId),
    status: row.status as LocalBillingRecordStatus,
    currency: String(row.currency),
    entryFeeCents: Number(row.entryFeeCents),
    monthlyFeeCents: Number(row.monthlyFeeCents),
    minimumCommitmentMonths: Number(row.minimumCommitmentMonths),
    activatedAt: row.activatedAt === null ? null : String(row.activatedAt),
    createdAt: String(row.createdAt)
  };
}

function normalizeLeadBillingCharge(row: Record<string, unknown>): LeadBillingCharge | null {
  if (!isLocalBillingChargeStatus(row.status)) {
    return null;
  }

  return {
    chargeId: String(row.chargeId),
    billingRecordId: String(row.billingRecordId),
    leadId: String(row.leadId),
    chargeSequence: Number(row.chargeSequence),
    chargeKind: String(row.chargeKind),
    status: row.status as LocalBillingChargeStatus,
    currency: String(row.currency),
    amountCents: Number(row.amountCents),
    dueDate: String(row.dueDate),
    postedAt: row.postedAt === null ? null : String(row.postedAt),
    createdAt: String(row.createdAt)
  };
}

function normalizeLeadBillingSettlement(row: Record<string, unknown>): LeadBillingSettlement | null {
  if (!isLocalBillingSettlementStatus(row.status)) {
    return null;
  }

  return {
    settlementId: String(row.settlementId),
    chargeId: String(row.chargeId),
    billingRecordId: String(row.billingRecordId),
    leadId: String(row.leadId),
    status: row.status as LocalBillingSettlementStatus,
    settlementKind: String(row.settlementKind),
    currency: String(row.currency),
    amountCents: Number(row.amountCents),
    settledAt: String(row.settledAt),
    createdAt: String(row.createdAt)
  };
}

export function getLeadBillingRecord(leadId: string): LeadBillingRecord | null {
  const db = getDatabase();
  const row = db
    .prepare(`
      SELECT
        billing_record_id AS billingRecordId,
        lead_id AS leadId,
        status AS status,
        currency AS currency,
        entry_fee_cents AS entryFeeCents,
        monthly_fee_cents AS monthlyFeeCents,
        minimum_commitment_months AS minimumCommitmentMonths,
        activated_at AS activatedAt,
        created_at AS createdAt
      FROM ${billingRecordsTable}
      WHERE lead_id = ?
      LIMIT 1
    `)
    .get(leadId) as Record<string, unknown> | undefined;

  return row ? normalizeLeadBillingRecord(row) : null;
}

export function listLeadBillingEvents(leadId: string, limit = 100): LeadBillingEvent[] {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT
        billing_event_id AS billingEventId,
        billing_record_id AS billingRecordId,
        lead_id AS leadId,
        event_type AS eventType,
        occurred_at AS occurredAt,
        actor AS actor,
        note AS note
      FROM ${billingEventsTable}
      WHERE lead_id = ?
      ORDER BY occurred_at DESC, billing_event_id DESC
      LIMIT ?
    `)
    .all(leadId, limit) as Record<string, unknown>[];

  return rows
    .filter((row) => isLocalBillingEventType(row.eventType))
    .map((row) => ({
      billingEventId: String(row.billingEventId),
      billingRecordId: String(row.billingRecordId),
      leadId: String(row.leadId),
      eventType: row.eventType as LocalBillingEventType,
      occurredAt: String(row.occurredAt),
      actor: String(row.actor),
      note: row.note === null ? null : String(row.note)
    }));
}

export function getLeadBillingCharge(leadId: string): LeadBillingCharge | null {
  const db = getDatabase();
  const row = db
    .prepare(`
      SELECT
        charge_id AS chargeId,
        billing_record_id AS billingRecordId,
        lead_id AS leadId,
        charge_sequence AS chargeSequence,
        charge_kind AS chargeKind,
        status AS status,
        currency AS currency,
        amount_cents AS amountCents,
        due_date AS dueDate,
        posted_at AS postedAt,
        created_at AS createdAt
      FROM ${billingChargesTable}
      WHERE lead_id = ?
      ORDER BY charge_sequence DESC, created_at DESC, charge_id DESC
      LIMIT 1
    `)
    .get(leadId) as Record<string, unknown> | undefined;

  return row ? normalizeLeadBillingCharge(row) : null;
}

export function listLeadBillingCharges(leadId: string, limit = 100): LeadBillingCharge[] {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT
        charge_id AS chargeId,
        billing_record_id AS billingRecordId,
        lead_id AS leadId,
        charge_sequence AS chargeSequence,
        charge_kind AS chargeKind,
        status AS status,
        currency AS currency,
        amount_cents AS amountCents,
        due_date AS dueDate,
        posted_at AS postedAt,
        created_at AS createdAt
      FROM ${billingChargesTable}
      WHERE lead_id = ?
      ORDER BY charge_sequence DESC, created_at DESC, charge_id DESC
      LIMIT ?
    `)
    .all(leadId, limit) as Record<string, unknown>[];

  return rows.map((row) => normalizeLeadBillingCharge(row)).filter((row): row is LeadBillingCharge => row !== null);
}

export function getBillingChargeById(chargeId: string): LeadBillingCharge | null {
  const db = getDatabase();
  const row = db
    .prepare(`
      SELECT
        charge_id AS chargeId,
        billing_record_id AS billingRecordId,
        lead_id AS leadId,
        charge_sequence AS chargeSequence,
        charge_kind AS chargeKind,
        status AS status,
        currency AS currency,
        amount_cents AS amountCents,
        due_date AS dueDate,
        posted_at AS postedAt,
        created_at AS createdAt
      FROM ${billingChargesTable}
      WHERE charge_id = ?
      LIMIT 1
    `)
    .get(chargeId) as Record<string, unknown> | undefined;

  return row ? normalizeLeadBillingCharge(row) : null;
}

export function listLeadBillingChargeEvents(leadId: string, limit = 100): LeadBillingChargeEvent[] {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT
        charge_event_id AS chargeEventId,
        charge_id AS chargeId,
        billing_record_id AS billingRecordId,
        lead_id AS leadId,
        event_type AS eventType,
        occurred_at AS occurredAt,
        actor AS actor,
        note AS note
      FROM ${billingChargeEventsTable}
      WHERE lead_id = ?
      ORDER BY occurred_at DESC, charge_event_id DESC
      LIMIT ?
    `)
    .all(leadId, limit) as Record<string, unknown>[];

  return rows
    .filter((row) => isLocalBillingChargeEventType(row.eventType))
    .map((row) => ({
      chargeEventId: String(row.chargeEventId),
      chargeId: String(row.chargeId),
      billingRecordId: String(row.billingRecordId),
      leadId: String(row.leadId),
      eventType: row.eventType as LocalBillingChargeEventType,
      occurredAt: String(row.occurredAt),
      actor: String(row.actor),
      note: row.note === null ? null : String(row.note)
    }));
}

export function getLeadBillingSettlement(chargeId: string): LeadBillingSettlement | null {
  const db = getDatabase();
  const row = db
    .prepare(`
      SELECT
        settlement_id AS settlementId,
        charge_id AS chargeId,
        billing_record_id AS billingRecordId,
        lead_id AS leadId,
        status AS status,
        settlement_kind AS settlementKind,
        currency AS currency,
        amount_cents AS amountCents,
        settled_at AS settledAt,
        created_at AS createdAt
      FROM ${billingSettlementsTable}
      WHERE charge_id = ?
      LIMIT 1
    `)
    .get(chargeId) as Record<string, unknown> | undefined;

  return row ? normalizeLeadBillingSettlement(row) : null;
}

export function listLeadBillingSettlements(leadId: string, limit = 100): LeadBillingSettlement[] {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT
        settlement_id AS settlementId,
        charge_id AS chargeId,
        billing_record_id AS billingRecordId,
        lead_id AS leadId,
        status AS status,
        settlement_kind AS settlementKind,
        currency AS currency,
        amount_cents AS amountCents,
        settled_at AS settledAt,
        created_at AS createdAt
      FROM ${billingSettlementsTable}
      WHERE lead_id = ?
      ORDER BY settled_at DESC, settlement_id DESC
      LIMIT ?
    `)
    .all(leadId, limit) as Record<string, unknown>[];

  return rows.map((row) => normalizeLeadBillingSettlement(row)).filter((row): row is LeadBillingSettlement => row !== null);
}

export function listLeadBillingSettlementEvents(leadId: string, limit = 100): LeadBillingSettlementEvent[] {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT
        settlement_event_id AS settlementEventId,
        settlement_id AS settlementId,
        charge_id AS chargeId,
        billing_record_id AS billingRecordId,
        lead_id AS leadId,
        event_type AS eventType,
        occurred_at AS occurredAt,
        actor AS actor,
        note AS note
      FROM ${billingSettlementEventsTable}
      WHERE lead_id = ?
      ORDER BY occurred_at DESC, settlement_event_id DESC
      LIMIT ?
    `)
    .all(leadId, limit) as Record<string, unknown>[];

  return rows
    .filter((row) => isLocalBillingSettlementEventType(row.eventType))
    .map((row) => ({
      settlementEventId: String(row.settlementEventId),
      settlementId: String(row.settlementId),
      chargeId: String(row.chargeId),
      billingRecordId: String(row.billingRecordId),
      leadId: String(row.leadId),
      eventType: row.eventType as LocalBillingSettlementEventType,
      occurredAt: String(row.occurredAt),
      actor: String(row.actor),
      note: row.note === null ? null : String(row.note)
    }));
}

function addMonthsToDate(date: Date, months: number) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function toChargeDueDate(billingRecord: LeadBillingRecord) {
  const baseDate = billingRecord.activatedAt ? new Date(billingRecord.activatedAt) : new Date(billingRecord.createdAt);
  return addMonthsToDate(baseDate, 1).toISOString().slice(0, 10);
}

function parseUtcDateOnly(dateOnly: string) {
  return new Date(`${dateOnly}T00:00:00.000Z`);
}

function toNextChargeDueDate(previousCharge: LeadBillingCharge) {
  return addMonthsToDate(parseUtcDateOnly(previousCharge.dueDate), 1).toISOString().slice(0, 10);
}

export function getLeadBillingReadiness(leadId: string): LeadBillingReadiness | null {
  const lead = getStoredLeadById(leadId);
  if (!lead) {
    return null;
  }

  const tasks = listLeadInternalTasks(leadId, 1000);
  const evaluation = evaluateBillingEntryReadiness({
    commercialStage: lead.commercialStage,
    taskStates: tasks.map((task) => task.status)
  });

  return {
    leadId: lead.leadId,
    ...evaluation
  };
}

export function createLeadLocalBillingRecord(params: { leadId: string; actor: string; note?: string }) {
  const db = getDatabase();
  const cleanActor = params.actor.trim();
  const cleanNote = params.note?.trim();

  if (!cleanActor) {
    return { ok: false as const, code: 'INVALID_ACTOR', error: 'actor obrigatorio.' };
  }

  const lead = getStoredLeadById(params.leadId);
  if (!lead) {
    return { ok: false as const, code: 'LEAD_NOT_FOUND', error: 'Lead nao encontrado.' };
  }

  const existingRecord = getLeadBillingRecord(params.leadId);
  if (existingRecord) {
    return {
      ok: false as const,
      code: 'BILLING_RECORD_EXISTS',
      error: 'Billing local ja foi criado para este lead.',
      billingRecord: existingRecord
    };
  }

  const readiness = getLeadBillingReadiness(params.leadId);
  if (!readiness) {
    return { ok: false as const, code: 'LEAD_NOT_FOUND', error: 'Lead nao encontrado.' };
  }

  if (!readiness.isBillingReady) {
    return {
      ok: false as const,
      code: 'BILLING_NOT_READY',
      error: 'Lead ainda nao atende as condicoes minimas para entrar em billing local.',
      readiness
    };
  }

  const now = new Date().toISOString();
  const billingRecordId = randomUUID();
  const recordStatus = localBillingModel.initialRecordStatus;
  const activatedAt = recordStatus === 'active_local' ? now : null;

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO ${billingRecordsTable} (
        billing_record_id,
        lead_id,
        status,
        currency,
        entry_fee_cents,
        monthly_fee_cents,
        minimum_commitment_months,
        activated_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      billingRecordId,
      params.leadId,
      recordStatus,
      localBillingModel.pricingDefaults.currency,
      localBillingModel.pricingDefaults.entryFeeCents,
      localBillingModel.pricingDefaults.monthlyFeeCents,
      localBillingModel.pricingDefaults.minimumCommitmentMonths,
      activatedAt,
      now
    );

    db.prepare(`
      INSERT INTO ${billingEventsTable} (
        billing_event_id,
        billing_record_id,
        lead_id,
        event_type,
        occurred_at,
        actor,
        note
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), billingRecordId, params.leadId, 'billing_record_created', now, cleanActor, cleanNote || null);

    if (recordStatus === 'active_local') {
      db.prepare(`
        INSERT INTO ${billingEventsTable} (
          billing_event_id,
          billing_record_id,
          lead_id,
          event_type,
          occurred_at,
          actor,
          note
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        billingRecordId,
        params.leadId,
        'billing_record_activated',
        now,
        cleanActor,
        'Lead entrou em operacao billable local.'
      );
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    ok: true as const,
    lead,
    readiness,
    billingRecord: getLeadBillingRecord(params.leadId)!,
    billingEvents: listLeadBillingEvents(params.leadId, 20)
  };
}


export function createLeadLocalBillingCharge(params: { leadId: string; actor: string; note?: string }) {
  const db = getDatabase();
  const cleanActor = params.actor.trim();
  const cleanNote = params.note?.trim();

  if (!cleanActor) {
    return { ok: false as const, code: 'INVALID_ACTOR', error: 'actor obrigatorio.' };
  }

  const lead = getStoredLeadById(params.leadId);
  if (!lead) {
    return { ok: false as const, code: 'LEAD_NOT_FOUND', error: 'Lead nao encontrado.' };
  }

  const billingRecord = getLeadBillingRecord(params.leadId);
  if (!billingRecord || billingRecord.status !== 'active_local') {
    return {
      ok: false as const,
      code: 'ACTIVE_BILLING_RECORD_REQUIRED',
      error: 'Lead precisa ter billing local ativo antes de criar a primeira cobranca.'
    };
  }

  const existingCharge = getLeadBillingCharge(params.leadId);
  if (existingCharge) {
    return {
      ok: false as const,
      code: 'CHARGE_ALREADY_EXISTS',
      error: 'A primeira cobranca local recorrente ja foi criada para este lead.',
      billingRecord,
      charge: existingCharge
    };
  }

  const now = new Date().toISOString();
  const chargeId = randomUUID();
  const dueDate = toChargeDueDate(billingRecord);

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO ${billingChargesTable} (
        charge_id,
        billing_record_id,
        lead_id,
        charge_sequence,
        charge_kind,
        status,
        currency,
        amount_cents,
        due_date,
        posted_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      chargeId,
      billingRecord.billingRecordId,
      params.leadId,
      localBillingChargeModel.firstChargeSequence,
      localBillingChargeModel.firstChargeKind,
      localBillingChargeModel.initialChargeStatus,
      billingRecord.currency,
      billingRecord.monthlyFeeCents,
      dueDate,
      now,
      now
    );

    db.prepare(`
      INSERT INTO ${billingChargeEventsTable} (
        charge_event_id,
        charge_id,
        billing_record_id,
        lead_id,
        event_type,
        occurred_at,
        actor,
        note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      chargeId,
      billingRecord.billingRecordId,
      params.leadId,
      'charge_created',
      now,
      cleanActor,
      cleanNote || 'Primeira cobranca recorrente local criada a partir do billing ativo.'
    );

    db.prepare(`
      INSERT INTO ${billingChargeEventsTable} (
        charge_event_id,
        charge_id,
        billing_record_id,
        lead_id,
        event_type,
        occurred_at,
        actor,
        note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      chargeId,
      billingRecord.billingRecordId,
      params.leadId,
      'charge_posted',
      now,
      cleanActor,
      'Primeira cobranca local recorrente entrou em estado de cobranca.'
    );

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    ok: true as const,
    lead,
    billingRecord: getLeadBillingRecord(params.leadId)!,
    charge: getLeadBillingCharge(params.leadId)!,
    chargeEvents: listLeadBillingChargeEvents(params.leadId, 20)
  };
}


export function createNextLeadLocalBillingCharge(params: { leadId: string; actor: string; note?: string }) {
  const db = getDatabase();
  const cleanActor = params.actor.trim();
  const cleanNote = params.note?.trim();

  if (!cleanActor) {
    return { ok: false as const, code: 'INVALID_ACTOR', error: 'actor obrigatorio.' };
  }

  const lead = getStoredLeadById(params.leadId);
  if (!lead) {
    return { ok: false as const, code: 'LEAD_NOT_FOUND', error: 'Lead nao encontrado.' };
  }

  const billingRecord = getLeadBillingRecord(params.leadId);
  if (!billingRecord || billingRecord.status !== localBillingChargeProgressionModel.requiredBillingRecordStatus) {
    return {
      ok: false as const,
      code: 'ACTIVE_BILLING_RECORD_REQUIRED',
      error: 'Lead precisa ter billing local ativo antes da progressao para a proxima cobranca recorrente.',
      billingRecord: billingRecord ?? null
    };
  }

  const latestCharge = getLeadBillingCharge(params.leadId);
  if (!latestCharge) {
    return {
      ok: false as const,
      code: 'SETTLED_PRIOR_CHARGE_REQUIRED',
      error: 'Lead precisa ter uma cobranca recorrente anterior liquidada antes da progressao.',
      billingRecord,
      latestCharge: null
    };
  }

  if (latestCharge.status === localBillingChargeProgressionModel.blockedPendingChargeStatus) {
    return {
      ok: false as const,
      code: 'PENDING_RECURRING_CHARGE_EXISTS',
      error: 'Ja existe uma cobranca recorrente pendente e a progressao nao pode duplicar a proxima sequencia.',
      billingRecord,
      latestCharge
    };
  }

  if (latestCharge.status !== localBillingChargeProgressionModel.requiredPriorChargeStatus) {
    return {
      ok: false as const,
      code: 'SETTLED_PRIOR_CHARGE_REQUIRED',
      error: 'A ultima cobranca recorrente precisa estar em settled_local antes da progressao.',
      billingRecord,
      latestCharge
    };
  }

  const now = new Date().toISOString();
  const chargeId = randomUUID();
  const nextChargeSequence = latestCharge.chargeSequence + 1;
  const dueDate = toNextChargeDueDate(latestCharge);

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO ${billingChargesTable} (
        charge_id,
        billing_record_id,
        lead_id,
        charge_sequence,
        charge_kind,
        status,
        currency,
        amount_cents,
        due_date,
        posted_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      chargeId,
      billingRecord.billingRecordId,
      params.leadId,
      nextChargeSequence,
      localBillingChargeProgressionModel.nextChargeKind,
      localBillingChargeModel.initialChargeStatus,
      billingRecord.currency,
      billingRecord.monthlyFeeCents,
      dueDate,
      now,
      now
    );

    db.prepare(`
      INSERT INTO ${billingChargeEventsTable} (
        charge_event_id,
        charge_id,
        billing_record_id,
        lead_id,
        event_type,
        occurred_at,
        actor,
        note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      chargeId,
      billingRecord.billingRecordId,
      params.leadId,
      'charge_created',
      now,
      cleanActor,
      cleanNote || `Cobranca recorrente local sequencia ${nextChargeSequence} criada apos liquidacao da sequencia ${latestCharge.chargeSequence}.`
    );

    db.prepare(`
      INSERT INTO ${billingChargeEventsTable} (
        charge_event_id,
        charge_id,
        billing_record_id,
        lead_id,
        event_type,
        occurred_at,
        actor,
        note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      chargeId,
      billingRecord.billingRecordId,
      params.leadId,
      'charge_posted',
      now,
      cleanActor,
      `Cobranca recorrente local sequencia ${nextChargeSequence} entrou em estado de cobranca apos a sequencia ${latestCharge.chargeSequence}.`
    );

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    ok: true as const,
    lead,
    billingRecord: getLeadBillingRecord(params.leadId)!,
    previousCharge: latestCharge,
    charge: getLeadBillingCharge(params.leadId)!,
    chargeEvents: listLeadBillingChargeEvents(params.leadId, 50)
  };
}

export function settleLeadLocalBillingChargeById(params: { leadId: string; chargeId: string; actor: string; note?: string }) {
  const db = getDatabase();
  const cleanActor = params.actor.trim();
  const cleanChargeId = params.chargeId.trim();
  const cleanNote = params.note?.trim();

  if (!cleanActor) {
    return { ok: false as const, code: 'INVALID_ACTOR', error: 'actor obrigatorio.' };
  }

  const lead = getStoredLeadById(params.leadId);
  if (!lead) {
    return { ok: false as const, code: 'LEAD_NOT_FOUND', error: 'Lead nao encontrado.' };
  }

  const billingRecord = getLeadBillingRecord(params.leadId);
  if (!billingRecord || billingRecord.status !== localBillingSettlementTargetingModel.requiredBillingRecordStatus) {
    return {
      ok: false as const,
      code: 'ACTIVE_BILLING_RECORD_REQUIRED',
      error: 'Lead precisa ter billing local ativo antes da liquidacao direcionada por chargeId.',
      billingRecord: billingRecord ?? null
    };
  }

  if (!cleanChargeId) {
    return { ok: false as const, code: 'CHARGE_NOT_FOUND', error: 'chargeId obrigatorio.' };
  }

  const charge = getBillingChargeById(cleanChargeId);
  if (!charge) {
    return {
      ok: false as const,
      code: 'CHARGE_NOT_FOUND',
      error: 'A cobranca selecionada nao existe.',
      billingRecord
    };
  }

  if (charge.leadId !== params.leadId) {
    return {
      ok: false as const,
      code: 'CHARGE_NOT_OWNED_BY_LEAD',
      error: 'A cobranca selecionada nao pertence ao lead informado.',
      billingRecord,
      charge
    };
  }

  if (charge.billingRecordId !== billingRecord.billingRecordId) {
    return {
      ok: false as const,
      code: 'CHARGE_NOT_ELIGIBLE',
      error: 'A cobranca selecionada nao pertence ao billing local ativo deste lead.',
      billingRecord,
      charge
    };
  }

  const existingSettlement = getLeadBillingSettlement(charge.chargeId);
  if (existingSettlement || charge.status === localBillingSettlementTargetingModel.blockedChargeStatus) {
    return {
      ok: false as const,
      code: 'CHARGE_ALREADY_SETTLED',
      error: 'A cobranca selecionada ja esta liquidada.',
      billingRecord,
      charge,
      settlement: existingSettlement ?? null
    };
  }

  if (charge.status !== localBillingSettlementTargetingModel.requiredChargeStatus) {
    return {
      ok: false as const,
      code: 'CHARGE_NOT_ELIGIBLE',
      error: 'A cobranca selecionada precisa estar em pending_local para liquidacao direcionada.',
      billingRecord,
      charge
    };
  }

  const now = new Date().toISOString();
  const settlementId = randomUUID();

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE ${billingChargesTable}
      SET status = ?
      WHERE charge_id = ?
    `).run(localBillingSettlementModel.resultingChargeStatus, charge.chargeId);

    db.prepare(`
      INSERT INTO ${billingSettlementsTable} (
        settlement_id,
        charge_id,
        billing_record_id,
        lead_id,
        status,
        settlement_kind,
        currency,
        amount_cents,
        settled_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      settlementId,
      charge.chargeId,
      billingRecord.billingRecordId,
      params.leadId,
      localBillingSettlementModel.resultingChargeStatus,
      localBillingSettlementModel.settlementKind,
      charge.currency,
      charge.amountCents,
      now,
      now
    );

    db.prepare(`
      INSERT INTO ${billingSettlementEventsTable} (
        settlement_event_id,
        settlement_id,
        charge_id,
        billing_record_id,
        lead_id,
        event_type,
        occurred_at,
        actor,
        note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      settlementId,
      charge.chargeId,
      billingRecord.billingRecordId,
      params.leadId,
      'settlement_recorded',
      now,
      cleanActor,
      cleanNote || `Liquidacao local direcionada registrada para chargeId ${charge.chargeId}.`
    );

    db.prepare(`
      INSERT INTO ${billingSettlementEventsTable} (
        settlement_event_id,
        settlement_id,
        charge_id,
        billing_record_id,
        lead_id,
        event_type,
        occurred_at,
        actor,
        note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      settlementId,
      charge.chargeId,
      billingRecord.billingRecordId,
      params.leadId,
      'charge_settled',
      now,
      cleanActor,
      `Cobranca ${charge.chargeId} movida de pending_local para settled_local.`
    );

    db.prepare(`
      INSERT INTO ${billingChargeEventsTable} (
        charge_event_id,
        charge_id,
        billing_record_id,
        lead_id,
        event_type,
        occurred_at,
        actor,
        note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      charge.chargeId,
      billingRecord.billingRecordId,
      params.leadId,
      'charge_settled',
      now,
      cleanActor,
      cleanNote || `Liquidacao local direcionada persistida para a cobranca ${charge.chargeId}.`
    );

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    ok: true as const,
    lead,
    billingRecord: getLeadBillingRecord(params.leadId)!,
    charge: getBillingChargeById(charge.chargeId)!,
    settlement: getLeadBillingSettlement(charge.chargeId)!,
    settlementEvents: listLeadBillingSettlementEvents(params.leadId, 50),
    chargeEvents: listLeadBillingChargeEvents(params.leadId, 50)
  };
}

export function listLeadBillingOverviewRows(): LeadBillingOverviewRow[] {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT
        leads.lead_id AS leadId,
        leads.full_name AS fullName,
        leads.email AS email,
        leads.commercial_stage AS commercialStage,
        records.billing_record_id AS billingRecordId,
        records.status AS billingRecordStatus,
        latest_charge.charge_id AS latestChargeId,
        latest_charge.charge_sequence AS latestChargeSequence,
        latest_charge.status AS latestChargeStatus,
        latest_charge.due_date AS latestChargeDueDate,
        latest_settlement.status AS latestSettlementStatus,
        latest_settlement.settled_at AS latestSettlementAt,
        COALESCE(pending_charge_totals.pendingChargeCount, 0) AS pendingChargeCount
      FROM ${billingRecordsTable} records
      INNER JOIN ${leadsTable} leads ON leads.lead_id = records.lead_id
      LEFT JOIN ${billingChargesTable} latest_charge
        ON latest_charge.charge_id = (
          SELECT charges.charge_id
          FROM ${billingChargesTable} charges
          WHERE charges.lead_id = records.lead_id
          ORDER BY charges.charge_sequence DESC, charges.created_at DESC, charges.charge_id DESC
          LIMIT 1
        )
      LEFT JOIN ${billingSettlementsTable} latest_settlement
        ON latest_settlement.settlement_id = (
          SELECT settlements.settlement_id
          FROM ${billingSettlementsTable} settlements
          WHERE settlements.lead_id = records.lead_id
          ORDER BY settlements.settled_at DESC, settlements.created_at DESC, settlements.settlement_id DESC
          LIMIT 1
        )
      LEFT JOIN (
        SELECT lead_id, COUNT(*) AS pendingChargeCount
        FROM ${billingChargesTable}
        WHERE status = '${localBillingChargeModel.initialChargeStatus}'
        GROUP BY lead_id
      ) pending_charge_totals
        ON pending_charge_totals.lead_id = records.lead_id
      ORDER BY
        pendingChargeCount DESC,
        latest_charge.due_date ASC,
        leads.created_at DESC,
        leads.lead_id DESC
    `)
    .all() as Record<string, unknown>[];

  return rows
    .filter((row) => isOperatorCommercialStage(row.commercialStage) && isLocalBillingRecordStatus(row.billingRecordStatus))
    .map((row) => ({
      leadId: String(row.leadId),
      fullName: String(row.fullName),
      email: String(row.email),
      commercialStage: row.commercialStage as OperatorCommercialStage,
      billingRecordId: String(row.billingRecordId),
      billingRecordStatus: row.billingRecordStatus as LocalBillingRecordStatus,
      latestChargeId: row.latestChargeId === null ? null : String(row.latestChargeId),
      latestChargeSequence: row.latestChargeSequence === null ? null : Number(row.latestChargeSequence),
      latestChargeStatus: isLocalBillingChargeStatus(row.latestChargeStatus) ? (row.latestChargeStatus as LocalBillingChargeStatus) : null,
      latestChargeDueDate: row.latestChargeDueDate === null ? null : String(row.latestChargeDueDate),
      latestSettlementStatus: isLocalBillingSettlementStatus(row.latestSettlementStatus)
        ? (row.latestSettlementStatus as LocalBillingSettlementStatus)
        : null,
      latestSettlementAt: row.latestSettlementAt === null ? null : String(row.latestSettlementAt),
      pendingChargeCount: Number(row.pendingChargeCount),
      hasOutstandingCharges: Number(row.pendingChargeCount) > 0
    } satisfies LeadBillingOverviewRow));
}

export function getLeadBillingOverviewMeta() {
  return {
    canonicalArtifact: localBillingOverviewModel.canonicalArtifact,
    cockpitSurface: localBillingOverviewModel.cockpitSurface,
    overviewColumns: localBillingOverviewModel.overviewColumns
  };
}

export function createLeadLocalBillingSettlement(params: { leadId: string; actor: string; note?: string }) {
  const billingRecord = getLeadBillingRecord(params.leadId);
  const charge = getLeadBillingCharge(params.leadId);

  if (!billingRecord || !charge || charge.billingRecordId !== billingRecord.billingRecordId || charge.status !== 'pending_local') {
    return {
      ok: false as const,
      code: 'ELIGIBLE_CHARGE_REQUIRED',
      error: 'Lead precisa ter uma cobranca local elegivel em estado pending_local antes da liquidacao.',
      billingRecord,
      charge
    };
  }

  return settleLeadLocalBillingChargeById({
    leadId: params.leadId,
    chargeId: charge.chargeId,
    actor: params.actor,
    note: params.note
  });
}

export function listStoredIntakeEvents(limit = 50) {
  const db = getDatabase();
  const rows = db
    .prepare(`
      SELECT
        event_id AS eventId,
        event_name AS eventName,
        occurred_at AS occurredAt,
        metadata_json AS metadataJson,
        related_lead_id AS relatedLeadId
      FROM ${eventsTable}
      ORDER BY occurred_at DESC, event_id DESC
      LIMIT ?
    `)
    .all(limit) as Record<string, unknown>[];

  return rows.map((row) => ({
    eventId: String(row.eventId),
    eventName: row.eventName as IntakeAnalyticsEvent,
    occurredAt: String(row.occurredAt),
    metadata: parseMetadata(row.metadataJson),
    relatedLeadId: row.relatedLeadId === null ? null : String(row.relatedLeadId)
  }));
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
    billingSettlementEventsTable
  };
}
