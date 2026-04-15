import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const cockpitRoles = ['admin', 'operator', 'viewer'] as const;
export type CockpitRole = (typeof cockpitRoles)[number];

export const cockpitAuthModel = {
  canonicalArtifact: 'packages/core/src/cockpit-auth-model.ts',
  sessionTokenBytes: 32,
  sessionTokenLengthHex: 64,
  sessionExpiryDays: 30,
  scrypt: {
    N: 16384,
    r: 8,
    p: 1,
    keyLen: 64,
    saltBytes: 32,
    hashFormatPrefix: 'scrypt'
  },
  cookie: {
    name: 'cockpit_session',
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/'
  },
  legacySecretActorId: 'legacy-secret',
  roleLabels: {
    admin: 'admin',
    operator: 'operator',
    viewer: 'viewer'
  } satisfies Record<CockpitRole, string>,
  roleCapabilities: {
    admin: {
      canManageUsers: true,
      canMutate: true,
      canRead: true
    },
    operator: {
      canManageUsers: false,
      canMutate: true,
      canRead: true
    },
    viewer: {
      canManageUsers: false,
      canMutate: false,
      canRead: true
    }
  } satisfies Record<CockpitRole, { canManageUsers: boolean; canMutate: boolean; canRead: boolean }>,
  fields: {
    user: ['userId', 'email', 'displayName', 'role', 'isActive', 'createdAt', 'updatedAt'],
    session: ['sessionId', 'userId', 'sessionToken', 'createdAt', 'expiresAt']
  }
} as const;

export function isCockpitRole(value: unknown): value is CockpitRole {
  return typeof value === 'string' && (cockpitRoles as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Password hashing — canonical for the project.
// Kept in the model (leaf, node:crypto-only) so it's trivially loadable by
// verifier scripts without going through a bundler.
// ---------------------------------------------------------------------------

const MIN_PASSWORD_LENGTH = 8;
const { N, r, p, keyLen, saltBytes, hashFormatPrefix } = cockpitAuthModel.scrypt;
// scryptSync requires maxmem >= ~128*N*r bytes; we give ourselves headroom.
const SCRYPT_MAXMEM = 128 * N * r * 2;

export function hashCockpitPassword(password: string): string {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  const salt = randomBytes(saltBytes);
  const hash = scryptSync(password, salt, keyLen, { N, r, p, maxmem: SCRYPT_MAXMEM });
  return `${hashFormatPrefix}$N=${N},r=${r},p=${p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyCockpitPassword(password: string, stored: string): boolean {
  if (typeof password !== 'string' || typeof stored !== 'string' || stored.length === 0) {
    return false;
  }
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== hashFormatPrefix) {
    return false;
  }
  const paramPairs = parts[1].split(',').map((kv) => kv.split('='));
  const params: Record<string, number> = {};
  for (const [k, v] of paramPairs) {
    params[k] = Number(v);
  }
  if (params.N !== N || params.r !== r || params.p !== p) {
    return false;
  }
  let saltBuf: Buffer;
  let expectedBuf: Buffer;
  try {
    saltBuf = Buffer.from(parts[2], 'hex');
    expectedBuf = Buffer.from(parts[3], 'hex');
  } catch {
    return false;
  }
  if (saltBuf.length !== saltBytes || expectedBuf.length !== keyLen) {
    return false;
  }
  const candidate = scryptSync(password, saltBuf, keyLen, { N, r, p, maxmem: SCRYPT_MAXMEM });
  return candidate.length === expectedBuf.length && timingSafeEqual(candidate, expectedBuf);
}

export type CockpitUserRecord = {
  userId: string;
  email: string;
  displayName: string;
  role: CockpitRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CockpitSessionRecord = {
  sessionId: string;
  userId: string;
  sessionToken: string;
  createdAt: string;
  expiresAt: string;
};

export type CockpitSessionLookup = CockpitSessionRecord & {
  email: string;
  displayName: string;
  role: CockpitRole;
  isActive: boolean;
};
