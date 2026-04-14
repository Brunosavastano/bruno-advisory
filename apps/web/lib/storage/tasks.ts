import { randomUUID } from 'node:crypto';
import { getDatabase, leadsTable, taskAuditTable, tasksTable, toOptionalDateString } from './db';
import { leadTaskStatuses, type LeadInternalTask, type LeadInternalTaskAuditRecord, type LeadTaskStatus } from './types';

export function isLeadTaskStatus(value: unknown): value is LeadTaskStatus {
  return typeof value === 'string' && leadTaskStatuses.includes(value as LeadTaskStatus);
}

export function createLeadInternalTask(params: {
  leadId: string;
  title: string;
  status: LeadTaskStatus;
  dueDate?: string;
}): LeadInternalTask | null {
  const db = getDatabase();
  const now = new Date().toISOString();
  const cleanTitle = params.title.trim();

  if (!cleanTitle || !isLeadTaskStatus(params.status)) {
    return null;
  }

  const leadExists = db.prepare(`SELECT 1 FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`).get(params.leadId);
  if (!leadExists) {
    return null;
  }

  const dueDate = toOptionalDateString(params.dueDate);
  const taskId = randomUUID();
  db.prepare(`INSERT INTO ${tasksTable} (task_id, lead_id, title, status, due_date, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(taskId, params.leadId, cleanTitle, params.status, dueDate, now);

  return { taskId, leadId: params.leadId, title: cleanTitle, status: params.status, dueDate, createdAt: now };
}

export function listLeadInternalTasks(leadId: string, limit = 100): LeadInternalTask[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT task_id AS taskId, lead_id AS leadId, title, status, due_date AS dueDate, created_at AS createdAt
    FROM ${tasksTable}
    WHERE lead_id = ?
    ORDER BY created_at DESC, task_id DESC
    LIMIT ?
  `).all(leadId, limit) as Record<string, unknown>[];

  return rows.filter((row) => isLeadTaskStatus(row.status)).map((row) => ({
    taskId: String(row.taskId),
    leadId: String(row.leadId),
    title: String(row.title),
    status: row.status as LeadTaskStatus,
    dueDate: row.dueDate === null ? null : String(row.dueDate),
    createdAt: String(row.createdAt)
  }));
}

export function updateLeadInternalTaskStatus(params: {
  leadId: string;
  taskId: string;
  toStatus: LeadTaskStatus;
  changedBy: string;
}) {
  const db = getDatabase();
  const now = new Date().toISOString();
  const cleanChangedBy = params.changedBy.trim();

  if (!isLeadTaskStatus(params.toStatus) || !cleanChangedBy) {
    return null;
  }

  const taskRow = db.prepare(`
    SELECT task_id AS taskId, lead_id AS leadId, title, status, due_date AS dueDate, created_at AS createdAt
    FROM ${tasksTable}
    WHERE task_id = ? AND lead_id = ?
    LIMIT 1
  `).get(params.taskId, params.leadId) as Record<string, unknown> | undefined;

  if (!taskRow || !isLeadTaskStatus(taskRow.status)) {
    return null;
  }

  const fromStatus = taskRow.status as LeadTaskStatus;

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE ${tasksTable} SET status = ? WHERE task_id = ? AND lead_id = ?`)
      .run(params.toStatus, params.taskId, params.leadId);

    db.prepare(`INSERT INTO ${taskAuditTable} (audit_id, lead_id, task_id, from_status, to_status, changed_at, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(randomUUID(), params.leadId, params.taskId, fromStatus, params.toStatus, now, cleanChangedBy);

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return {
    task: {
      taskId: String(taskRow.taskId),
      leadId: String(taskRow.leadId),
      title: String(taskRow.title),
      status: params.toStatus,
      dueDate: taskRow.dueDate === null ? null : String(taskRow.dueDate),
      createdAt: String(taskRow.createdAt)
    } satisfies LeadInternalTask,
    changedFrom: fromStatus,
    changedTo: params.toStatus,
    changedAt: now,
    changedBy: cleanChangedBy
  };
}

export function listLeadInternalTaskAudit(leadId: string, taskId: string, limit = 100): LeadInternalTaskAuditRecord[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT audit_id AS auditId, lead_id AS leadId, task_id AS taskId, from_status AS fromStatus,
      to_status AS toStatus, changed_at AS changedAt, changed_by AS changedBy
    FROM ${taskAuditTable}
    WHERE lead_id = ? AND task_id = ?
    ORDER BY changed_at DESC, audit_id DESC
    LIMIT ?
  `).all(leadId, taskId, limit) as Record<string, unknown>[];

  return rows
    .filter((row) => isLeadTaskStatus(row.toStatus))
    .map((row) => ({
      auditId: String(row.auditId),
      leadId: String(row.leadId),
      taskId: String(row.taskId),
      fromStatus: isLeadTaskStatus(row.fromStatus) ? row.fromStatus : null,
      toStatus: row.toStatus as LeadTaskStatus,
      changedAt: String(row.changedAt),
      changedBy: String(row.changedBy)
    }));
}
