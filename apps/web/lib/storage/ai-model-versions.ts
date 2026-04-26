import { randomUUID } from 'node:crypto';
import {
  aiModelVersionStatusTransitions,
  aiModelVersionStatuses,
  type AiModelVersionRecord,
  type AiModelVersionStatus
} from '@savastano-advisory/core';
import { writeAuditLog } from './audit-log';
import { aiModelVersionsTable, getDatabase } from './db';

const SELECT_COLUMNS = `
  model_version_id AS modelVersionId,
  provider,
  model_id AS modelId,
  display_name AS displayName,
  status,
  input_price_json AS inputPriceJson,
  output_price_json AS outputPriceJson,
  pinned_at AS pinnedAt,
  deprecated_at AS deprecatedAt,
  blocked_at AS blockedAt,
  notes,
  created_at AS createdAt,
  updated_at AS updatedAt
`;

function normalizeRow(row: Record<string, unknown>): AiModelVersionRecord {
  const status = String(row.status) as AiModelVersionStatus;
  if (!aiModelVersionStatuses.includes(status)) {
    throw new Error(`Invalid ai_model_versions.status: ${String(row.status)}`);
  }
  return {
    modelVersionId: String(row.modelVersionId),
    provider: String(row.provider),
    modelId: String(row.modelId),
    displayName: String(row.displayName),
    status,
    inputPriceJson: row.inputPriceJson === null ? null : String(row.inputPriceJson),
    outputPriceJson: row.outputPriceJson === null ? null : String(row.outputPriceJson),
    pinnedAt: row.pinnedAt === null ? null : String(row.pinnedAt),
    deprecatedAt: row.deprecatedAt === null ? null : String(row.deprecatedAt),
    blockedAt: row.blockedAt === null ? null : String(row.blockedAt),
    notes: row.notes === null ? null : String(row.notes),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

export type RegisterModelVersionParams = {
  provider: string;
  modelId: string;
  displayName: string;
  inputPriceJson?: string | null;
  outputPriceJson?: string | null;
  notes?: string | null;
  actorId?: string | null;
};

export function registerModelVersion(params: RegisterModelVersionParams): AiModelVersionRecord {
  const provider = params.provider?.trim();
  const modelId = params.modelId?.trim();
  const displayName = params.displayName?.trim();
  if (!provider || !modelId || !displayName) {
    throw new Error('registerModelVersion: provider, modelId, and displayName are required');
  }

  const modelVersionId = randomUUID();
  const now = new Date().toISOString();
  const db = getDatabase();

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO ${aiModelVersionsTable} (
        model_version_id, provider, model_id, display_name, status,
        input_price_json, output_price_json, pinned_at, deprecated_at, blocked_at,
        notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 'candidate', ?, ?, NULL, NULL, NULL, ?, ?, ?)
    `).run(
      modelVersionId,
      provider,
      modelId,
      displayName,
      params.inputPriceJson ?? null,
      params.outputPriceJson ?? null,
      params.notes ?? null,
      now,
      now
    );

    writeAuditLog({
      action: 'ai_model_version_registered',
      entityType: 'ai_model_version',
      entityId: modelVersionId,
      leadId: null,
      actorType: params.actorId ? 'operator' : 'system',
      actorId: params.actorId ?? null,
      detail: { provider, modelId, displayName }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getModelVersion(modelVersionId) as AiModelVersionRecord;
}

export function getModelVersion(modelVersionId: string): AiModelVersionRecord | null {
  const db = getDatabase();
  const row = db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM ${aiModelVersionsTable} WHERE model_version_id = ? LIMIT 1`
  ).get(modelVersionId) as Record<string, unknown> | undefined;
  return row ? normalizeRow(row) : null;
}

export function getActiveModelVersion(params: { provider: string; modelId: string }): AiModelVersionRecord | null {
  const db = getDatabase();
  const row = db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM ${aiModelVersionsTable} WHERE provider = ? AND model_id = ? AND status = 'active' LIMIT 1`
  ).get(params.provider, params.modelId) as Record<string, unknown> | undefined;
  return row ? normalizeRow(row) : null;
}

export function listModelVersions(params: { status?: AiModelVersionStatus } = {}): AiModelVersionRecord[] {
  const db = getDatabase();
  const rows = (params.status
    ? db.prepare(
        `SELECT ${SELECT_COLUMNS} FROM ${aiModelVersionsTable} WHERE status = ? ORDER BY created_at DESC`
      ).all(params.status)
    : db.prepare(`SELECT ${SELECT_COLUMNS} FROM ${aiModelVersionsTable} ORDER BY created_at DESC`).all()) as Record<string, unknown>[];
  return rows.map(normalizeRow);
}

export type TransitionModelVersionParams = {
  modelVersionId: string;
  toStatus: AiModelVersionStatus;
  actorId?: string | null;
};

export function transitionModelVersion(params: TransitionModelVersionParams): AiModelVersionRecord | null {
  if (!aiModelVersionStatuses.includes(params.toStatus)) return null;

  const current = getModelVersion(params.modelVersionId);
  if (!current) return null;

  const allowed = aiModelVersionStatusTransitions[current.status];
  if (!allowed.includes(params.toStatus)) {
    throw new Error(`transitionModelVersion: invalid transition ${current.status} → ${params.toStatus}`);
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const pinnedAt = params.toStatus === 'active' ? now : current.pinnedAt;
  const deprecatedAt = params.toStatus === 'deprecated' ? now : current.deprecatedAt;
  const blockedAt = params.toStatus === 'blocked' ? now : current.blockedAt;

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE ${aiModelVersionsTable}
      SET status = ?, pinned_at = ?, deprecated_at = ?, blocked_at = ?, updated_at = ?
      WHERE model_version_id = ?
    `).run(params.toStatus, pinnedAt, deprecatedAt, blockedAt, now, params.modelVersionId);

    writeAuditLog({
      action: 'ai_model_version_transitioned',
      entityType: 'ai_model_version',
      entityId: params.modelVersionId,
      leadId: null,
      actorType: params.actorId ? 'operator' : 'system',
      actorId: params.actorId ?? null,
      detail: { fromStatus: current.status, toStatus: params.toStatus, provider: current.provider, modelId: current.modelId }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getModelVersion(params.modelVersionId);
}
