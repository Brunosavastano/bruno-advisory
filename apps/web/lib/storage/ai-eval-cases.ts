import { randomUUID } from 'node:crypto';
import type { AiEvalCaseRecord } from '@savastano-advisory/core';
import { writeAuditLog } from './audit-log';
import { aiEvalCasesTable, getDatabase } from './db';

const SELECT_COLUMNS = `
  case_id AS caseId,
  surface,
  name,
  input_json AS inputJson,
  expected_constraints_json AS expectedConstraintsJson,
  active,
  created_at AS createdAt,
  deactivated_at AS deactivatedAt
`;

function normalizeRow(row: Record<string, unknown>): AiEvalCaseRecord {
  return {
    caseId: String(row.caseId),
    surface: String(row.surface),
    name: String(row.name),
    inputJson: String(row.inputJson),
    expectedConstraintsJson: String(row.expectedConstraintsJson),
    active: Number(row.active) === 1,
    createdAt: String(row.createdAt),
    deactivatedAt: row.deactivatedAt === null ? null : String(row.deactivatedAt)
  };
}

export type CreateEvalCaseParams = {
  surface: string;
  name: string;
  inputJson: string;
  expectedConstraintsJson: string;
  actorId?: string | null;
};

export function createEvalCase(params: CreateEvalCaseParams): AiEvalCaseRecord {
  const surface = params.surface?.trim();
  const name = params.name?.trim();
  const inputJson = params.inputJson?.trim();
  const expectedConstraintsJson = params.expectedConstraintsJson?.trim();
  if (!surface || !name || !inputJson || !expectedConstraintsJson) {
    throw new Error('createEvalCase: surface, name, inputJson, expectedConstraintsJson are required');
  }
  // Validate that JSON params are parseable
  try {
    JSON.parse(inputJson);
    JSON.parse(expectedConstraintsJson);
  } catch {
    throw new Error('createEvalCase: inputJson and expectedConstraintsJson must be valid JSON strings');
  }

  const caseId = randomUUID();
  const now = new Date().toISOString();
  const db = getDatabase();

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO ${aiEvalCasesTable} (case_id, surface, name, input_json, expected_constraints_json, active, created_at, deactivated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, NULL)
    `).run(caseId, surface, name, inputJson, expectedConstraintsJson, now);

    writeAuditLog({
      action: 'ai_eval_case_created',
      entityType: 'ai_eval_case',
      entityId: caseId,
      leadId: null,
      actorType: params.actorId ? 'operator' : 'system',
      actorId: params.actorId ?? null,
      detail: { surface, name }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getEvalCase(caseId) as AiEvalCaseRecord;
}

export function getEvalCase(caseId: string): AiEvalCaseRecord | null {
  const db = getDatabase();
  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM ${aiEvalCasesTable} WHERE case_id = ? LIMIT 1`).get(caseId) as
    | Record<string, unknown>
    | undefined;
  return row ? normalizeRow(row) : null;
}

export function listActiveEvalCases(params: { surface?: string } = {}): AiEvalCaseRecord[] {
  const db = getDatabase();
  const rows = (params.surface
    ? db.prepare(`SELECT ${SELECT_COLUMNS} FROM ${aiEvalCasesTable} WHERE active = 1 AND surface = ? ORDER BY created_at DESC`).all(params.surface)
    : db.prepare(`SELECT ${SELECT_COLUMNS} FROM ${aiEvalCasesTable} WHERE active = 1 ORDER BY created_at DESC`).all()) as Record<string, unknown>[];
  return rows.map(normalizeRow);
}

export function deactivateEvalCase(params: { caseId: string; actorId?: string | null }): AiEvalCaseRecord | null {
  const current = getEvalCase(params.caseId);
  if (!current || !current.active) return current;

  const db = getDatabase();
  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE ${aiEvalCasesTable} SET active = 0, deactivated_at = ? WHERE case_id = ?`).run(now, params.caseId);

    writeAuditLog({
      action: 'ai_eval_case_deactivated',
      entityType: 'ai_eval_case',
      entityId: params.caseId,
      leadId: null,
      actorType: params.actorId ? 'operator' : 'system',
      actorId: params.actorId ?? null,
      detail: { surface: current.surface, name: current.name }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getEvalCase(params.caseId);
}

export function reactivateEvalCase(params: { caseId: string; actorId?: string | null }): AiEvalCaseRecord | null {
  const current = getEvalCase(params.caseId);
  if (!current || current.active) return current;

  const db = getDatabase();

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE ${aiEvalCasesTable} SET active = 1, deactivated_at = NULL WHERE case_id = ?`).run(params.caseId);

    writeAuditLog({
      action: 'ai_eval_case_reactivated',
      entityType: 'ai_eval_case',
      entityId: params.caseId,
      leadId: null,
      actorType: params.actorId ? 'operator' : 'system',
      actorId: params.actorId ?? null,
      detail: { surface: current.surface, name: current.name }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getEvalCase(params.caseId);
}
