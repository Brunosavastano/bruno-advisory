export const portalInviteStatuses = ['active', 'used', 'revoked'] as const;
export type PortalInviteStatus = (typeof portalInviteStatuses)[number];

export const portalInviteModel = {
  canonicalArtifact: 'packages/core/src/portal-invite-model.ts',
  inviteCodeBytes: 16,
  inviteCodeLengthHex: 32,
  sessionExpiryDays: 30,
  cookie: {
    name: 'portal_session',
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/'
  },
  statusLabels: {
    active: 'active',
    used: 'used',
    revoked: 'revoked'
  } satisfies Record<PortalInviteStatus, string>,
  expirySemantics: {
    invite: 'Invite codes do not expire by time in cycle 1; they expire when used or revoked.',
    session: 'Portal sessions expire 30 days after creation.'
  },
  fields: {
    invite: ['inviteId', 'leadId', 'code', 'status', 'createdAt', 'usedAt', 'revokedAt'],
    session: ['sessionId', 'leadId', 'inviteId', 'sessionToken', 'createdAt', 'expiresAt']
  }
} as const;

export type PortalInviteRecord = {
  inviteId: string;
  leadId: string;
  code: string;
  status: PortalInviteStatus;
  createdAt: string;
  usedAt: string | null;
  revokedAt: string | null;
};

export type PortalSessionRecord = {
  sessionId: string;
  leadId: string;
  inviteId: string;
  sessionToken: string;
  createdAt: string;
  expiresAt: string;
};

export type PortalSessionLookup = PortalSessionRecord & {
  fullName: string;
  commercialStage: string;
};
