export const aiMessageSurfaces = [
  'public_chat',
  'portal_copilot',
  'cockpit_copilot',
  'email_inbound',
  'email_outbound',
  'email_auto_draft',
  'whatsapp_inbound',
  'whatsapp_outbound',
  'marketing_copilot'
] as const;
export type AiMessageSurface = (typeof aiMessageSurfaces)[number];

export const aiMessageRoles = ['user', 'assistant', 'system', 'tool'] as const;
export type AiMessageRole = (typeof aiMessageRoles)[number];

export const aiMessageModel = {
  canonicalArtifact: 'packages/core/src/ai-message-model.ts',
  surfaces: aiMessageSurfaces,
  roles: aiMessageRoles,
  fields: ['messageId', 'leadId', 'surface', 'role', 'content', 'classification', 'aiJobId', 'createdAt'] as const,
  objective: 'Append-only conversation row across every AI surface (chats, emails, WhatsApp, marketing copilot).'
} as const;

export type AiMessageRecord = {
  messageId: string;
  leadId: string | null;
  surface: AiMessageSurface;
  role: AiMessageRole;
  content: string;
  classification: string | null;
  aiJobId: string | null;
  createdAt: string;
};
