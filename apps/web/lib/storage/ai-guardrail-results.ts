import { randomUUID } from 'node:crypto';
import {
  aiGuardrailResultStatuses,
  type AiGuardrailResultRecord,
  type AiGuardrailResultStatus,
  type AiGuardrailResultSummary
} from '@savastano-advisory/core';
import { writeAuditLog } from './audit-log';
import { aiGuardrailResultsTable, aiJobsTable, getDatabase } from './db';

const SELECT_COLUMNS = `
  result_id AS resultId,
  job_id AS jobId,
  rule_name AS ruleName,
  status,
  detail,
  created_at AS createdAt
`;

function normalizeRow(row: Record<string, unknown>): AiGuardrailResultRecord {
  const status = String(row.status) as AiGuardrailResultStatus;
  if (!aiGuardrailResultStatuses.includes(status)) {
    throw new Error(`Invalid ai_guardrail_results.status: ${String(row.status)}`);
  }
  return {
    resultId: String(row.resultId),
    jobId: String(row.jobId),
    ruleName: String(row.ruleName),
    status,
    detail: row.detail === null ? null : String(row.detail),
    createdAt: String(row.createdAt)
  };
}

export type RecordGuardrailResultParams = {
  jobId: string;
  ruleName: string;
  status: AiGuardrailResultStatus;
  detail?: string | null;
  actorId?: string | null;
};

export function recordGuardrailResult(params: RecordGuardrailResultParams): AiGuardrailResultRecord {
  if (!aiGuardrailResultStatuses.includes(params.status)) throw new Error(`Invalid status: ${params.status}`);
  const ruleName = params.ruleName?.trim();
  if (!ruleName) throw new Error('recordGuardrailResult: ruleName required');

  const db = getDatabase();
  const jobRow = db.prepare(`SELECT job_id FROM ${aiJobsTable} WHERE job_id = ? LIMIT 1`).get(params.jobId);
  if (!jobRow) throw new Error(`recordGuardrailResult: job_id not found: ${params.jobId}`);

  const resultId = randomUUID();
  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO ${aiGuardrailResultsTable} (result_id, job_id, rule_name, status, detail, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(resultId, params.jobId, ruleName, params.status, params.detail ?? null, now);

    writeAuditLog({
      action: `ai_guardrail_${params.status}`,
      entityType: 'ai_guardrail_result',
      entityId: resultId,
      leadId: null,
      actorType: 'system',
      actorId: params.actorId ?? null,
      detail: { jobId: params.jobId, ruleName, status: params.status }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM ${aiGuardrailResultsTable} WHERE result_id = ? LIMIT 1`).get(resultId) as Record<string, unknown>;
  return normalizeRow(row);
}

export function listGuardrailResultsForJob(jobId: string): AiGuardrailResultRecord[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM ${aiGuardrailResultsTable} WHERE job_id = ? ORDER BY created_at ASC, result_id ASC`
  ).all(jobId) as Record<string, unknown>[];
  return rows.map(normalizeRow);
}

export function summarizeGuardrailResultsForJob(jobId: string): AiGuardrailResultSummary {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT
      COUNT(CASE WHEN status = 'pass' THEN 1 END) AS passed,
      COUNT(CASE WHEN status = 'warn' THEN 1 END) AS warned,
      COUNT(CASE WHEN status = 'block' THEN 1 END) AS blocked
    FROM ${aiGuardrailResultsTable}
    WHERE job_id = ?
  `).get(jobId) as Record<string, unknown>;
  return {
    passed: Number(row.passed),
    warned: Number(row.warned),
    blocked: Number(row.blocked)
  };
}
