// AI-2 Cycle 1 surface: pre-meeting brief for cockpit operator review.

import { handleLeadAiSurfacePost } from '../../../../../../../lib/ai/lead-surface';

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  return handleLeadAiSurfacePost(request, context, {
    jobType: 'pre_call_brief',
    artifactType: 'pre_call_brief',
    artifactTitle: () => `Briefing pré-call (${new Date().toISOString().slice(0, 10)})`,
    promptTemplateName: 'pre_call_brief',
    systemPrompt:
      'Você é um assistente interno de um consultor de valores mobiliários registrado na CVM. Gere briefing pré-reunião com pontos a validar e perguntas sugeridas.',
    buildUserPrompt: ({ focusHint, leadContext }) => {
      const base = `Contexto do lead:\n${leadContext}`;
      return focusHint ? `${base}\n\nFoco da reunião: ${focusHint}` : base;
    },
    maxOutputTokens: 1500
  });
}
