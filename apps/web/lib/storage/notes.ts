import { randomUUID } from 'node:crypto';
import { getDatabase, leadsTable, notesTable } from './db';
import type { LeadInternalNote } from './types';

export function createLeadInternalNote(params: {
  leadId: string;
  content: string;
  authorMarker: string;
}): LeadInternalNote | null {
  const db = getDatabase();
  const now = new Date().toISOString();
  const cleanContent = params.content.trim();
  const cleanAuthor = params.authorMarker.trim();

  if (!cleanContent || !cleanAuthor) {
    return null;
  }

  const leadExists = db.prepare(`SELECT 1 FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`).get(params.leadId);
  if (!leadExists) {
    return null;
  }

  const noteId = randomUUID();
  db.prepare(`INSERT INTO ${notesTable} (note_id, lead_id, content, author_marker, created_at) VALUES (?, ?, ?, ?, ?)`)
    .run(noteId, params.leadId, cleanContent, cleanAuthor, now);

  return { noteId, leadId: params.leadId, content: cleanContent, authorMarker: cleanAuthor, createdAt: now };
}

export function listLeadInternalNotes(leadId: string, limit = 100): LeadInternalNote[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT note_id AS noteId, lead_id AS leadId, content, author_marker AS authorMarker, created_at AS createdAt
    FROM ${notesTable}
    WHERE lead_id = ?
    ORDER BY created_at DESC, note_id DESC
    LIMIT ?
  `).all(leadId, limit) as Record<string, unknown>[];

  return rows.map((row) => ({
    noteId: String(row.noteId),
    leadId: String(row.leadId),
    content: String(row.content),
    authorMarker: String(row.authorMarker),
    createdAt: String(row.createdAt)
  }));
}
