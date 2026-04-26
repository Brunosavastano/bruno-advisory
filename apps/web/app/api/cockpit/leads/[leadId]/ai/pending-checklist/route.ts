// AI-2 Cycle 1 surface: pending items checklist generated from lead context.

import { handleLeadAiSurfacePost } from '../../../../../../../lib/ai/lead-surface';

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  return handleLeadAiSurfacePost(request, context, {
    jobType: 'pending_checklist',
    artifactType: 'pending_checklist',
    artifactTitle: () => `Checklist de pendências (${new Date().toISOString().slice(0, 10)})`,
    promptTemplateName: 'pending_checklist',
    systemPrompt:
      'Você é um assistente interno de um consultor de valores mobiliários registrado na CVM. Gere checklist de pendências baseada no contexto do lead.',
    buildUserPrompt: ({ focusHint, leadContext }) => {
      const base = `Contexto do lead:\n${leadContext}`;
      return focusHint ? `${base}\n\nFoco da checklist: ${focusHint}` : base;
    },
    maxOutputTokens: 1200
  });
}
