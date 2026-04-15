import { randomUUID } from 'node:crypto';
import { memoModel, memoStatuses, type MemoRecord, type MemoStatus } from '@bruno-advisory/core';
import { writeAuditLog } from './audit-log';
import { getDatabase, leadsTable, memoEventsTable, memosTable, researchWorkflowsTable } from './db';

function getLeadExists(leadId: string) {
  const db = getDatabase();
  const row = db.prepare(`SELECT lead_id AS leadId FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`).get(leadId);
  return Boolean(row);
}

function getWorkflowForLead(researchWorkflowId: string, leadId: string) {
  const db = getDatabase();
  const row = db.prepare(`SELECT id FROM ${researchWorkflowsTable} WHERE id = ? AND lead_id = ? LIMIT 1`).get(researchWorkflowId, leadId);
  return Boolean(row);
}

function normalizeMemoRow(row: Record<string, unknown>): MemoRecord {
  const status = String(row.status) as MemoStatus;
  if (!memoStatuses.includes(status)) {
    throw new Error(`Invalid memo status: ${String(row.status)}`);
  }

  return {
    id: String(row.id),
    leadId: String(row.leadId),
    researchWorkflowId: row.researchWorkflowId === null ? null : String(row.researchWorkflowId),
    title: String(row.title),
    body: String(row.body),
    status,
    reviewRejectionReason: row.reviewRejectionReason === null ? null : String(row.reviewRejectionReason),
    reviewedAt: row.reviewedAt === null ? null : String(row.reviewedAt),
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

function normalizeStatus(status: string) {
  return memoStatuses.includes(status as MemoStatus) ? (status as MemoStatus) : null;
}

function normalizeNonEmpty(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptionalWorkflowId(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeReason(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function insertReviewEvent(params: {
  memoId: string;
  action: 'approved' | 'rejected';
  reason?: string | null;
  createdAt: string;
}) {
  const db = getDatabase();
  db.prepare(`
    INSERT INTO ${memoEventsTable} (id, entity_id, action, reason, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(randomUUID(), params.memoId, params.action, normalizeReason(params.reason), params.createdAt);
}

export function createMemo(params: {
  leadId: string;
  title: string;
  body: string;
  researchWorkflowId?: string | null;
}): MemoRecord | null {
  if (!getLeadExists(params.leadId)) {
    return null;
  }

  const title = normalizeNonEmpty(params.title);
  const body = normalizeNonEmpty(params.body);
  const researchWorkflowId = normalizeOptionalWorkflowId(params.researchWorkflowId);

  if (!title || !body) {
    return null;
  }

  if (researchWorkflowId && !getWorkflowForLead(researchWorkflowId, params.leadId)) {
    return null;
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const memo: MemoRecord = {
    id: randomUUID(),
    leadId: params.leadId,
    researchWorkflowId,
    title,
    body,
    status: memoModel.defaultStatus,
    reviewRejectionReason: null,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now
  };

  db.prepare(`
    INSERT INTO ${memosTable} (id, lead_id, research_workflow_id, title, body, status, review_rejection_reason, reviewed_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    memo.id,
    memo.leadId,
    memo.researchWorkflowId,
    memo.title,
    memo.body,
    memo.status,
    memo.reviewRejectionReason,
    memo.reviewedAt,
    memo.createdAt,
    memo.updatedAt
  );

  return memo;
}

export function listMemos(leadId: string, status?: MemoStatus): MemoRecord[] {
  const db = getDatabase();
  const rows = (status
    ? db.prepare(`
        SELECT id, lead_id AS leadId, research_workflow_id AS researchWorkflowId, title, body, status,
          review_rejection_reason AS reviewRejectionReason,
          reviewed_at AS reviewedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM ${memosTable}
        WHERE lead_id = ? AND status = ?
        ORDER BY updated_at DESC, id DESC
      `).all(leadId, status)
    : db.prepare(`
        SELECT id, lead_id AS leadId, research_workflow_id AS researchWorkflowId, title, body, status,
          review_rejection_reason AS reviewRejectionReason,
          reviewed_at AS reviewedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM ${memosTable}
        WHERE lead_id = ?
        ORDER BY updated_at DESC, id DESC
      `).all(leadId)) as Record<string, unknown>[];

  return rows.map(normalizeMemoRow);
}

export function getMemo(id: string, leadId?: string): MemoRecord | null {
  const db = getDatabase();
  const row = (leadId
    ? db.prepare(`
        SELECT id, lead_id AS leadId, research_workflow_id AS researchWorkflowId, title, body, status,
          review_rejection_reason AS reviewRejectionReason,
          reviewed_at AS reviewedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM ${memosTable}
        WHERE id = ? AND lead_id = ?
        LIMIT 1
      `).get(id, leadId)
    : db.prepare(`
        SELECT id, lead_id AS leadId, research_workflow_id AS researchWorkflowId, title, body, status,
          review_rejection_reason AS reviewRejectionReason,
          reviewed_at AS reviewedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM ${memosTable}
        WHERE id = ?
        LIMIT 1
      `).get(id)) as Record<string, unknown> | undefined;

  return row ? normalizeMemoRow(row) : null;
}

export function updateStatus(params: {
  id: string;
  leadId: string;
  status: string;
  rejectionReason?: string | null;
}): MemoRecord | null {
  const normalizedStatus = normalizeStatus(params.status);
  if (!normalizedStatus) {
    return null;
  }

  const current = getMemo(params.id, params.leadId);
  if (!current) {
    return null;
  }

  const normalizedReason = normalizeReason(params.rejectionReason);
  const isApprove = normalizedStatus === 'approved';
  const isReject = normalizedStatus === 'rejected';

  if (isApprove && current.status !== 'pending_review') {
    return null;
  }

  if (isReject) {
    if (current.status !== 'pending_review' || !normalizedReason) {
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
      UPDATE ${memosTable}
      SET status = ?, review_rejection_reason = ?, reviewed_at = ?, updated_at = ?
      WHERE id = ? AND lead_id = ?
    `).run(normalizedStatus, nextRejectionReason, reviewedAt, updatedAt, params.id, params.leadId);

    if (isApprove || isReject) {
      insertReviewEvent({
        memoId: params.id,
        action: isApprove ? 'approved' : 'rejected',
        reason: isReject ? normalizedReason : null,
        createdAt: updatedAt
      });

      writeAuditLog({
        action: isApprove ? 'memo_approved' : 'memo_rejected',
        entityType: 'memo',
        entityId: params.id,
        leadId: params.leadId,
        actorType: 'operator',
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

  return getMemo(params.id, params.leadId);
}

export function updateBody(id: string, leadId: string, body: string): MemoRecord | null {
  const normalizedBody = normalizeNonEmpty(body);
  if (!normalizedBody) {
    return null;
  }

  const current = getMemo(id, leadId);
  if (!current) {
    return null;
  }

  const db = getDatabase();
  const updatedAt = new Date().toISOString();
  db.prepare(`UPDATE ${memosTable} SET body = ?, updated_at = ? WHERE id = ? AND lead_id = ?`)
    .run(normalizedBody, updatedAt, id, leadId);

  return getMemo(id, leadId);
}

export function deleteMemo(id: string, leadId: string) {
  const db = getDatabase();
  const result = db.prepare(`DELETE FROM ${memosTable} WHERE id = ? AND lead_id = ?`).run(id, leadId);
  return result.changes > 0;
}
