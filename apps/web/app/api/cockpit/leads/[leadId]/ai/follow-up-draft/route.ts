// AI-2 Cycle 1 surface: post-meeting follow-up draft for cockpit operator review.

import { handleLeadAiSurfacePost } from '../../../../../../../lib/ai/lead-surface';

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  return handleLeadAiSurfacePost(request, context, {
    jobType: 'follow_up_draft',
    artifactType: 'follow_up_draft',
    artifactTitle: () => `Follow-up pós-call (${new Date().toISOString().slice(0, 10)})`,
    promptTemplateName: 'follow_up_draft',
    systemPrompt:
      'Você é um assistente interno de um consultor de valores mobiliários registrado na CVM. Gere rascunho de follow-up pós-reunião.',
    buildUserPrompt: ({ focusHint, leadContext }) => {
      const base = `Contexto do lead:\n${leadContext}`;
      return focusHint ? `${base}\n\nPontos chave da conversa: ${focusHint}` : base;
    },
    maxOutputTokens: 1200
  });
}
