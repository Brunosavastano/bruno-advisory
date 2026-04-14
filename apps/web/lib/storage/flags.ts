import { randomUUID } from 'node:crypto';
import { pendingFlagTypes, type PendingFlagRecord, type PendingFlagType } from '@bruno-advisory/core';
import { getDatabase, leadPendingFlagsTable, leadsTable } from './db';

function isPendingFlagType(value: string): value is PendingFlagType {
  return pendingFlagTypes.includes(value as PendingFlagType);
}

function normalizePendingFlagRow(row: Record<string, unknown>): PendingFlagRecord {
  return {
    flagId: String(row.flagId),
    leadId: String(row.leadId),
    flagType: String(row.flagType) as PendingFlagType,
    note: row.note === null ? null : String(row.note),
    setAt: String(row.setAt),
    setBy: String(row.setBy),
    clearedAt: row.clearedAt === null ? null : String(row.clearedAt),
    clearedBy: row.clearedBy === null ? null : String(row.clearedBy)
  };
}

function normalizeOptionalNote(note?: string | null) {
  const trimmed = note?.trim();
  return trimmed ? trimmed : null;
}

function leadExists(leadId: string) {
  const db = getDatabase();
  return Boolean(db.prepare(`SELECT lead_id FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`).get(leadId));
}

export function setFlag(leadId: string, flagType: PendingFlagType, setBy: string, note?: string | null): PendingFlagRecord | null {
  if (!leadExists(leadId) || !isPendingFlagType(flagType)) {
    return null;
  }

  const db = getDatabase();
  const now = new Date().toISOString();
  const normalizedSetBy = setBy.trim();
  if (!normalizedSetBy) {
    return null;
  }

  const existing = db.prepare(`
    SELECT
      flag_id AS flagId,
      lead_id AS leadId,
      flag_type AS flagType,
      note,
      set_at AS setAt,
      set_by AS setBy,
      cleared_at AS clearedAt,
      cleared_by AS clearedBy
    FROM ${leadPendingFlagsTable}
    WHERE lead_id = ? AND flag_type = ? AND cleared_at IS NULL
    LIMIT 1
  `).get(leadId, flagType) as Record<string, unknown> | undefined;

  const normalizedNote = normalizeOptionalNote(note);

  if (existing) {
    db.prepare(`
      UPDATE ${leadPendingFlagsTable}
      SET note = ?, set_at = ?, set_by = ?
      WHERE flag_id = ?
    `).run(normalizedNote, now, normalizedSetBy, String(existing.flagId));

    return normalizePendingFlagRow({ ...existing, note: normalizedNote, setAt: now, setBy: normalizedSetBy });
  }

  const flagId = randomUUID();
  db.prepare(`
    INSERT INTO ${leadPendingFlagsTable} (
      flag_id,
      lead_id,
      flag_type,
      note,
      set_at,
      set_by,
      cleared_at,
      cleared_by
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
  `).run(flagId, leadId, flagType, normalizedNote, now, normalizedSetBy);

  return {
    flagId,
    leadId,
    flagType,
    note: normalizedNote,
    setAt: now,
    setBy: normalizedSetBy,
    clearedAt: null,
    clearedBy: null
  };
}

export function clearFlag(leadId: string, flagType: PendingFlagType, clearedBy: string): PendingFlagRecord | null {
  if (!isPendingFlagType(flagType)) {
    return null;
  }

  const normalizedClearedBy = clearedBy.trim();
  if (!normalizedClearedBy) {
    return null;
  }

  const db = getDatabase();
  const existing = db.prepare(`
    SELECT
      flag_id AS flagId,
      lead_id AS leadId,
      flag_type AS flagType,
      note,
      set_at AS setAt,
      set_by AS setBy,
      cleared_at AS clearedAt,
      cleared_by AS clearedBy
    FROM ${leadPendingFlagsTable}
    WHERE lead_id = ? AND flag_type = ? AND cleared_at IS NULL
    LIMIT 1
  `).get(leadId, flagType) as Record<string, unknown> | undefined;

  if (!existing) {
    return null;
  }

  const clearedAt = new Date().toISOString();
  db.prepare(`UPDATE ${leadPendingFlagsTable} SET cleared_at = ?, cleared_by = ? WHERE flag_id = ?`).run(clearedAt, normalizedClearedBy, String(existing.flagId));

  return normalizePendingFlagRow({ ...existing, clearedAt, clearedBy: normalizedClearedBy });
}

export function listActiveFlags(leadId: string): PendingFlagRecord[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      flag_id AS flagId,
      lead_id AS leadId,
      flag_type AS flagType,
      note,
      set_at AS setAt,
      set_by AS setBy,
      cleared_at AS clearedAt,
      cleared_by AS clearedBy
    FROM ${leadPendingFlagsTable}
    WHERE lead_id = ? AND cleared_at IS NULL
    ORDER BY set_at DESC, flag_id DESC
  `).all(leadId) as Record<string, unknown>[];

  return rows.map(normalizePendingFlagRow);
}

export function listAllLeadsWithActiveFlags(): Array<{ leadId: string; fullName: string; flags: PendingFlagRecord[] }> {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT
      l.lead_id AS leadId,
      l.full_name AS fullName,
      f.flag_id AS flagId,
      f.flag_type AS flagType,
      f.note AS note,
      f.set_at AS setAt,
      f.set_by AS setBy,
      f.cleared_at AS clearedAt,
      f.cleared_by AS clearedBy
    FROM ${leadPendingFlagsTable} f
    INNER JOIN ${leadsTable} l ON l.lead_id = f.lead_id
    WHERE f.cleared_at IS NULL
    ORDER BY l.full_name ASC, f.set_at DESC, f.flag_id DESC
  `).all() as Record<string, unknown>[];

  const grouped = new Map<string, { leadId: string; fullName: string; flags: PendingFlagRecord[] }>();
  for (const row of rows) {
    const leadId = String(row.leadId);
    const current = grouped.get(leadId) ?? { leadId, fullName: String(row.fullName), flags: [] };
    current.flags.push(normalizePendingFlagRow({ ...row, leadId }));
    grouped.set(leadId, current);
  }

  return Array.from(grouped.values());
}
