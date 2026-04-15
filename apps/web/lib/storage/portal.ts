import { randomBytes, randomUUID } from 'node:crypto';
import {
  portalInviteModel,
  portalInviteStatuses,
  type PortalInviteRecord,
  type PortalInviteStatus,
  type PortalSessionLookup,
  type PortalSessionRecord
} from '@bruno-advisory/core';
import { writeAuditLog } from './audit-log';
import { getDatabase, leadsTable, portalInvitesTable, portalSessionsTable } from './db';
import { getStoredLeadById } from './leads';
import { listChecklistItems } from './checklist';

function normalizeInviteRow(row: Record<string, unknown>): PortalInviteRecord {
  const status = String(row.status) as PortalInviteStatus;
  if (!portalInviteStatuses.includes(status)) {
    throw new Error(`Invalid portal invite status: ${String(row.status)}`);
  }

  return {
    inviteId: String(row.inviteId),
    leadId: String(row.leadId),
    code: String(row.code),
    status,
    createdAt: String(row.createdAt),
    usedAt: row.usedAt === null ? null : String(row.usedAt),
    revokedAt: row.revokedAt === null ? null : String(row.revokedAt)
  };
}

function normalizeSessionRow(row: Record<string, unknown>): PortalSessionRecord {
  return {
    sessionId: String(row.sessionId),
    leadId: String(row.leadId),
    inviteId: String(row.inviteId),
    sessionToken: String(row.sessionToken),
    createdAt: String(row.createdAt),
    expiresAt: String(row.expiresAt)
  };
}

function buildSessionExpiry(createdAt: Date) {
  const expiresAt = new Date(createdAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + portalInviteModel.sessionExpiryDays);
  return expiresAt.toISOString();
}

function getLeadExists(leadId: string) {
  const db = getDatabase();
  const row = db.prepare(`SELECT lead_id AS leadId FROM ${leadsTable} WHERE lead_id = ? LIMIT 1`).get(leadId);
  return Boolean(row);
}

export function listInvitesByLeadId(leadId: string): PortalInviteRecord[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT invite_id AS inviteId, lead_id AS leadId, code, status, created_at AS createdAt, used_at AS usedAt, revoked_at AS revokedAt
    FROM ${portalInvitesTable}
    WHERE lead_id = ?
    ORDER BY created_at DESC, invite_id DESC
  `).all(leadId) as Record<string, unknown>[];

  return rows.map(normalizeInviteRow);
}

export function createInvite(leadId: string): PortalInviteRecord | null {
  if (!getLeadExists(leadId)) {
    return null;
  }

  const db = getDatabase();
  const inviteId = randomUUID();
  const code = randomBytes(portalInviteModel.inviteCodeBytes).toString('hex');
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO ${portalInvitesTable} (invite_id, lead_id, code, status, created_at, used_at, revoked_at)
    VALUES (?, ?, ?, ?, ?, NULL, NULL)
  `).run(inviteId, leadId, code, 'active', createdAt);

  writeAuditLog({
    action: 'portal_invite_created',
    entityType: 'portal_invite',
    entityId: inviteId,
    leadId,
    actorType: 'operator',
    detail: { status: 'active' }
  });

  return { inviteId, leadId, code, status: 'active', createdAt, usedAt: null, revokedAt: null };
}

export function revokeInvite(inviteId: string): PortalInviteRecord | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT invite_id AS inviteId, lead_id AS leadId, code, status, created_at AS createdAt, used_at AS usedAt, revoked_at AS revokedAt
    FROM ${portalInvitesTable}
    WHERE invite_id = ?
    LIMIT 1
  `).get(inviteId) as Record<string, unknown> | undefined;

  if (!row) {
    return null;
  }

  const current = normalizeInviteRow(row);
  if (current.status === 'revoked') {
    return current;
  }

  const revokedAt = new Date().toISOString();
  const existingSessions = db.prepare(`
    SELECT session_id AS sessionId, lead_id AS leadId, invite_id AS inviteId, created_at AS createdAt, expires_at AS expiresAt
    FROM ${portalSessionsTable}
    WHERE invite_id = ?
  `).all(inviteId) as Array<Record<string, unknown>>;

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE ${portalInvitesTable} SET status = 'revoked', revoked_at = ? WHERE invite_id = ?`).run(revokedAt, inviteId);
    db.prepare(`DELETE FROM ${portalSessionsTable} WHERE invite_id = ?`).run(inviteId);

    writeAuditLog({
      action: 'portal_invite_revoked',
      entityType: 'portal_invite',
      entityId: current.inviteId,
      leadId: current.leadId,
      actorType: 'operator',
      detail: { revokedAt }
    });

    for (const sessionRow of existingSessions) {
      writeAuditLog({
        action: 'portal_session_deleted',
        entityType: 'portal_session',
        entityId: String(sessionRow.sessionId),
        leadId: String(sessionRow.leadId),
        actorType: 'operator',
        detail: {
          inviteId: String(sessionRow.inviteId),
          reason: 'invite_revoked',
          expiresAt: String(sessionRow.expiresAt)
        }
      });
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return { ...current, status: 'revoked', revokedAt };
}

export function redeemInvite(code: string): PortalSessionRecord | null {
  const normalizedCode = code.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(normalizedCode)) {
    return null;
  }

  const db = getDatabase();
  const now = new Date();
  const nowIso = now.toISOString();
  const inviteRow = db.prepare(`
    SELECT invite_id AS inviteId, lead_id AS leadId, code, status, created_at AS createdAt, used_at AS usedAt, revoked_at AS revokedAt
    FROM ${portalInvitesTable}
    WHERE code = ?
    LIMIT 1
  `).get(normalizedCode) as Record<string, unknown> | undefined;

  if (!inviteRow) {
    return null;
  }

  const invite = normalizeInviteRow(inviteRow);
  if (invite.status !== 'active' || invite.usedAt || invite.revokedAt) {
    return null;
  }

  const session: PortalSessionRecord = {
    sessionId: randomUUID(),
    leadId: invite.leadId,
    inviteId: invite.inviteId,
    sessionToken: randomUUID(),
    createdAt: nowIso,
    expiresAt: buildSessionExpiry(now)
  };

  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE ${portalInvitesTable} SET status = 'used', used_at = ? WHERE invite_id = ? AND status = 'active'`).run(nowIso, invite.inviteId);
    db.prepare(`
      INSERT INTO ${portalSessionsTable} (session_id, lead_id, invite_id, session_token, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(session.sessionId, session.leadId, session.inviteId, session.sessionToken, session.createdAt, session.expiresAt);

    writeAuditLog({
      action: 'portal_session_created',
      entityType: 'portal_session',
      entityId: session.sessionId,
      leadId: session.leadId,
      actorType: 'client',
      detail: {
        inviteId: session.inviteId,
        expiresAt: session.expiresAt
      }
    });

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return session;
}

export function getSession(sessionToken: string): PortalSessionLookup | null {
  const db = getDatabase();
  const row = db.prepare(`
    SELECT
      s.session_id AS sessionId,
      s.lead_id AS leadId,
      s.invite_id AS inviteId,
      s.session_token AS sessionToken,
      s.created_at AS createdAt,
      s.expires_at AS expiresAt,
      l.full_name AS fullName,
      l.commercial_stage AS commercialStage
    FROM ${portalSessionsTable} s
    INNER JOIN ${leadsTable} l ON l.lead_id = s.lead_id
    WHERE s.session_token = ?
    LIMIT 1
  `).get(sessionToken) as Record<string, unknown> | undefined;

  if (!row) {
    return null;
  }

  const session = {
    ...normalizeSessionRow(row),
    fullName: String(row.fullName),
    commercialStage: String(row.commercialStage)
  };

  if (Date.parse(session.expiresAt) <= Date.now()) {
    db.prepare(`DELETE FROM ${portalSessionsTable} WHERE session_token = ?`).run(sessionToken);
    writeAuditLog({
      action: 'portal_session_deleted',
      entityType: 'portal_session',
      entityId: session.sessionId,
      leadId: session.leadId,
      actorType: 'system',
      detail: {
        inviteId: session.inviteId,
        reason: 'expired'
      }
    });
    return null;
  }

  return session;
}

export function deleteSession(sessionToken: string) {
  const db = getDatabase();
  const current = db.prepare(`
    SELECT session_id AS sessionId, lead_id AS leadId, invite_id AS inviteId, expires_at AS expiresAt
    FROM ${portalSessionsTable}
    WHERE session_token = ?
    LIMIT 1
  `).get(sessionToken) as Record<string, unknown> | undefined;

  const result = db.prepare(`DELETE FROM ${portalSessionsTable} WHERE session_token = ?`).run(sessionToken);
  if (result.changes > 0 && current) {
    writeAuditLog({
      action: 'portal_session_deleted',
      entityType: 'portal_session',
      entityId: String(current.sessionId),
      leadId: String(current.leadId),
      actorType: 'client',
      detail: {
        inviteId: String(current.inviteId),
        reason: 'logout',
        expiresAt: String(current.expiresAt)
      }
    });
    return true;
  }

  return false;
}

export function getPortalDashboardContext(sessionToken: string) {
  const session = getSession(sessionToken);
  if (!session) {
    return null;
  }

  const lead = getStoredLeadById(session.leadId);
  if (!lead) {
    return null;
  }

  return {
    session,
    lead,
    checklist: listChecklistItems(session.leadId)
  };
}
