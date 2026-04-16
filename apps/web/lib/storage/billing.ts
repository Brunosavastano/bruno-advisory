import { randomUUID } from 'node:crypto';
import {
  evaluateBillingEntryReadiness,
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
  type LocalBillingSettlementStatus
} from '@savastano-advisory/core';
import { writeAuditLog } from './audit-log';
import {
  billingChargeEventsTable,
  billingChargesTable,
  billingEventsTable,
  billingRecordsTable,
  billingSettlementEventsTable,
  billingSettlementsTable,
  getDatabase,
  leadsTable
} from './db';
import { getStoredLeadById } from './leads';
import { listLeadInternalTasks } from './tasks';
import type {
  LeadBillingCharge,
  LeadBillingChargeEvent,
  LeadBillingEvent,
  LeadBillingOverviewRow,
  LeadBillingReadiness,
  LeadBillingRecord,
  LeadBillingSettlement,
  LeadBillingSettlementEvent
} from './types';

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
  const row = db.prepare(`
    SELECT billing_record_id AS billingRecordId, lead_id AS leadId, status, currency,
      entry_fee_cents AS entryFeeCents, monthly_fee_cents AS monthlyFeeCents,
      minimum_commitment_months AS minimumCommitmentMonths, activated_at AS activatedAt,
      created_at AS createdAt
    FROM ${billingRecordsTable}
    WHERE lead_id = ?
    LIMIT 1
  `).get(leadId) as Record<string, unknown> | undefined;

  return row ? normalizeLeadBillingRecord(row) : null;
}

export function listLeadBillingEvents(leadId: string, limit = 100): LeadBillingEvent[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT billing_event_id AS billingEventId, billing_record_id AS billingRecordId, lead_id AS leadId,
      event_type AS eventType, occurred_at AS occurredAt, actor, note
    FROM ${billingEventsTable}
    WHERE lead_id = ?
    ORDER BY occurred_at DESC, billing_event_id DESC
    LIMIT ?
  `).all(leadId, limit) as Record<string, unknown>[];

  return rows.filter((row) => isLocalBillingEventType(row.eventType)).map((row) => ({
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
  const row = db.prepare(`
    SELECT charge_id AS chargeId, billing_record_id AS billingRecordId, lead_id AS leadId,
      charge_sequence AS chargeSequence, charge_kind AS chargeKind, status, currency,
      amount_cents AS amountCents, due_date AS dueDate, posted_at AS postedAt, created_at AS createdAt
    FROM ${billingChargesTable}
    WHERE lead_id = ?
    ORDER BY charge_sequence DESC, created_at DESC, charge_id DESC
    LIMIT 1
  `).get(leadId) as Record<string, unknown> | undefined;

  return row ? normalizeLeadBillingCharge(row) : null;
}

export function listLeadBillingCharges(leadId: string, limit = 100): LeadBillingCharge[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT charge_id AS chargeId, billing_record_id AS billingRecordId, lead_id AS leadId,
      charge_sequence AS chargeSequence, charge_kind AS chargeKind, status, currency,
      amount_cents AS amountCents, due_date AS dueDate, posted_at AS postedAt, created_at AS createdAt
    FROM ${billingChargesTable}
    WHERE lead_id = ?
    ORDER BY charge_sequence DESC, created_at DESC, charge_id DESC
    LIMIT ?
  `).all(leadId, limit) as Record<string, unknown>[];

  return rows.map((row) => normalizeLeadBillingCharge(row)).filter((row): row is LeadBillingCharge => row !== null);
}

export function getBillingChargeById(chargeId: string): LeadBillingCharge | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT charge_id AS chargeId, billing_record_id AS billingRecordId, lead_id AS leadId,
      charge_sequence AS chargeSequence, charge_kind AS chargeKind, status, currency,
      amount_cents AS amountCents, due_date AS dueDate, posted_at AS postedAt, created_at AS createdAt
    FROM ${billingChargesTable}
    WHERE charge_id = ?
    LIMIT 1
  `).get(chargeId) as Record<string, unknown> | undefined;

  return row ? normalizeLeadBillingCharge(row) : null;
}

export function listLeadBillingChargeEvents(leadId: string, limit = 100): LeadBillingChargeEvent[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT charge_event_id AS chargeEventId, charge_id AS chargeId, billing_record_id AS billingRecordId,
      lead_id AS leadId, event_type AS eventType, occurred_at AS occurredAt, actor, note
    FROM ${billingChargeEventsTable}
    WHERE lead_id = ?
    ORDER BY occurred_at DESC, charge_event_id DESC
    LIMIT ?
  `).all(leadId, limit) as Record<string, unknown>[];

  return rows.filter((row) => isLocalBillingChargeEventType(row.eventType)).map((row) => ({
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
  const row = db.prepare(`
    SELECT settlement_id AS settlementId, charge_id AS chargeId, billing_record_id AS billingRecordId,
      lead_id AS leadId, status, settlement_kind AS settlementKind, currency,
      amount_cents AS amountCents, settled_at AS settledAt, created_at AS createdAt
    FROM ${billingSettlementsTable}
    WHERE charge_id = ?
    LIMIT 1
  `).get(chargeId) as Record<string, unknown> | undefined;

  return row ? normalizeLeadBillingSettlement(row) : null;
}

export function listLeadBillingSettlements(leadId: string, limit = 100): LeadBillingSettlement[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT settlement_id AS settlementId, charge_id AS chargeId, billing_record_id AS billingRecordId,
      lead_id AS leadId, status, settlement_kind AS settlementKind, currency,
      amount_cents AS amountCents, settled_at AS settledAt, created_at AS createdAt
    FROM ${billingSettlementsTable}
    WHERE lead_id = ?
    ORDER BY settled_at DESC, settlement_id DESC
    LIMIT ?
  `).all(leadId, limit) as Record<string, unknown>[];

  return rows.map((row) => normalizeLeadBillingSettlement(row)).filter((row): row is LeadBillingSettlement => row !== null);
}

export function listLeadBillingSettlementEvents(leadId: string, limit = 100): LeadBillingSettlementEvent[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT settlement_event_id AS settlementEventId, settlement_id AS settlementId, charge_id AS chargeId,
      billing_record_id AS billingRecordId, lead_id AS leadId, event_type AS eventType,
      occurred_at AS occurredAt, actor, note
    FROM ${billingSettlementEventsTable}
    WHERE lead_id = ?
    ORDER BY occurred_at DESC, settlement_event_id DESC
    LIMIT ?
  `).all(leadId, limit) as Record<string, unknown>[];

  return rows.filter((row) => isLocalBillingSettlementEventType(row.eventType)).map((row) => ({
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

  return { leadId: lead.leadId, ...evaluation };
}

export function createLeadLocalBillingRecord(params: { leadId: string; actor: string; note?: string; actorId?: string | null }) {
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
    return { ok: false as const, code: 'BILLING_RECORD_EXISTS', error: 'Billing local ja foi criado para este lead.', billingRecord: existingRecord };
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
        billing_record_id, lead_id, status, currency, entry_fee_cents, monthly_fee_cents,
        minimum_commitment_months, activated_at, created_at
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
      INSERT INTO ${billingEventsTable} (billing_event_id, billing_record_id, lead_id, event_type, occurred_at, actor, note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), billingRecordId, params.leadId, 'billing_record_created', now, cleanActor, cleanNote || null);

    writeAuditLog({
      action: 'billing_record_created',
      entityType: 'billing_record',
      entityId: billingRecordId,
      leadId: params.leadId,
      actorType: 'operator',
      actorId: params.actorId ?? null,
      detail: {
        actor: cleanActor,
        note: cleanNote || null,
        status: recordStatus
      }
    });

    if (recordStatus === 'active_local') {
      db.prepare(`
        INSERT INTO ${billingEventsTable} (billing_event_id, billing_record_id, lead_id, event_type, occurred_at, actor, note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        billingRecordId,
        params.leadId,
        'billing_record_activated',
        now,
        cleanActor,
        'Lead entrou em operacao billable local.'
      );

      writeAuditLog({
        action: 'billing_record_activated',
        entityType: 'billing_record',
        entityId: billingRecordId,
        leadId: params.leadId,
        actorType: 'operator',
        actorId: params.actorId ?? null,
        detail: {
          actor: cleanActor,
          activatedAt: now
        }
      });
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

export function createLeadLocalBillingCharge(params: { leadId: string; actor: string; note?: string; actorId?: string | null }) {
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
    return { ok: false as const, code: 'ACTIVE_BILLING_RECORD_REQUIRED', error: 'Lead precisa ter billing local ativo antes de criar a primeira cobranca.' };
  }

  const existingCharge = getLeadBillingCharge(params.leadId);
  if (existingCharge) {
    return { ok: false as const, code: 'CHARGE_ALREADY_EXISTS', error: 'A primeira cobranca local recorrente ja foi criada para este lead.', billingRecord, charge: existingCharge };
  }

  const now = new Date().toISOString();
  const chargeId = randomUUID();
  const dueDate = toChargeDueDate(billingRecord);

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO ${billingChargesTable} (
        charge_id, billing_record_id, lead_id, charge_sequence, charge_kind, status,
        currency, amount_cents, due_date, posted_at, created_at
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
      INSERT INTO ${billingChargeEventsTable} (charge_event_id, charge_id, billing_record_id, lead_id, event_type, occurred_at, actor, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), chargeId, billingRecord.billingRecordId, params.leadId, 'charge_created', now, cleanActor, cleanNote || 'Primeira cobranca recorrente local criada a partir do billing ativo.');

    db.prepare(`
      INSERT INTO ${billingChargeEventsTable} (charge_event_id, charge_id, billing_record_id, lead_id, event_type, occurred_at, actor, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), chargeId, billingRecord.billingRecordId, params.leadId, 'charge_posted', now, cleanActor, 'Primeira cobranca local recorrente entrou em estado de cobranca.');

    writeAuditLog({
      action: 'charge_created',
      entityType: 'billing_charge',
      entityId: chargeId,
      leadId: params.leadId,
      actorType: 'operator',
      actorId: params.actorId ?? null,
      detail: {
        actor: cleanActor,
        billingRecordId: billingRecord.billingRecordId,
        chargeSequence: localBillingChargeModel.firstChargeSequence,
        amountCents: billingRecord.monthlyFeeCents,
        dueDate
      }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { ok: true as const, lead, billingRecord: getLeadBillingRecord(params.leadId)!, charge: getLeadBillingCharge(params.leadId)!, chargeEvents: listLeadBillingChargeEvents(params.leadId, 20) };
}

export function createNextLeadLocalBillingCharge(params: { leadId: string; actor: string; note?: string; actorId?: string | null }) {
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
    return { ok: false as const, code: 'ACTIVE_BILLING_RECORD_REQUIRED', error: 'Lead precisa ter billing local ativo antes da progressao para a proxima cobranca recorrente.', billingRecord: billingRecord ?? null };
  }

  const latestCharge = getLeadBillingCharge(params.leadId);
  if (!latestCharge) {
    return { ok: false as const, code: 'SETTLED_PRIOR_CHARGE_REQUIRED', error: 'Lead precisa ter uma cobranca recorrente anterior liquidada antes da progressao.', billingRecord, latestCharge: null };
  }

  if (latestCharge.status === localBillingChargeProgressionModel.blockedPendingChargeStatus) {
    return { ok: false as const, code: 'PENDING_RECURRING_CHARGE_EXISTS', error: 'Ja existe uma cobranca recorrente pendente e a progressao nao pode duplicar a proxima sequencia.', billingRecord, latestCharge };
  }

  if (latestCharge.status !== localBillingChargeProgressionModel.requiredPriorChargeStatus) {
    return { ok: false as const, code: 'SETTLED_PRIOR_CHARGE_REQUIRED', error: 'A ultima cobranca recorrente precisa estar em settled_local antes da progressao.', billingRecord, latestCharge };
  }

  const now = new Date().toISOString();
  const chargeId = randomUUID();
  const nextChargeSequence = latestCharge.chargeSequence + 1;
  const dueDate = toNextChargeDueDate(latestCharge);

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO ${billingChargesTable} (
        charge_id, billing_record_id, lead_id, charge_sequence, charge_kind, status,
        currency, amount_cents, due_date, posted_at, created_at
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
      INSERT INTO ${billingChargeEventsTable} (charge_event_id, charge_id, billing_record_id, lead_id, event_type, occurred_at, actor, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), chargeId, billingRecord.billingRecordId, params.leadId, 'charge_created', now, cleanActor, cleanNote || `Cobranca recorrente local sequencia ${nextChargeSequence} criada apos liquidacao da sequencia ${latestCharge.chargeSequence}.`);

    db.prepare(`
      INSERT INTO ${billingChargeEventsTable} (charge_event_id, charge_id, billing_record_id, lead_id, event_type, occurred_at, actor, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), chargeId, billingRecord.billingRecordId, params.leadId, 'charge_posted', now, cleanActor, `Cobranca recorrente local sequencia ${nextChargeSequence} entrou em estado de cobranca apos a sequencia ${latestCharge.chargeSequence}.`);

    writeAuditLog({
      action: 'charge_progressed',
      entityType: 'billing_charge',
      entityId: chargeId,
      leadId: params.leadId,
      actorType: 'operator',
      actorId: params.actorId ?? null,
      detail: {
        actor: cleanActor,
        billingRecordId: billingRecord.billingRecordId,
        previousChargeId: latestCharge.chargeId,
        previousChargeSequence: latestCharge.chargeSequence,
        chargeSequence: nextChargeSequence,
        amountCents: billingRecord.monthlyFeeCents,
        dueDate
      }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { ok: true as const, lead, billingRecord: getLeadBillingRecord(params.leadId)!, previousCharge: latestCharge, charge: getLeadBillingCharge(params.leadId)!, chargeEvents: listLeadBillingChargeEvents(params.leadId, 50) };
}

export function settleLeadLocalBillingChargeById(params: { leadId: string; chargeId: string; actor: string; note?: string; actorId?: string | null }) {
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
    return { ok: false as const, code: 'ACTIVE_BILLING_RECORD_REQUIRED', error: 'Lead precisa ter billing local ativo antes da liquidacao direcionada por chargeId.', billingRecord: billingRecord ?? null };
  }

  if (!cleanChargeId) {
    return { ok: false as const, code: 'CHARGE_NOT_FOUND', error: 'chargeId obrigatorio.' };
  }

  const charge = getBillingChargeById(cleanChargeId);
  if (!charge) {
    return { ok: false as const, code: 'CHARGE_NOT_FOUND', error: 'A cobranca selecionada nao existe.', billingRecord };
  }

  if (charge.leadId !== params.leadId) {
    return { ok: false as const, code: 'CHARGE_NOT_OWNED_BY_LEAD', error: 'A cobranca selecionada nao pertence ao lead informado.', billingRecord, charge };
  }

  if (charge.billingRecordId !== billingRecord.billingRecordId) {
    return { ok: false as const, code: 'CHARGE_NOT_ELIGIBLE', error: 'A cobranca selecionada nao pertence ao billing local ativo deste lead.', billingRecord, charge };
  }

  const existingSettlement = getLeadBillingSettlement(charge.chargeId);
  if (existingSettlement || charge.status === localBillingSettlementTargetingModel.blockedChargeStatus) {
    return { ok: false as const, code: 'CHARGE_ALREADY_SETTLED', error: 'A cobranca selecionada ja esta liquidada.', billingRecord, charge, settlement: existingSettlement ?? null };
  }

  if (charge.status !== localBillingSettlementTargetingModel.requiredChargeStatus) {
    return { ok: false as const, code: 'CHARGE_NOT_ELIGIBLE', error: 'A cobranca selecionada precisa estar em pending_local para liquidacao direcionada.', billingRecord, charge };
  }

  const now = new Date().toISOString();
  const settlementId = randomUUID();

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE ${billingChargesTable} SET status = ? WHERE charge_id = ?`).run(localBillingSettlementModel.resultingChargeStatus, charge.chargeId);

    db.prepare(`
      INSERT INTO ${billingSettlementsTable} (
        settlement_id, charge_id, billing_record_id, lead_id, status, settlement_kind,
        currency, amount_cents, settled_at, created_at
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
      INSERT INTO ${billingSettlementEventsTable} (settlement_event_id, settlement_id, charge_id, billing_record_id, lead_id, event_type, occurred_at, actor, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), settlementId, charge.chargeId, billingRecord.billingRecordId, params.leadId, 'settlement_recorded', now, cleanActor, cleanNote || `Liquidacao local direcionada registrada para chargeId ${charge.chargeId}.`);

    db.prepare(`
      INSERT INTO ${billingSettlementEventsTable} (settlement_event_id, settlement_id, charge_id, billing_record_id, lead_id, event_type, occurred_at, actor, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), settlementId, charge.chargeId, billingRecord.billingRecordId, params.leadId, 'charge_settled', now, cleanActor, `Cobranca ${charge.chargeId} movida de pending_local para settled_local.`);

    db.prepare(`
      INSERT INTO ${billingChargeEventsTable} (charge_event_id, charge_id, billing_record_id, lead_id, event_type, occurred_at, actor, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), charge.chargeId, billingRecord.billingRecordId, params.leadId, 'charge_settled', now, cleanActor, cleanNote || `Liquidacao local direcionada persistida para a cobranca ${charge.chargeId}.`);

    writeAuditLog({
      action: 'charge_settled',
      entityType: 'billing_charge',
      entityId: charge.chargeId,
      leadId: params.leadId,
      actorType: 'operator',
      actorId: params.actorId ?? null,
      detail: {
        actor: cleanActor,
        settlementId,
        billingRecordId: billingRecord.billingRecordId,
        amountCents: charge.amountCents,
        note: cleanNote || null
      }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { ok: true as const, lead, billingRecord: getLeadBillingRecord(params.leadId)!, charge: getBillingChargeById(charge.chargeId)!, settlement: getLeadBillingSettlement(charge.chargeId)!, settlementEvents: listLeadBillingSettlementEvents(params.leadId, 50), chargeEvents: listLeadBillingChargeEvents(params.leadId, 50) };
}

export function listLeadBillingOverviewRows(): LeadBillingOverviewRow[] {
  const db = getDatabase();
  const rows = db.prepare(`
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
    LEFT JOIN ${billingChargesTable} latest_charge ON latest_charge.charge_id = (
      SELECT charges.charge_id
      FROM ${billingChargesTable} charges
      WHERE charges.lead_id = records.lead_id
      ORDER BY charges.charge_sequence DESC, charges.created_at DESC, charges.charge_id DESC
      LIMIT 1
    )
    LEFT JOIN ${billingSettlementsTable} latest_settlement ON latest_settlement.settlement_id = (
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
    ) pending_charge_totals ON pending_charge_totals.lead_id = records.lead_id
    ORDER BY pendingChargeCount DESC, latest_charge.due_date ASC, leads.created_at DESC, leads.lead_id DESC
  `).all() as Record<string, unknown>[];

  return rows
    .filter((row) => isOperatorCommercialStage(row.commercialStage) && isLocalBillingRecordStatus(row.billingRecordStatus))
    .map((row) => ({
      leadId: String(row.leadId),
      fullName: String(row.fullName),
      email: String(row.email),
      commercialStage: row.commercialStage as LeadBillingOverviewRow['commercialStage'],
      billingRecordId: String(row.billingRecordId),
      billingRecordStatus: row.billingRecordStatus as LocalBillingRecordStatus,
      latestChargeId: row.latestChargeId === null ? null : String(row.latestChargeId),
      latestChargeSequence: row.latestChargeSequence === null ? null : Number(row.latestChargeSequence),
      latestChargeStatus: isLocalBillingChargeStatus(row.latestChargeStatus) ? (row.latestChargeStatus as LocalBillingChargeStatus) : null,
      latestChargeDueDate: row.latestChargeDueDate === null ? null : String(row.latestChargeDueDate),
      latestSettlementStatus: isLocalBillingSettlementStatus(row.latestSettlementStatus) ? (row.latestSettlementStatus as LocalBillingSettlementStatus) : null,
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
    return { ok: false as const, code: 'ELIGIBLE_CHARGE_REQUIRED', error: 'Lead precisa ter uma cobranca local elegivel em estado pending_local antes da liquidacao.', billingRecord, charge };
  }

  return settleLeadLocalBillingChargeById({ leadId: params.leadId, chargeId: charge.chargeId, actor: params.actor, note: params.note });
}
