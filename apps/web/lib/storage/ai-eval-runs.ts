import { randomUUID } from 'node:crypto';
import {
  aiEvalRunStatuses,
  type AiEvalRunRecord,
  type AiEvalRunStatus
} from '@savastano-advisory/core';
import { writeAuditLog } from './audit-log';
import {
  aiEvalCasesTable,
  aiEvalRunsTable,
  aiModelVersionsTable,
  aiPromptTemplatesTable,
  getDatabase
} from './db';

const SELECT_COLUMNS = `
  run_id AS runId,
  model_version_id AS modelVersionId,
  prompt_template_id AS promptTemplateId,
  case_id AS caseId,
  status,
  metrics_json AS metricsJson,
  output_json AS outputJson,
  created_at AS createdAt
`;

function normalizeRow(row: Record<string, unknown>): AiEvalRunRecord {
  const status = String(row.status) as AiEvalRunStatus;
  if (!aiEvalRunStatuses.includes(status)) {
    throw new Error(`Invalid ai_eval_runs.status: ${String(row.status)}`);
  }
  return {
    runId: String(row.runId),
    modelVersionId: String(row.modelVersionId),
    promptTemplateId: String(row.promptTemplateId),
    caseId: String(row.caseId),
    status,
    metricsJson: row.metricsJson === null ? null : String(row.metricsJson),
    outputJson: row.outputJson === null ? null : String(row.outputJson),
    createdAt: String(row.createdAt)
  };
}

export type RecordEvalRunParams = {
  modelVersionId: string;
  promptTemplateId: string;
  caseId: string;
  status: AiEvalRunStatus;
  metricsJson?: string | null;
  outputJson?: string | null;
  actorId?: string | null;
};

export function recordEvalRun(params: RecordEvalRunParams): AiEvalRunRecord {
  if (!aiEvalRunStatuses.includes(params.status)) throw new Error(`Invalid status: ${params.status}`);

  const db = getDatabase();
  if (!db.prepare(`SELECT model_version_id FROM ${aiModelVersionsTable} WHERE model_version_id = ? LIMIT 1`).get(params.modelVersionId)) {
    throw new Error(`recordEvalRun: model_version_id not found: ${params.modelVersionId}`);
  }
  if (!db.prepare(`SELECT template_id FROM ${aiPromptTemplatesTable} WHERE template_id = ? LIMIT 1`).get(params.promptTemplateId)) {
    throw new Error(`recordEvalRun: prompt_template_id not found: ${params.promptTemplateId}`);
  }
  if (!db.prepare(`SELECT case_id FROM ${aiEvalCasesTable} WHERE case_id = ? LIMIT 1`).get(params.caseId)) {
    throw new Error(`recordEvalRun: case_id not found: ${params.caseId}`);
  }

  const runId = randomUUID();
  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO ${aiEvalRunsTable} (run_id, model_version_id, prompt_template_id, case_id, status, metrics_json, output_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(runId, params.modelVersionId, params.promptTemplateId, params.caseId, params.status, params.metricsJson ?? null, params.outputJson ?? null, now);

    writeAuditLog({
      action: `ai_eval_run_${params.status}`,
      entityType: 'ai_eval_run',
      entityId: runId,
      leadId: null,
      actorType: 'system',
      actorId: params.actorId ?? null,
      detail: { modelVersionId: params.modelVersionId, promptTemplateId: params.promptTemplateId, caseId: params.caseId, status: params.status }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM ${aiEvalRunsTable} WHERE run_id = ? LIMIT 1`).get(runId) as Record<string, unknown>;
  return normalizeRow(row);
}

export function listEvalRunsForCase(caseId: string): AiEvalRunRecord[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM ${aiEvalRunsTable} WHERE case_id = ? ORDER BY created_at DESC, run_id DESC`
  ).all(caseId) as Record<string, unknown>[];
  return rows.map(normalizeRow);
}

export function listEvalRunsForModelVersion(modelVersionId: string): AiEvalRunRecord[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM ${aiEvalRunsTable} WHERE model_version_id = ? ORDER BY created_at DESC, run_id DESC`
  ).all(modelVersionId) as Record<string, unknown>[];
  return rows.map(normalizeRow);
}
