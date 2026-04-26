import { randomUUID } from 'node:crypto';
import type { AiPromptTemplateRecord } from '@savastano-advisory/core';
import { writeAuditLog } from './audit-log';
import { aiPromptTemplatesTable, getDatabase } from './db';

const SELECT_COLUMNS = `
  template_id AS templateId,
  name,
  version,
  purpose,
  body,
  output_schema AS outputSchema,
  requires_grounding AS requiresGrounding,
  model_compatibility_min AS modelCompatibilityMin,
  model_compatibility_max AS modelCompatibilityMax,
  allowed_surfaces AS allowedSurfaces,
  active,
  created_at AS createdAt,
  deactivated_at AS deactivatedAt
`;

function parseAllowedSurfaces(raw: unknown): string[] | null {
  if (raw === null || raw === undefined) return null;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.map((entry) => String(entry)) : null;
  } catch {
    return null;
  }
}

function normalizeRow(row: Record<string, unknown>): AiPromptTemplateRecord {
  return {
    templateId: String(row.templateId),
    name: String(row.name),
    version: String(row.version),
    purpose: String(row.purpose),
    body: String(row.body),
    outputSchema: row.outputSchema === null ? null : String(row.outputSchema),
    requiresGrounding: Number(row.requiresGrounding) === 1,
    modelCompatibilityMin: row.modelCompatibilityMin === null ? null : String(row.modelCompatibilityMin),
    modelCompatibilityMax: row.modelCompatibilityMax === null ? null : String(row.modelCompatibilityMax),
    allowedSurfaces: parseAllowedSurfaces(row.allowedSurfaces),
    active: Number(row.active) === 1,
    createdAt: String(row.createdAt),
    deactivatedAt: row.deactivatedAt === null ? null : String(row.deactivatedAt)
  };
}

export type CreatePromptTemplateParams = {
  name: string;
  version: string;
  purpose: string;
  body: string;
  outputSchema?: string | null;
  requiresGrounding?: boolean;
  modelCompatibilityMin?: string | null;
  modelCompatibilityMax?: string | null;
  allowedSurfaces?: string[] | null;
  actorId?: string | null;
};

export function createPromptTemplate(params: CreatePromptTemplateParams): AiPromptTemplateRecord {
  const name = params.name?.trim();
  const version = params.version?.trim();
  const purpose = params.purpose?.trim();
  const body = params.body?.trim();
  if (!name || !version || !purpose || !body) {
    throw new Error('createPromptTemplate: name, version, purpose, and body are required');
  }

  const templateId = randomUUID();
  const now = new Date().toISOString();
  const allowedSurfacesJson = params.allowedSurfaces ? JSON.stringify(params.allowedSurfaces) : null;
  const requiresGrounding = params.requiresGrounding ? 1 : 0;

  const db = getDatabase();

  db.exec('BEGIN');
  try {
    db.prepare(`
      INSERT INTO ${aiPromptTemplatesTable} (
        template_id, name, version, purpose, body, output_schema, requires_grounding,
        model_compatibility_min, model_compatibility_max, allowed_surfaces, active, created_at, deactivated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NULL)
    `).run(
      templateId,
      name,
      version,
      purpose,
      body,
      params.outputSchema ?? null,
      requiresGrounding,
      params.modelCompatibilityMin ?? null,
      params.modelCompatibilityMax ?? null,
      allowedSurfacesJson,
      now
    );

    writeAuditLog({
      action: 'ai_prompt_template_created',
      entityType: 'ai_prompt_template',
      entityId: templateId,
      leadId: null,
      actorType: params.actorId ? 'operator' : 'system',
      actorId: params.actorId ?? null,
      detail: { name, version, purpose, requiresGrounding: Boolean(requiresGrounding) }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getPromptTemplate(templateId) as AiPromptTemplateRecord;
}

export function getPromptTemplate(templateId: string): AiPromptTemplateRecord | null {
  const db = getDatabase();
  const row = db.prepare(`SELECT ${SELECT_COLUMNS} FROM ${aiPromptTemplatesTable} WHERE template_id = ? LIMIT 1`).get(templateId) as
    | Record<string, unknown>
    | undefined;
  return row ? normalizeRow(row) : null;
}

export function getActiveTemplate(params: { name: string; version?: string }): AiPromptTemplateRecord | null {
  const db = getDatabase();
  const row = (params.version
    ? db.prepare(
        `SELECT ${SELECT_COLUMNS} FROM ${aiPromptTemplatesTable} WHERE name = ? AND version = ? AND active = 1 LIMIT 1`
      ).get(params.name, params.version)
    : db.prepare(
        `SELECT ${SELECT_COLUMNS} FROM ${aiPromptTemplatesTable} WHERE name = ? AND active = 1 ORDER BY created_at DESC LIMIT 1`
      ).get(params.name)) as Record<string, unknown> | undefined;
  return row ? normalizeRow(row) : null;
}

export function listActivePromptTemplates(params: { surface?: string } = {}): AiPromptTemplateRecord[] {
  const db = getDatabase();
  const rows = db.prepare(
    `SELECT ${SELECT_COLUMNS} FROM ${aiPromptTemplatesTable} WHERE active = 1 ORDER BY name ASC, version DESC`
  ).all() as Record<string, unknown>[];
  const normalized = rows.map(normalizeRow);
  if (!params.surface) return normalized;
  return normalized.filter((entry) => !entry.allowedSurfaces || entry.allowedSurfaces.includes(params.surface!));
}

export function deactivateTemplate(params: { templateId: string; actorId?: string | null }): AiPromptTemplateRecord | null {
  const current = getPromptTemplate(params.templateId);
  if (!current || !current.active) return current;

  const db = getDatabase();
  const now = new Date().toISOString();

  db.exec('BEGIN');
  try {
    db.prepare(
      `UPDATE ${aiPromptTemplatesTable} SET active = 0, deactivated_at = ? WHERE template_id = ?`
    ).run(now, params.templateId);

    writeAuditLog({
      action: 'ai_prompt_template_deactivated',
      entityType: 'ai_prompt_template',
      entityId: params.templateId,
      leadId: null,
      actorType: params.actorId ? 'operator' : 'system',
      actorId: params.actorId ?? null,
      detail: { name: current.name, version: current.version }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getPromptTemplate(params.templateId);
}

export function reactivateTemplate(params: { templateId: string; actorId?: string | null }): AiPromptTemplateRecord | null {
  const current = getPromptTemplate(params.templateId);
  if (!current || current.active) return current;

  const db = getDatabase();

  db.exec('BEGIN');
  try {
    db.prepare(
      `UPDATE ${aiPromptTemplatesTable} SET active = 1, deactivated_at = NULL WHERE template_id = ?`
    ).run(params.templateId);

    writeAuditLog({
      action: 'ai_prompt_template_reactivated',
      entityType: 'ai_prompt_template',
      entityId: params.templateId,
      leadId: null,
      actorType: params.actorId ? 'operator' : 'system',
      actorId: params.actorId ?? null,
      detail: { name: current.name, version: current.version }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getPromptTemplate(params.templateId);
}
