import { getDatabase, leadsTable, memosTable, researchWorkflowsTable } from './db';
import type { ReviewQueueItem } from './types';

export function listReviewQueueItems(): ReviewQueueItem[] {
  const db = getDatabase();
  const memoRows = db.prepare(`
    SELECT
      'memo' AS type,
      m.id AS id,
      m.lead_id AS leadId,
      l.full_name AS leadName,
      m.title AS title,
      m.status AS status,
      m.created_at AS createdAt,
      m.updated_at AS updatedAt
    FROM ${memosTable} m
    INNER JOIN ${leadsTable} l ON l.lead_id = m.lead_id
    WHERE m.status = 'pending_review'
  `).all() as Record<string, unknown>[];

  const workflowRows = db.prepare(`
    SELECT
      'research_workflow' AS type,
      w.id AS id,
      w.lead_id AS leadId,
      l.full_name AS leadName,
      w.title AS title,
      w.status AS status,
      w.created_at AS createdAt,
      w.updated_at AS updatedAt
    FROM ${researchWorkflowsTable} w
    INNER JOIN ${leadsTable} l ON l.lead_id = w.lead_id
    WHERE w.status = 'review'
  `).all() as Record<string, unknown>[];

  return [...memoRows, ...workflowRows]
    .map((row): ReviewQueueItem => ({
      type: row.type === 'memo' ? 'memo' : 'research_workflow',
      id: String(row.id),
      leadId: String(row.leadId),
      leadName: String(row.leadName),
      title: String(row.title),
      status: String(row.status),
      createdAt: String(row.createdAt),
      updatedAt: String(row.updatedAt)
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
}
