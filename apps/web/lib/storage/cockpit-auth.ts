import { randomBytes, randomUUID } from 'node:crypto';
import {
  cockpitAuthModel,
  hashCockpitPassword,
  isCockpitRole,
  verifyCockpitPassword,
  type CockpitRole
} from '@savastano-advisory/core';
import { cockpitSessionsTable, cockpitUsersTable, getDatabase } from './db';
import type {
  CockpitSession,
  CockpitSessionLookupRow,
  CockpitUser,
  CockpitUserWithHash
} from './types';

// Hashing is delegated to the canonical model. Re-exported here so callers in
// the web app can depend on the storage module only.
export const hashPassword = hashCockpitPassword;
export const verifyPassword = verifyCockpitPassword;

// ---------------------------------------------------------------------------
// User CRUD
// ---------------------------------------------------------------------------

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function rowToUser(row: Record<string, unknown>): CockpitUser {
  const role = String(row.role);
  if (!isCockpitRole(role)) {
    throw new Error(`Invalid role stored for cockpit user: ${role}`);
  }
  return {
    userId: String(row.userId),
    email: String(row.email),
    displayName: String(row.displayName),
    role,
    isActive: Number(row.isActive) === 1,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt)
  };
}

function rowToUserWithHash(row: Record<string, unknown>): CockpitUserWithHash {
  return {
    ...rowToUser(row),
    passwordHash: String(row.passwordHash)
  };
}

export function createCockpitUser(params: {
  email: string;
  displayName: string;
  role: CockpitRole;
  password: string;
}): CockpitUser {
  const email = normalizeEmail(params.email);
  const displayName = params.displayName.trim();
  if (!email || !email.includes('@')) {
    throw new Error('Valid email is required.');
  }
  if (!displayName) {
    throw new Error('Display name is required.');
  }
  if (!isCockpitRole(params.role)) {
    throw new Error(`Invalid role: ${params.role}`);
  }
  const passwordHash = hashPassword(params.password);
  const userId = randomUUID();
  const now = new Date().toISOString();
  const db = getDatabase();
  try {
    db.prepare(`
      INSERT INTO ${cockpitUsersTable} (user_id, email, display_name, role, password_hash, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(userId, email, displayName, params.role, passwordHash, now, now);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('UNIQUE') && message.includes('email')) {
      throw new Error(`Cockpit user already exists for email ${email}`);
    }
    throw error;
  }
  return { userId, email, displayName, role: params.role, isActive: true, createdAt: now, updatedAt: now };
}

export function findCockpitUserByEmail(email: string): CockpitUserWithHash | null {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return null;
  }
  const row = getDatabase().prepare(`
    SELECT user_id AS userId, email, display_name AS displayName, role,
      password_hash AS passwordHash, is_active AS isActive,
      created_at AS createdAt, updated_at AS updatedAt
    FROM ${cockpitUsersTable}
    WHERE email = ?
  `).get(normalized) as Record<string, unknown> | undefined;
  return row ? rowToUserWithHash(row) : null;
}

export function findCockpitUserById(userId: string): CockpitUser | null {
  if (!userId) {
    return null;
  }
  const row = getDatabase().prepare(`
    SELECT user_id AS userId, email, display_name AS displayName, role,
      is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
    FROM ${cockpitUsersTable}
    WHERE user_id = ?
  `).get(userId) as Record<string, unknown> | undefined;
  return row ? rowToUser(row) : null;
}

export function listCockpitUsers(): CockpitUser[] {
  const rows = getDatabase().prepare(`
    SELECT user_id AS userId, email, display_name AS displayName, role,
      is_active AS isActive, created_at AS createdAt, updated_at AS updatedAt
    FROM ${cockpitUsersTable}
    ORDER BY created_at ASC, user_id ASC
  `).all() as Record<string, unknown>[];
  return rows.map(rowToUser);
}

export function updateCockpitUser(
  userId: string,
  updates: Partial<{ displayName: string; role: CockpitRole; isActive: boolean; password: string }>
): CockpitUser | null {
  if (!userId) return null;
  const db = getDatabase();
  const existing = findCockpitUserById(userId);
  if (!existing) return null;

  const next = {
    displayName: updates.displayName?.trim() || existing.displayName,
    role: updates.role ?? existing.role,
    isActive: updates.isActive ?? existing.isActive
  };
  if (!isCockpitRole(next.role)) {
    throw new Error(`Invalid role: ${String(next.role)}`);
  }

  const now = new Date().toISOString();
  if (updates.password !== undefined) {
    const passwordHash = hashPassword(updates.password);
    db.prepare(`
      UPDATE ${cockpitUsersTable}
      SET display_name = ?, role = ?, is_active = ?, password_hash = ?, updated_at = ?
      WHERE user_id = ?
    `).run(next.displayName, next.role, next.isActive ? 1 : 0, passwordHash, now, userId);
  } else {
    db.prepare(`
      UPDATE ${cockpitUsersTable}
      SET display_name = ?, role = ?, is_active = ?, updated_at = ?
      WHERE user_id = ?
    `).run(next.displayName, next.role, next.isActive ? 1 : 0, now, userId);
  }

  // Deactivating a user invalidates their open sessions immediately.
  if (updates.isActive === false) {
    db.prepare(`DELETE FROM ${cockpitSessionsTable} WHERE user_id = ?`).run(userId);
  }

  return findCockpitUserById(userId);
}

export function countActiveAdmins(): number {
  const row = getDatabase().prepare(`
    SELECT COUNT(*) AS cnt FROM ${cockpitUsersTable} WHERE role = 'admin' AND is_active = 1
  `).get() as { cnt: number };
  return Number(row?.cnt ?? 0);
}

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

export function createCockpitSession(userId: string, ttlMs?: number): CockpitSession {
  const user = findCockpitUserById(userId);
  if (!user) {
    throw new Error(`Cockpit user ${userId} not found`);
  }
  if (!user.isActive) {
    throw new Error(`Cockpit user ${userId} is not active`);
  }
  const sessionId = randomUUID();
  const sessionToken = randomBytes(cockpitAuthModel.sessionTokenBytes).toString('hex');
  const now = Date.now();
  const ttl = typeof ttlMs === 'number' && ttlMs > 0
    ? ttlMs
    : cockpitAuthModel.sessionExpiryDays * 24 * 60 * 60 * 1000;
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttl).toISOString();

  getDatabase().prepare(`
    INSERT INTO ${cockpitSessionsTable} (session_id, user_id, session_token, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, userId, sessionToken, createdAt, expiresAt);

  return { sessionId, userId, sessionToken, createdAt, expiresAt };
}

export function findCockpitSessionByToken(sessionToken: string): CockpitSessionLookupRow | null {
  if (!sessionToken) return null;
  const row = getDatabase().prepare(`
    SELECT s.session_id AS sessionId,
      s.user_id AS userId,
      s.session_token AS sessionToken,
      s.created_at AS createdAt,
      s.expires_at AS expiresAt,
      u.email AS email,
      u.display_name AS displayName,
      u.role AS role,
      u.is_active AS isActive
    FROM ${cockpitSessionsTable} s
    JOIN ${cockpitUsersTable} u ON u.user_id = s.user_id
    WHERE s.session_token = ?
  `).get(sessionToken) as Record<string, unknown> | undefined;
  if (!row) return null;
  const role = String(row.role);
  if (!isCockpitRole(role)) return null;
  return {
    sessionId: String(row.sessionId),
    userId: String(row.userId),
    sessionToken: String(row.sessionToken),
    createdAt: String(row.createdAt),
    expiresAt: String(row.expiresAt),
    email: String(row.email),
    displayName: String(row.displayName),
    role,
    isActive: Number(row.isActive) === 1
  };
}

export function deleteCockpitSessionByToken(sessionToken: string): boolean {
  if (!sessionToken) return false;
  const result = getDatabase().prepare(`
    DELETE FROM ${cockpitSessionsTable} WHERE session_token = ?
  `).run(sessionToken);
  return Number(result.changes ?? 0) > 0;
}

export function purgeExpiredCockpitSessions(now: Date = new Date()): number {
  const result = getDatabase().prepare(`
    DELETE FROM ${cockpitSessionsTable} WHERE expires_at <= ?
  `).run(now.toISOString());
  return Number(result.changes ?? 0);
}

export function isCockpitSessionValid(session: CockpitSessionLookupRow, now: Date = new Date()): boolean {
  if (!session.isActive) return false;
  const expiresAt = Date.parse(session.expiresAt);
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt > now.getTime();
}
