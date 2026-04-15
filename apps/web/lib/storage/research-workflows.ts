import { randomUUID } from 'node:crypto';
import {
  researchWorkflowModel,
  researchWorkflowStatuses,
  type ResearchWorkflowRecord,
  type ResearchWorkflowStatus
} from '@bruno-advisory/core';
import { writeAuditLog } from './audit-log';
import { getDatabase, leadsTable, researchWorkflowEventsTable, researchWorkflowsTable } from './db';

function getLeadExists(leadId: string) {
  const db = getDatabase();
  const row = db.prepare(`SELECT lead_id AS leadId FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`).get(leadId);
  return Boolean(row);
}

function normalizeWorkflowRow(row: Record<string, unknown>): ResearchWorkflowRecord {
  const status = String(row.status) as ResearchWorkflowStatus;
  if (!researchWorkflowStatuses.includes(status)) {
    throw new Error(`Invalid research workflow status: ${String(row.status)}`);
  }

  return {
    id: String(row.id),
    leadId: String(row.leadId),
    title: String(row.title),
    topic: String(row.topic),
    status,
    reviewRejectionReason: row.reviewRejectionReason === null ? null : String(row.reviewRejectionReason),
    reviewedAt: row.reviewedAt === null ? null : String(row.reviewedAt),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

function normalizeStatus(status: string) {
  return researchWorkflowStatuses.includes(status as ResearchWorkflowStatus)
    ? (status as ResearchWorkflowStatus)
    : null;
}

function normalizeNonEmpty(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeReason(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function insertReviewEvent(params: {
  workflowId: string;
  action: 'approved' | 'rejected';
  reason?: string | null;
  createdAt: string;
}) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO ${researchWorkflowEventsTable} (id, entity_id, action, reason, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), params.workflowId, params.action, normalizeReason(params.reason), params.createdAt);
}

export function createWorkflow(leadId: string, title: string, topic: string): ResearchWorkflowRecord | null {
  if (!getLeadExists(leadId)) {
    return null;
  }

  const normalizedTitle = normalizeNonEmpty(title);
  const normalizedTopic = normalizeNonEmpty(topic);
  if (!normalizedTitle || !normalizedTopic) {
    return null;
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const workflow: ResearchWorkflowRecord = {
    id: randomUUID(),
    leadId,
    title: normalizedTitle,
    topic: normalizedTopic,
    status: researchWorkflowModel.defaultStatus,
    reviewRejectionReason: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now
  };

  db.prepare(`
    INSERT INTO ${researchWorkflowsTable} (id, lead_id, title, topic, status, review_rejection_reason, reviewed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    workflow.id,
    workflow.leadId,
    workflow.title,
    workflow.topic,
    workflow.status,
    workflow.reviewRejectionReason,
    workflow.reviewedAt,
    workflow.createdAt,
    workflow.updatedAt
  );

  return workflow;
}

export function listWorkflows(leadId: string, status?: ResearchWorkflowStatus): ResearchWorkflowRecord[] {
  const db = getDatabase();
  const rows = (status
    ? db.prepare(`
        SELECT id, lead_id AS leadId, title, topic, status,
          review_rejection_reason AS reviewRejectionReason,
          reviewed_at AS reviewedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM ${researchWorkflowsTable}
        WHERE lead_id = ? AND status = ?
        ORDER BY updated_at DESC, id DESC
      `).all(leadId, status)
    : db.prepare(`
        SELECT id, lead_id AS leadId, title, topic, status,
          review_rejection_reason AS reviewRejectionReason,
          reviewed_at AS reviewedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM ${researchWorkflowsTable}
        WHERE lead_id = ?
        ORDER BY updated_at DESC, id DESC
      `).all(leadId)) as Record<string, unknown>[];

  return rows.map(normalizeWorkflowRow);
}

export function getWorkflow(id: string, leadId?: string): ResearchWorkflowRecord | null {
  const db = getDatabase();
  const row = (leadId
    ? db.prepare(`
        SELECT id, lead_id AS leadId, title, topic, status,
          review_rejection_reason AS reviewRejectionReason,
          reviewed_at AS reviewedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM ${researchWorkflowsTable}
        WHERE id = ? AND lead_id = ?
        LIMIT 1
      `).get(id, leadId)
    : db.prepare(`
        SELECT id, lead_id AS leadId, title, topic, status,
          review_rejection_reason AS reviewRejectionReason,
          reviewed_at AS reviewedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM ${researchWorkflowsTable}
        WHERE id = ?
        LIMIT 1
      `).get(id)) as Record<string, unknown> | undefined;

  return row ? normalizeWorkflowRow(row) : null;
}

export function updateStatus(params: {
  id: string;
  leadId: string;
  status: string;
  rejectionReason?: string | null;
  actorId?: string | null;
}): ResearchWorkflowRecord | null {
  const normalizedStatus = normalizeStatus(params.status);
  if (!normalizedStatus) {
    return null;
  }

  const current = getWorkflow(params.id, params.leadId);
  if (!current) {
    return null;
  }

  const normalizedReason = normalizeReason(params.rejectionReason);
  const isApprove = normalizedStatus === 'approved';
  const isReject = normalizedStatus === 'rejected';

  if (isApprove && current.status !== 'review') {
    return null;
  }

  if (isReject) {
    if (current.status !== 'review' || !normalizedReason) {
      return null;
    }
  }

  const reviewedAt = isApprove || isReject ? new Date().toISOString() : current.reviewedAt;
  const updatedAt = new Date().toISOString();
  const nextRejectionReason = isReject ? normalizedReason : normalizedStatus === 'approved' ? null : current.reviewRejectionReason;
  const db = getDatabase();

  db.exec('BEGIN');
  try {
    db.prepare(`
      UPDATE ${researchWorkflowsTable}
      SET status = ?, review_rejection_reason = ?, reviewed_at = ?, updated_at = ?
      WHERE id = ? AND lead_id = ?
    `).run(normalizedStatus, nextRejectionReason, reviewedAt, updatedAt, params.id, params.leadId);

    if (isApprove || isReject) {
      insertReviewEvent({
        workflowId: params.id,
        action: isApprove ? 'approved' : 'rejected',
        reason: isReject ? normalizedReason : null,
        createdAt: updatedAt
      });

      writeAuditLog({
        action: isApprove ? 'research_workflow_approved' : 'research_workflow_rejected',
        entityType: 'research_workflow',
        entityId: params.id,
        leadId: params.leadId,
        actorType: 'operator',
        actorId: params.actorId ?? null,
        detail: {
          status: normalizedStatus,
          rejectionReason: isReject ? normalizedReason : null
        }
      });
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getWorkflow(params.id, params.leadId);
}

export function deleteWorkflow(id: string, leadId: string) {
  const db = getDatabase();
  const result = db.prepare(`DELETE FROM ${researchWorkflowsTable} WHERE id = ? AND lead_id = ?`).run(id, leadId);
  return result.changes > 0;
}
