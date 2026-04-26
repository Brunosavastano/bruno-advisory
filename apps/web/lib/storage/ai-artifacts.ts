import { randomUUID } from 'node:crypto';
import {
  aiArtifactModel,
  aiArtifactStatusTransitions,
  aiArtifactStatuses,
  type AiArtifactRecord,
  type AiArtifactStatus
} from '@savastano-advisory/core';
import { writeAuditLog } from './audit-log';
import { aiArtifactsTable, aiJobsTable, getDatabase, leadsTable } from './db';

const SELECT_COLUMNS = `
  artifact_id AS artifactId,
  job_id AS jobId,
  lead_id AS leadId,
  artifact_type AS artifactType,
  title,
  body,
  json_payload AS jsonPayload,
  requires_grounding AS requiresGrounding,
  status,
  created_at AS createdAt,
  reviewed_by AS reviewedBy,
  reviewed_at AS reviewedAt,
  rejection_reason AS rejectionReason,
  archived_at AS archivedAt
`;

function normalizeRow(row: Record<string, unknown>): AiArtifactRecord {
  const status = String(row.status) as AiArtifactStatus;
  if (!aiArtifactStatuses.includes(status)) {
    throw new Error(`Invalid ai_artifacts.status: ${String(row.status)}`);
  }
  return {
    artifactId: String(row.artifactId),
    jobId: String(row.jobId),
    leadId: row.leadId === null ? null : String(row.leadId),
    artifactType: String(row.artifactType),
    title: String(row.title),
    body: String(row.body),
    jsonPayload: row.jsonPayload === null ? null : String(row.jsonPayload),
    requiresGrounding: Number(row.requiresGrounding) === 1,
    status,
    createdAt: String(row.createdAt),
    reviewedBy: row.reviewedBy === null ? null : String(row.reviewedBy),
    reviewedAt: row.reviewedAt === null ? null : String(row.reviewedAt),
    rejectionReason: row.rejectionReason === null ? null : String(row.rejectionReason),
    archivedAt: row.archivedAt === null ? null : String(row.archivedAt)
  };
}

export type CreateAiArtifactParams = {
  jobId: string;
  leadId?: string | null;
  artifactType: string;
  title: string;
  body: string;
  jsonPayload?: string | null;
  requiresGrounding?: boolean;
  status?: AiArtifactStatus;
  actorId?: string | null;
};

export function createAiArtifact(params: CreateAiArtifactParams): AiArtifactRecord {
  const db = getDatabase();
  const jobRow = db.prepare(`SELECT job_id FROM ${aiJobsTable} WHERE job_id = ? LIMIT 1`).get(params.jobId);
  if (!jobRow) throw new Error(`createAiArtifact: job_id not found: ${params.jobId}`);

  const leadId = params.leadId ?? null;
  if (leadId !== null) {
    const leadRow = db.prepare(`SELECT lead_id FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`).get(leadId);
    if (!leadRow) throw new Error(`createAiArtifact: lead_id not found: ${leadId}`);
  }

  const status = params.status ?? aiArtifactModel.defaultStatus;
  const requiresGrounding = params.requiresGrounding ? 1 : 0;
  const artifactId = randomUUID();
  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO ${aiArtifactsTable} (
        artifact_id, job_id, lead_id, artifact_type, title, body, json_payload,
        requires_grounding, status, created_at, reviewed_by, reviewed_at, rejection_reason, archived_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL)
    `).run(
      artifactId,
      params.jobId,
      leadId,
      params.artifactType,
      params.title,
      params.body,
      params.jsonPayload ?? null,
      requiresGrounding,
      status,
      now
    );

    writeAuditLog({
      action: 'ai_artifact_created',
      entityType: 'ai_artifact',
      entityId: artifactId,
      leadId,
      actorType: 'system',
      actorId: params.actorId ?? null,
      detail: { jobId: params.jobId, artifactType: params.artifactType, status, requiresGrounding: Boolean(requiresGrounding) }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getAiArtifact(artifactId) as AiArtifactRecord;
}

export function getAiArtifact(artifactId: string): AiArtifactRecord | null {
  const db = getDatabase();
  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM ${aiArtifactsTable} WHERE artifact_id = ? LIMIT 1`).get(artifactId) as
    | Record<string, unknown>
    | undefined;
  return row ? normalizeRow(row) : null;
}

export function listArtifactsForJob(jobId: string): AiArtifactRecord[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM ${aiArtifactsTable} WHERE job_id = ? ORDER BY created_at DESC, artifact_id DESC`
  ).all(jobId) as Record<string, unknown>[];
  return rows.map(normalizeRow);
}

export function listArtifactsForLead(params: { leadId: string; status?: AiArtifactStatus }): AiArtifactRecord[] {
  const db = getDatabase();
  const rows = (params.status
    ? db.prepare(
        `SELECT ${SELECT_COLUMNS} FROM ${aiArtifactsTable} WHERE lead_id = ? AND status = ? ORDER BY created_at DESC, artifact_id DESC`
      ).all(params.leadId, params.status)
    : db.prepare(
        `SELECT ${SELECT_COLUMNS} FROM ${aiArtifactsTable} WHERE lead_id = ? ORDER BY created_at DESC, artifact_id DESC`
      ).all(params.leadId)) as Record<string, unknown>[];
  return rows.map(normalizeRow);
}

export type UpdateArtifactStatusParams = {
  artifactId: string;
  status: AiArtifactStatus;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  actorId?: string | null;
};

export function updateArtifactStatus(params: UpdateArtifactStatusParams): AiArtifactRecord | null {
  if (!aiArtifactStatuses.includes(params.status)) return null;

  const current = getAiArtifact(params.artifactId);
  if (!current) return null;

  const allowed = aiArtifactStatusTransitions[current.status];
  if (!allowed.includes(params.status)) {
    throw new Error(`updateArtifactStatus: invalid transition ${current.status} → ${params.status}`);
  }

  if (params.status === 'rejected' && !params.rejectionReason?.trim()) {
    throw new Error('updateArtifactStatus: rejection_reason required when status=rejected');
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const reviewedAt = params.status === 'approved' || params.status === 'rejected' ? now : current.reviewedAt;
  const reviewedBy = params.status === 'approved' || params.status === 'rejected'
    ? params.reviewedBy ?? params.actorId ?? null
    : current.reviewedBy;
  const rejectionReason = params.status === 'rejected' ? params.rejectionReason!.trim() : null;

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE ${aiArtifactsTable}
      SET status = ?, reviewed_by = ?, reviewed_at = ?, rejection_reason = ?
      WHERE artifact_id = ?
    `).run(params.status, reviewedBy, reviewedAt, rejectionReason, params.artifactId);

    writeAuditLog({
      action: `ai_artifact_${params.status}`,
      entityType: 'ai_artifact',
      entityId: params.artifactId,
      leadId: current.leadId,
      actorType: params.actorId ? 'operator' : 'system',
      actorId: params.actorId ?? null,
      detail: { fromStatus: current.status, toStatus: params.status, rejectionReason }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getAiArtifact(params.artifactId);
}

export function archiveArtifact(params: { artifactId: string; actorId?: string | null }): AiArtifactRecord | null {
  const current = getAiArtifact(params.artifactId);
  if (!current) return null;

  const allowed = aiArtifactStatusTransitions[current.status];
  if (!allowed.includes('archived')) {
    throw new Error(`archiveArtifact: cannot archive from status ${current.status}`);
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(
      `UPDATE ${aiArtifactsTable} SET status = 'archived', archived_at = ? WHERE artifact_id = ?`
    ).run(now, params.artifactId);

    writeAuditLog({
      action: 'ai_artifact_archived',
      entityType: 'ai_artifact',
      entityId: params.artifactId,
      leadId: current.leadId,
      actorType: params.actorId ? 'operator' : 'system',
      actorId: params.actorId ?? null,
      detail: { fromStatus: current.status }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getAiArtifact(params.artifactId);
}
