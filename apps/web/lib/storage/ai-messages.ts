import { randomUUID } from 'node:crypto';
import {
  aiMessageRoles,
  aiMessageSurfaces,
  type AiMessageRecord,
  type AiMessageRole,
  type AiMessageSurface
} from '@savastano-advisory/core';
import { writeAuditLog } from './audit-log';
import { aiJobsTable, aiMessagesTable, getDatabase, leadsTable } from './db';

const SELECT_COLUMNS = `
  message_id AS messageId,
  lead_id AS leadId,
  surface,
  role,
  content,
  classification,
  ai_job_id AS aiJobId,
  created_at AS createdAt
`;

function normalizeRow(row: Record<string, unknown>): AiMessageRecord {
  const surface = String(row.surface) as AiMessageSurface;
  if (!aiMessageSurfaces.includes(surface)) {
    throw new Error(`Invalid ai_messages.surface: ${String(row.surface)}`);
  }
  const role = String(row.role) as AiMessageRole;
  if (!aiMessageRoles.includes(role)) {
    throw new Error(`Invalid ai_messages.role: ${String(row.role)}`);
  }
  return {
    messageId: String(row.messageId),
    leadId: row.leadId === null ? null : String(row.leadId),
    surface,
    role,
    content: String(row.content),
    classification: row.classification === null ? null : String(row.classification),
    aiJobId: row.aiJobId === null ? null : String(row.aiJobId),
    createdAt: String(row.createdAt)
  };
}

export type AppendAiMessageParams = {
  leadId?: string | null;
  surface: AiMessageSurface;
  role: AiMessageRole;
  content: string;
  classification?: string | null;
  aiJobId?: string | null;
  actorId?: string | null;
};

export function appendAiMessage(params: AppendAiMessageParams): AiMessageRecord {
  if (!aiMessageSurfaces.includes(params.surface)) throw new Error(`Invalid surface: ${params.surface}`);
  if (!aiMessageRoles.includes(params.role)) throw new Error(`Invalid role: ${params.role}`);
  const content = params.content?.trim();
  if (!content) throw new Error('appendAiMessage: content required');

  const db = getDatabase();
  const leadId = params.leadId ?? null;
  if (leadId !== null) {
    const leadRow = db.prepare(`SELECT lead_id FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`).get(leadId);
    if (!leadRow) throw new Error(`appendAiMessage: lead_id not found: ${leadId}`);
  }

  const aiJobId = params.aiJobId ?? null;
  if (aiJobId !== null) {
    const jobRow = db.prepare(`SELECT job_id FROM ${aiJobsTable} WHERE job_id = ? LIMIT 1`).get(aiJobId);
    if (!jobRow) throw new Error(`appendAiMessage: ai_job_id not found: ${aiJobId}`);
  }

  const messageId = randomUUID();
  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO ${aiMessagesTable} (message_id, lead_id, surface, role, content, classification, ai_job_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(messageId, leadId, params.surface, params.role, content, params.classification ?? null, aiJobId, now);

    writeAuditLog({
      action: 'ai_message_appended',
      entityType: 'ai_message',
      entityId: messageId,
      leadId,
      actorType: 'system',
      actorId: params.actorId ?? null,
      detail: { surface: params.surface, role: params.role, aiJobId, classification: params.classification ?? null }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getAiMessage(messageId) as AiMessageRecord;
}

export function getAiMessage(messageId: string): AiMessageRecord | null {
  const db = getDatabase();
  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM ${aiMessagesTable} WHERE message_id = ? LIMIT 1`).get(messageId) as
    | Record<string, unknown>
    | undefined;
  return row ? normalizeRow(row) : null;
}

export function listAiMessages(params: { leadId: string; surface?: AiMessageSurface; limit?: number }): AiMessageRecord[] {
  const db = getDatabase();
  const limit = Math.min(500, Math.max(1, Math.trunc(params.limit ?? 100)));
  const rows = (params.surface
    ? db.prepare(
        `SELECT ${SELECT_COLUMNS} FROM ${aiMessagesTable} WHERE lead_id = ? AND surface = ? ORDER BY created_at DESC, message_id DESC LIMIT ?`
      ).all(params.leadId, params.surface, limit)
    : db.prepare(
        `SELECT ${SELECT_COLUMNS} FROM ${aiMessagesTable} WHERE lead_id = ? ORDER BY created_at DESC, message_id DESC LIMIT ?`
      ).all(params.leadId, limit)) as Record<string, unknown>[];
  return rows.map(normalizeRow);
}

export function listMessagesForJob(jobId: string): AiMessageRecord[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM ${aiMessagesTable} WHERE ai_job_id = ? ORDER BY created_at ASC, message_id ASC`
  ).all(jobId) as Record<string, unknown>[];
  return rows.map(normalizeRow);
}
