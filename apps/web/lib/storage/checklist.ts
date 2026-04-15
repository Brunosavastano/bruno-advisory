import { randomUUID } from 'node:crypto';
import {
  onboardingChecklistStatuses,
  type OnboardingChecklistCompletionActor,
  type OnboardingChecklistItem,
  type OnboardingChecklistStatus
} from '@bruno-advisory/core';
import { writeAuditLog } from './audit-log';
import { getDatabase, leadsTable, onboardingChecklistItemsTable } from './db';

function normalizeChecklistRow(row: Record<string, unknown>): OnboardingChecklistItem {
  const status = String(row.status) as OnboardingChecklistStatus;
  if (!onboardingChecklistStatuses.includes(status)) {
    throw new Error(`Invalid checklist item status: ${String(row.status)}`);
  }

  const completedBy = row.completedBy === null ? null : (String(row.completedBy) as OnboardingChecklistCompletionActor);

  return {
    itemId: String(row.itemId),
    leadId: String(row.leadId),
    title: String(row.title),
    description: row.description === null ? null : String(row.description),
    status,
    createdAt: String(row.createdAt),
    completedAt: row.completedAt === null ? null : String(row.completedAt),
    completedBy
  };
}

function getLeadExists(leadId: string) {
  const db = getDatabase();
  const row = db.prepare(`SELECT lead_id AS leadId FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`).get(leadId);
  return Boolean(row);
}

export function listChecklistItems(leadId: string): OnboardingChecklistItem[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      item_id AS itemId,
      lead_id AS leadId,
      title,
      description,
      status,
      created_at AS createdAt,
      completed_at AS completedAt,
      completed_by AS completedBy
    FROM ${onboardingChecklistItemsTable}
    WHERE lead_id = ?
    ORDER BY created_at ASC, item_id ASC
  `).all(leadId) as Record<string, unknown>[];

  return rows.map(normalizeChecklistRow);
}

export function createChecklistItem(leadId: string, title: string, description?: string | null): OnboardingChecklistItem | null {
  if (!getLeadExists(leadId)) {
    return null;
  }

  const normalizedTitle = title.trim();
  if (!normalizedTitle) {
    return null;
  }

  const normalizedDescription = description?.trim() ? description.trim() : null;
  const itemId = randomUUID();
  const createdAt = new Date().toISOString();
  const db = getDatabase();

  db.prepare(`
    INSERT INTO ${onboardingChecklistItemsTable} (
      item_id,
      lead_id,
      title,
      description,
      status,
      created_at,
      completed_at,
      created_by,
      completed_by
    ) VALUES (?, ?, ?, ?, 'pending', ?, NULL, 'operator', NULL)
  `).run(itemId, leadId, normalizedTitle, normalizedDescription, createdAt);

  return {
    itemId,
    leadId,
    title: normalizedTitle,
    description: normalizedDescription,
    status: 'pending',
    createdAt,
    completedAt: null,
    completedBy: null
  };
}

export function completeChecklistItem(itemId: string, leadId: string, completedBy: OnboardingChecklistCompletionActor): OnboardingChecklistItem | null {
  const db = getDatabase();
  const completedAt = new Date().toISOString();
  const result = db.prepare(`
    UPDATE ${onboardingChecklistItemsTable}
    SET status = 'completed', completed_at = ?, completed_by = ?
    WHERE item_id = ? AND lead_id = ?
  `).run(completedAt, completedBy, itemId, leadId);

  if (result.changes === 0) {
    return null;
  }

  const row = db.prepare(`
    SELECT
      item_id AS itemId,
      lead_id AS leadId,
      title,
      description,
      status,
      created_at AS createdAt,
      completed_at AS completedAt,
      completed_by AS completedBy
    FROM ${onboardingChecklistItemsTable}
    WHERE item_id = ? AND lead_id = ?
    LIMIT 1
  `).get(itemId, leadId) as Record<string, unknown> | undefined;

  const item = row ? normalizeChecklistRow(row) : null;
  if (item) {
    writeAuditLog({
      action: 'checklist_item_completed',
      entityType: 'checklist_item',
      entityId: item.itemId,
      leadId: item.leadId,
      actorType: completedBy === 'client' ? 'client' : 'operator',
      detail: {
        title: item.title,
        completedBy: item.completedBy
      }
    });
  }

  return item;
}

export function uncompleteChecklistItem(itemId: string, leadId: string): OnboardingChecklistItem | null {
  const db = getDatabase();
  const result = db.prepare(`
    UPDATE ${onboardingChecklistItemsTable}
    SET status = 'pending', completed_at = NULL, completed_by = NULL
    WHERE item_id = ? AND lead_id = ?
  `).run(itemId, leadId);

  if (result.changes === 0) {
    return null;
  }

  const row = db.prepare(`
    SELECT
      item_id AS itemId,
      lead_id AS leadId,
      title,
      description,
      status,
      created_at AS createdAt,
      completed_at AS completedAt,
      completed_by AS completedBy
    FROM ${onboardingChecklistItemsTable}
    WHERE item_id = ? AND lead_id = ?
    LIMIT 1
  `).get(itemId, leadId) as Record<string, unknown> | undefined;

  return row ? normalizeChecklistRow(row) : null;
}

export function deleteChecklistItem(itemId: string, leadId: string) {
  const db = getDatabase();
  const result = db.prepare(`DELETE FROM ${onboardingChecklistItemsTable} WHERE item_id = ? AND lead_id = ?`).run(itemId, leadId);
  return result.changes > 0;
}
