import { randomUUID } from 'node:crypto';
import {
  aiJobInputRedactionLevels,
  aiJobModel,
  aiJobStatuses,
  aiJobStatusTransitions,
  type AiJobInputRedactionLevel,
  type AiJobRecord,
  type AiJobStatus
} from '@savastano-advisory/core';
import { writeAuditLog } from './audit-log';
import { aiJobsTable, getDatabase, leadsTable } from './db';

const SELECT_COLUMNS = `
  job_id AS jobId,
  lead_id AS leadId,
  job_type AS jobType,
  surface,
  status,
  provider,
  model,
  model_version_id AS modelVersionId,
  prompt_template_id AS promptTemplateId,
  prompt_template_version AS promptTemplateVersion,
  input_hash AS inputHash,
  input_redaction_level AS inputRedactionLevel,
  output_hash AS outputHash,
  input_tokens AS inputTokens,
  output_tokens AS outputTokens,
  cached_input_tokens AS cachedInputTokens,
  cost_cents AS costCents,
  latency_ms AS latencyMs,
  budget_key AS budgetKey,
  cost_breakdown_json AS costBreakdownJson,
  created_by AS createdBy,
  created_at AS createdAt,
  started_at AS startedAt,
  completed_at AS completedAt,
  cancelled_at AS cancelledAt,
  cancel_reason AS cancelReason,
  error_message AS errorMessage
`;

function normalizeRow(row: Record<string, unknown>): AiJobRecord {
  const status = String(row.status) as AiJobStatus;
  if (!aiJobStatuses.includes(status)) {
    throw new Error(`Invalid ai_jobs.status: ${String(row.status)}`);
  }
  const inputRedactionLevel = String(row.inputRedactionLevel) as AiJobInputRedactionLevel;
  if (!aiJobInputRedactionLevels.includes(inputRedactionLevel)) {
    throw new Error(`Invalid ai_jobs.input_redaction_level: ${String(row.inputRedactionLevel)}`);
  }
  return {
    jobId: String(row.jobId),
    leadId: row.leadId === null ? null : String(row.leadId),
    jobType: String(row.jobType),
    surface: String(row.surface),
    status,
    provider: String(row.provider),
    model: String(row.model),
    modelVersionId: row.modelVersionId === null ? null : String(row.modelVersionId),
    promptTemplateId: String(row.promptTemplateId),
    promptTemplateVersion: String(row.promptTemplateVersion),
    inputHash: String(row.inputHash),
    inputRedactionLevel,
    outputHash: row.outputHash === null ? null : String(row.outputHash),
    inputTokens: Number(row.inputTokens),
    outputTokens: Number(row.outputTokens),
    cachedInputTokens: Number(row.cachedInputTokens),
    costCents: Number(row.costCents),
    latencyMs: row.latencyMs === null ? null : Number(row.latencyMs),
    budgetKey: row.budgetKey === null ? null : String(row.budgetKey),
    costBreakdownJson: row.costBreakdownJson === null ? null : String(row.costBreakdownJson),
    createdBy: String(row.createdBy),
    createdAt: String(row.createdAt),
    startedAt: row.startedAt === null ? null : String(row.startedAt),
    completedAt: row.completedAt === null ? null : String(row.completedAt),
    cancelledAt: row.cancelledAt === null ? null : String(row.cancelledAt),
    cancelReason: row.cancelReason === null ? null : String(row.cancelReason),
    errorMessage: row.errorMessage === null ? null : String(row.errorMessage)
  };
}

export type CreateAiJobParams = {
  leadId?: string | null;
  jobType: string;
  surface: string;
  provider: string;
  model: string;
  modelVersionId?: string | null;
  promptTemplateId: string;
  promptTemplateVersion: string;
  inputHash: string;
  inputRedactionLevel?: AiJobInputRedactionLevel;
  budgetKey?: string | null;
  createdBy: string;
  actorId?: string | null;
};

export function createAiJob(params: CreateAiJobParams): AiJobRecord {
  const db = getDatabase();
  const now = new Date().toISOString();
  const jobId = randomUUID();
  const inputRedactionLevel = params.inputRedactionLevel ?? aiJobModel.defaultInputRedactionLevel;
  const leadId = params.leadId ?? null;

  if (leadId !== null) {
    const leadRow = db.prepare(`SELECT lead_id FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`).get(leadId);
    if (!leadRow) throw new Error(`createAiJob: lead_id not found: ${leadId}`);
  }

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO ${aiJobsTable} (
        job_id, lead_id, job_type, surface, status, provider, model, model_version_id,
        prompt_template_id, prompt_template_version, input_hash, input_redaction_level,
        output_hash, input_tokens, output_tokens, cached_input_tokens, cost_cents, latency_ms,
        budget_key, cost_breakdown_json, created_by, created_at,
        started_at, completed_at, cancelled_at, cancel_reason, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 0, 0, 0, NULL, ?, NULL, ?, ?, NULL, NULL, NULL, NULL, NULL)
    `).run(
      jobId,
      leadId,
      params.jobType,
      params.surface,
      aiJobModel.defaultStatus,
      params.provider,
      params.model,
      params.modelVersionId ?? null,
      params.promptTemplateId,
      params.promptTemplateVersion,
      params.inputHash,
      inputRedactionLevel,
      params.budgetKey ?? null,
      params.createdBy,
      now
    );

    writeAuditLog({
      action: 'ai_job_created',
      entityType: 'ai_job',
      entityId: jobId,
      leadId,
      actorType: 'system',
      actorId: params.actorId ?? null,
      detail: {
        jobType: params.jobType,
        surface: params.surface,
        provider: params.provider,
        model: params.model,
        promptTemplateId: params.promptTemplateId,
        promptTemplateVersion: params.promptTemplateVersion
      }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM ${aiJobsTable} WHERE job_id = ? LIMIT 1`).get(jobId) as Record<string, unknown>;
  return normalizeRow(row);
}

export function getAiJob(jobId: string): AiJobRecord | null {
  const db = getDatabase();
  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM ${aiJobsTable} WHERE job_id = ? LIMIT 1`).get(jobId) as
    | Record<string, unknown>
    | undefined;
  return row ? normalizeRow(row) : null;
}

export function listAiJobs(params: { leadId?: string | null; status?: AiJobStatus; limit?: number } = {}): AiJobRecord[] {
  const db = getDatabase();
  const limit = Math.min(500, Math.max(1, Math.trunc(params.limit ?? 50)));
  const where: string[] = [];
  const args: string[] = [];
  if (params.leadId) {
    where.push('lead_id = ?');
    args.push(params.leadId);
  }
  if (params.status) {
    where.push('status = ?');
    args.push(params.status);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT ${SELECT_COLUMNS} FROM ${aiJobsTable} ${whereClause} ORDER BY created_at DESC, job_id DESC LIMIT ?`;
  const rows = db.prepare(sql).all(...args, limit) as Record<string, unknown>[];
  return rows.map(normalizeRow);
}

export type UpdateAiJobStatusParams = {
  jobId: string;
  status: AiJobStatus;
  outputHash?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  cachedInputTokens?: number;
  costCents?: number;
  latencyMs?: number | null;
  costBreakdownJson?: string | null;
  errorMessage?: string | null;
  actorId?: string | null;
};

export function updateAiJobStatus(params: UpdateAiJobStatusParams): AiJobRecord | null {
  if (!aiJobStatuses.includes(params.status)) return null;

  const current = getAiJob(params.jobId);
  if (!current) return null;

  const allowed = aiJobStatusTransitions[current.status];
  if (!allowed.includes(params.status)) {
    throw new Error(`updateAiJobStatus: invalid transition ${current.status} → ${params.status}`);
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const startedAt = params.status === 'running' && !current.startedAt ? now : current.startedAt;
  const completedAt = ['succeeded', 'failed', 'blocked_budget', 'blocked_guardrail'].includes(params.status)
    ? now
    : current.completedAt;

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE ${aiJobsTable}
      SET status = ?,
          output_hash = COALESCE(?, output_hash),
          input_tokens = COALESCE(?, input_tokens),
          output_tokens = COALESCE(?, output_tokens),
          cached_input_tokens = COALESCE(?, cached_input_tokens),
          cost_cents = COALESCE(?, cost_cents),
          latency_ms = COALESCE(?, latency_ms),
          cost_breakdown_json = COALESCE(?, cost_breakdown_json),
          started_at = ?,
          completed_at = ?,
          error_message = COALESCE(?, error_message)
      WHERE job_id = ?
    `).run(
      params.status,
      params.outputHash ?? null,
      params.inputTokens ?? null,
      params.outputTokens ?? null,
      params.cachedInputTokens ?? null,
      params.costCents ?? null,
      params.latencyMs ?? null,
      params.costBreakdownJson ?? null,
      startedAt,
      completedAt,
      params.errorMessage ?? null,
      params.jobId
    );

    writeAuditLog({
      action: 'ai_job_status_changed',
      entityType: 'ai_job',
      entityId: params.jobId,
      leadId: current.leadId,
      actorType: 'system',
      actorId: params.actorId ?? null,
      detail: { fromStatus: current.status, toStatus: params.status }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getAiJob(params.jobId);
}

export type CancelAiJobParams = {
  jobId: string;
  reason: string;
  actorId?: string | null;
};

export function cancelAiJob(params: CancelAiJobParams): AiJobRecord | null {
  const reason = params.reason?.trim();
  if (!reason) return null;

  const current = getAiJob(params.jobId);
  if (!current) return null;

  const allowed = aiJobStatusTransitions[current.status];
  if (!allowed.includes('cancelled')) {
    throw new Error(`cancelAiJob: cannot cancel job in status ${current.status}`);
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE ${aiJobsTable}
      SET status = 'cancelled', cancelled_at = ?, cancel_reason = ?, completed_at = ?
      WHERE job_id = ?
    `).run(now, reason, now, params.jobId);

    writeAuditLog({
      action: 'ai_job_cancelled',
      entityType: 'ai_job',
      entityId: params.jobId,
      leadId: current.leadId,
      actorType: params.actorId ? 'operator' : 'system',
      actorId: params.actorId ?? null,
      detail: { reason, fromStatus: current.status }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getAiJob(params.jobId);
}
