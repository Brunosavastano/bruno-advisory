import { randomUUID } from 'node:crypto';
import {
  aiBudgetActionsOnExceed,
  aiBudgetPeriods,
  aiBudgetScopeTypes,
  type AiBudgetActionOnExceed,
  type AiBudgetCapRecord,
  type AiBudgetPeriod,
  type AiBudgetScopeType
} from '@savastano-advisory/core';
import { writeAuditLog } from './audit-log';
import { aiBudgetCapsTable, getDatabase } from './db';

const SELECT_COLUMNS = `
  cap_id AS capId,
  scope_type AS scopeType,
  scope_value AS scopeValue,
  period,
  cap_cents AS capCents,
  action_on_exceed AS actionOnExceed,
  active,
  created_at AS createdAt,
  updated_at AS updatedAt,
  deactivated_at AS deactivatedAt
`;

function normalizeRow(row: Record<string, unknown>): AiBudgetCapRecord {
  const scopeType = String(row.scopeType) as AiBudgetScopeType;
  if (!aiBudgetScopeTypes.includes(scopeType)) throw new Error(`Invalid scope_type: ${row.scopeType}`);
  const period = String(row.period) as AiBudgetPeriod;
  if (!aiBudgetPeriods.includes(period)) throw new Error(`Invalid period: ${row.period}`);
  const actionOnExceed = String(row.actionOnExceed) as AiBudgetActionOnExceed;
  if (!aiBudgetActionsOnExceed.includes(actionOnExceed)) throw new Error(`Invalid action_on_exceed: ${row.actionOnExceed}`);

  return {
    capId: String(row.capId),
    scopeType,
    scopeValue: String(row.scopeValue),
    period,
    capCents: Number(row.capCents),
    actionOnExceed,
    active: Number(row.active) === 1,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    deactivatedAt: row.deactivatedAt === null ? null : String(row.deactivatedAt)
  };
}

export type SetBudgetCapParams = {
  scopeType: AiBudgetScopeType;
  scopeValue: string;
  period: AiBudgetPeriod;
  capCents: number;
  actionOnExceed: AiBudgetActionOnExceed;
  actorId?: string | null;
};

export function setBudgetCap(params: SetBudgetCapParams): AiBudgetCapRecord {
  if (!aiBudgetScopeTypes.includes(params.scopeType)) throw new Error(`Invalid scope_type: ${params.scopeType}`);
  if (!aiBudgetPeriods.includes(params.period)) throw new Error(`Invalid period: ${params.period}`);
  if (!aiBudgetActionsOnExceed.includes(params.actionOnExceed)) throw new Error(`Invalid action_on_exceed: ${params.actionOnExceed}`);
  if (!Number.isFinite(params.capCents) || params.capCents < 0) {
    throw new Error(`Invalid capCents: ${params.capCents}`);
  }
  const scopeValue = params.scopeValue?.trim();
  if (!scopeValue) throw new Error('setBudgetCap: scopeValue required (use \'global\' for global scope)');

  const db = getDatabase();
  const now = new Date().toISOString();
  const existing = db.prepare(
    `SELECT cap_id AS capId FROM ${aiBudgetCapsTable} WHERE scope_type = ? AND scope_value = ? AND period = ? LIMIT 1`
  ).get(params.scopeType, scopeValue, params.period) as { capId: string } | undefined;

  db.exec('BEGIN');
  try {
    if (existing) {
      db.prepare(`
        UPDATE ${aiBudgetCapsTable}
        SET cap_cents = ?, action_on_exceed = ?, active = 1, updated_at = ?, deactivated_at = NULL
        WHERE cap_id = ?
      `).run(params.capCents, params.actionOnExceed, now, existing.capId);

      writeAuditLog({
        action: 'ai_budget_cap_updated',
        entityType: 'ai_budget_cap',
        entityId: existing.capId,
        leadId: params.scopeType === 'lead' ? scopeValue : null,
        actorType: params.actorId ? 'operator' : 'system',
        actorId: params.actorId ?? null,
        detail: { scopeType: params.scopeType, scopeValue, period: params.period, capCents: params.capCents, actionOnExceed: params.actionOnExceed }
      });

      db.exec('COMMIT');
    } else {
      const capId = randomUUID();
      db.prepare(`
        INSERT INTO ${aiBudgetCapsTable} (
          cap_id, scope_type, scope_value, period, cap_cents, action_on_exceed, active, created_at, updated_at, deactivated_at
        ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, NULL)
      `).run(capId, params.scopeType, scopeValue, params.period, params.capCents, params.actionOnExceed, now, now);

      writeAuditLog({
        action: 'ai_budget_cap_set',
        entityType: 'ai_budget_cap',
        entityId: capId,
        leadId: params.scopeType === 'lead' ? scopeValue : null,
        actorType: params.actorId ? 'operator' : 'system',
        actorId: params.actorId ?? null,
        detail: { scopeType: params.scopeType, scopeValue, period: params.period, capCents: params.capCents, actionOnExceed: params.actionOnExceed }
      });

      db.exec('COMMIT');
    }
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getBudgetCap({ scopeType: params.scopeType, scopeValue, period: params.period }) as AiBudgetCapRecord;
}

export function getBudgetCap(params: {
  scopeType: AiBudgetScopeType;
  scopeValue: string;
  period: AiBudgetPeriod;
}): AiBudgetCapRecord | null {
  const db = getDatabase();
  const row = db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM ${aiBudgetCapsTable} WHERE scope_type = ? AND scope_value = ? AND period = ? LIMIT 1`
  ).get(params.scopeType, params.scopeValue, params.period) as Record<string, unknown> | undefined;
  return row ? normalizeRow(row) : null;
}

export function listActiveBudgetCaps(): AiBudgetCapRecord[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM ${aiBudgetCapsTable} WHERE active = 1 ORDER BY scope_type, scope_value, period`
  ).all() as Record<string, unknown>[];
  return rows.map(normalizeRow);
}

export function listAllBudgetCaps(): AiBudgetCapRecord[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM ${aiBudgetCapsTable} ORDER BY scope_type, scope_value, period`
  ).all() as Record<string, unknown>[];
  return rows.map(normalizeRow);
}

export function deactivateBudgetCap(params: { capId: string; actorId?: string | null }): AiBudgetCapRecord | null {
  const db = getDatabase();
  const current = db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM ${aiBudgetCapsTable} WHERE cap_id = ? LIMIT 1`
  ).get(params.capId) as Record<string, unknown> | undefined;
  if (!current) return null;
  const normalizedCurrent = normalizeRow(current);
  if (!normalizedCurrent.active) return normalizedCurrent;

  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    db.prepare(
      `UPDATE ${aiBudgetCapsTable} SET active = 0, deactivated_at = ?, updated_at = ? WHERE cap_id = ?`
    ).run(now, now, params.capId);

    writeAuditLog({
      action: 'ai_budget_cap_deactivated',
      entityType: 'ai_budget_cap',
      entityId: params.capId,
      leadId: normalizedCurrent.scopeType === 'lead' ? normalizedCurrent.scopeValue : null,
      actorType: params.actorId ? 'operator' : 'system',
      actorId: params.actorId ?? null,
      detail: { scopeType: normalizedCurrent.scopeType, scopeValue: normalizedCurrent.scopeValue, period: normalizedCurrent.period }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const refreshed = db.prepare(`SELECT ${SELECT_COLUMNS} FROM ${aiBudgetCapsTable} WHERE cap_id = ? LIMIT 1`).get(params.capId) as Record<string, unknown>;
  return normalizeRow(refreshed);
}

export function reactivateBudgetCap(params: { capId: string; actorId?: string | null }): AiBudgetCapRecord | null {
  const db = getDatabase();
  const current = db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM ${aiBudgetCapsTable} WHERE cap_id = ? LIMIT 1`
  ).get(params.capId) as Record<string, unknown> | undefined;
  if (!current) return null;
  const normalizedCurrent = normalizeRow(current);
  if (normalizedCurrent.active) return normalizedCurrent;

  const now = new Date().toISOString();
  db.exec('BEGIN');
  try {
    db.prepare(
      `UPDATE ${aiBudgetCapsTable} SET active = 1, deactivated_at = NULL, updated_at = ? WHERE cap_id = ?`
    ).run(now, params.capId);

    writeAuditLog({
      action: 'ai_budget_cap_reactivated',
      entityType: 'ai_budget_cap',
      entityId: params.capId,
      leadId: normalizedCurrent.scopeType === 'lead' ? normalizedCurrent.scopeValue : null,
      actorType: params.actorId ? 'operator' : 'system',
      actorId: params.actorId ?? null,
      detail: { scopeType: normalizedCurrent.scopeType, scopeValue: normalizedCurrent.scopeValue, period: normalizedCurrent.period }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const refreshed = db.prepare(`SELECT ${SELECT_COLUMNS} FROM ${aiBudgetCapsTable} WHERE cap_id = ? LIMIT 1`).get(params.capId) as Record<string, unknown>;
  return normalizeRow(refreshed);
}
