import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  documentUploadAllowedMimeTypes,
  documentUploadMaxSizeBytes,
  documentUploadStatuses,
  type DocumentUploadRecord,
  type DocumentUploadStatus
} from '@bruno-advisory/core';
import { writeAuditLog } from './audit-log';
import { getDatabase, leadDocumentsTable, leadsTable } from './db';

const uploadsRoot = path.join(process.cwd(), 'data', 'dev', 'uploads');

function sanitizeFilename(filename: string) {
  const trimmed = filename.trim() || 'upload';
  return trimmed.replace(/[\\/\0]/g, '-').replace(/\s+/g, '-');
}

function ensureUploadsDir(leadId: string) {
  const leadDir = path.join(uploadsRoot, leadId);
  fs.mkdirSync(leadDir, { recursive: true });
  return leadDir;
}

function normalizeRow(row: Record<string, unknown>): DocumentUploadRecord {
  const status = String(row.status) as DocumentUploadStatus;
  if (!documentUploadStatuses.includes(status)) {
    throw new Error(`Invalid document upload status: ${String(row.status)}`);
  }

  return {
    documentId: String(row.documentId),
    leadId: String(row.leadId),
    originalFilename: String(row.originalFilename),
    storedFilename: String(row.storedFilename),
    mimeType: String(row.mimeType),
    sizeBytes: Number(row.sizeBytes),
    status,
    uploadedAt: String(row.uploadedAt),
    reviewedAt: row.reviewedAt === null ? null : String(row.reviewedAt),
    reviewedBy: row.reviewedBy === null ? null : String(row.reviewedBy),
    reviewNote: row.reviewNote === null ? null : String(row.reviewNote)
  };
}

function getLeadExists(leadId: string) {
  const db = getDatabase();
  const row = db.prepare(`SELECT lead_id FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`).get(leadId);
  return Boolean(row);
}

function baseSelect() {
  return `
    SELECT
      document_id AS documentId,
      lead_id AS leadId,
      original_filename AS originalFilename,
      stored_filename AS storedFilename,
      mime_type AS mimeType,
      size_bytes AS sizeBytes,
      status,
      uploaded_at AS uploadedAt,
      reviewed_at AS reviewedAt,
      reviewed_by AS reviewedBy,
      review_note AS reviewNote
    FROM ${leadDocumentsTable}
  `;
}

export async function saveDocument(leadId: string, file: File): Promise<DocumentUploadRecord | null> {
  if (!getLeadExists(leadId)) {
    return null;
  }

  if (!documentUploadAllowedMimeTypes.includes(file.type as (typeof documentUploadAllowedMimeTypes)[number])) {
    throw new Error('INVALID_MIME_TYPE');
  }

  if (file.size > documentUploadMaxSizeBytes) {
    throw new Error('FILE_TOO_LARGE');
  }

  const documentId = randomUUID();
  const uploadedAt = new Date().toISOString();
  const originalFilename = sanitizeFilename(file.name || 'upload');
  const storedFilename = `${documentId}-${originalFilename}`;
  const leadDir = ensureUploadsDir(leadId);
  const filePath = path.join(leadDir, storedFilename);
  const db = getDatabase();

  const payload = Buffer.from(await file.arrayBuffer());

  db.exec('BEGIN');
  try {
    fs.writeFileSync(filePath, payload);
    db.prepare(`
      INSERT INTO ${leadDocumentsTable} (
        document_id,
        lead_id,
        original_filename,
        stored_filename,
        mime_type,
        size_bytes,
        status,
        uploaded_at,
        reviewed_at,
        reviewed_by,
        review_note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
    `).run(documentId, leadId, originalFilename, storedFilename, file.type, file.size, 'received', uploadedAt);

    writeAuditLog({
      action: 'document_uploaded',
      entityType: 'document',
      entityId: documentId,
      leadId,
      actorType: 'client',
      detail: {
        originalFilename,
        mimeType: file.type,
        sizeBytes: file.size,
        status: 'received'
      }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    fs.rmSync(filePath, { force: true });
    throw error;
  }

  return {
    documentId,
    leadId,
    originalFilename,
    storedFilename,
    mimeType: file.type,
    sizeBytes: file.size,
    status: 'received',
    uploadedAt,
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null
  } satisfies DocumentUploadRecord;
}

export function listDocuments(leadId: string): DocumentUploadRecord[] {
  const db = getDatabase();
  const rows = db.prepare(`${baseSelect()} WHERE lead_id = ? ORDER BY uploaded_at DESC, document_id DESC`).all(leadId) as Record<string, unknown>[];
  return rows.map(normalizeRow);
}

export function getDocument(documentId: string, leadId: string): DocumentUploadRecord | null {
  const db = getDatabase();
  const row = db.prepare(`${baseSelect()} WHERE document_id = ? AND lead_id = ? LIMIT 1`).get(documentId, leadId) as Record<string, unknown> | undefined;
  return row ? normalizeRow(row) : null;
}

export function reviewDocument(
  documentId: string,
  leadId: string,
  status: DocumentUploadStatus,
  reviewedBy: string,
  reviewNote?: string | null,
  actorId?: string | null
): DocumentUploadRecord | null {
  if (status !== 'processing' && status !== 'accepted' && status !== 'rejected' && status !== 'received') {
    return null;
  }

  const current = getDocument(documentId, leadId);
  if (!current) {
    return null;
  }

  const db = getDatabase();
  const reviewedAt = new Date().toISOString();
  const cleanNote = reviewNote?.trim() ? reviewNote.trim() : null;
  const normalizedReviewedBy = reviewedBy.trim() || 'operator_local';
  db.prepare(`
    UPDATE ${leadDocumentsTable}
    SET status = ?, reviewed_at = ?, reviewed_by = ?, review_note = ?
    WHERE document_id = ? AND lead_id = ?
  `).run(status, reviewedAt, normalizedReviewedBy, cleanNote, documentId, leadId);

  const document = getDocument(documentId, leadId);
  if (document) {
    writeAuditLog({
      action: 'document_reviewed',
      entityType: 'document',
      entityId: document.documentId,
      leadId: document.leadId,
      actorType: 'operator',
      actorId: actorId ?? null,
      detail: {
        status: document.status,
        reviewedBy: normalizedReviewedBy,
        reviewNote: document.reviewNote
      }
    });
  }

  return document;
}
