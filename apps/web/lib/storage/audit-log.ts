import { randomUUID } from 'node:crypto';
import { auditLogTable, getDatabase } from './db';
import type { AuditActorType, AuditLogEntry } from './types';

function normalizeLimit(limit?: number) {
  if (!Number.isFinite(limit)) {
    return 20;
  }

  return Math.min(200, Math.max(1, Math.trunc(limit as number)));
}

function normalizeOffset(offset?: number) {
  if (!Number.isFinite(offset)) {
    return 0;
  }

  return Math.max(0, Math.trunc(offset as number));
}

function normalizeLeadId(leadId?: string | null) {
  const trimmed = leadId?.trim();
  return trimmed ? trimmed : null;
}

function parseDetail(raw: unknown) {
  if (typeof raw !== 'string' || raw.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeActorId(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text ? text : null;
}

function normalizeRow(row: Record<string, unknown>): AuditLogEntry {
  return {
    id: String(row.id),
    action: String(row.action),
    entityType: String(row.entityType),
    entityId: String(row.entityId),
    leadId: row.leadId === null ? null : String(row.leadId),
    actorType: String(row.actorType) as AuditActorType,
    actorId: normalizeActorId(row.actorId),
    detail: parseDetail(row.detail),
    createdAt: String(row.createdAt)
  };
}

export function writeAuditLog(params: {
  action: string;
  entityType: string;
  entityId: string;
  leadId?: string | null;
  actorType: AuditActorType;
  detail?: Record<string, unknown> | null;
}) {
  const action = params.action.trim();
  const entityType = params.entityType.trim();
  const entityId = params.entityId.trim();

  if (!action || !entityType || !entityId) {
    throw new Error('Audit log requires action, entityType, and entityId.');
  }

  const db = getDatabase();
  const createdAt = new Date().toISOString();
  db.prepare(`
    INSERT INTO ${auditLogTable} (id, action, entity_type, entity_id, lead_id, actor_type, detail, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    randomUUID(),
    action,
    entityType,
    entityId,
    normalizeLeadId(params.leadId),
    params.actorType,
    params.detail ? JSON.stringify(params.detail) : null,
    createdAt
  );
}

export function listAuditLog(params: { leadId?: string | null; limit?: number; offset?: number }): AuditLogEntry[] {
  const db = getDatabase();
  const leadId = normalizeLeadId(params.leadId);
  const limit = normalizeLimit(params.limit);
  const offset = normalizeOffset(params.offset);
  const rows = (leadId
    ? db.prepare(`
        SELECT id, action, entity_type AS entityType, entity_id AS entityId, lead_id AS leadId,
          actor_type AS actorType, actor_id AS actorId, detail, created_at AS createdAt
        FROM ${auditLogTable}
        WHERE lead_id = ?
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?
      `).all(leadId, limit, offset)
    : db.prepare(`
        SELECT id, action, entity_type AS entityType, entity_id AS entityId, lead_id AS leadId,
          actor_type AS actorType, actor_id AS actorId, detail, created_at AS createdAt
        FROM ${auditLogTable}
        ORDER BY created_at DESC, id DESC
        LIMIT ? OFFSET ?
      `).all(limit, offset)) as Record<string, unknown>[];

  return rows.map(normalizeRow);
}

export function listAllAuditLog(params: { limit?: number; offset?: number } = {}): AuditLogEntry[] {
  return listAuditLog({ limit: params.limit, offset: params.offset });
}
