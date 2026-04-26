// AI-2 Cycle 1 surface: summary of accepted documents + delivered research workflows for a lead.

import { handleLeadAiSurfacePost } from '../../../../../../../lib/ai/lead-surface';

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  return handleLeadAiSurfacePost(request, context, {
    jobType: 'research_summary',
    artifactType: 'research_summary',
    artifactTitle: () => `Resumo de pesquisa (${new Date().toISOString().slice(0, 10)})`,
    promptTemplateName: 'research_summary',
    systemPrompt:
      'Você é um assistente interno de um consultor de valores mobiliários registrado na CVM. Resuma documentos aceitos e research workflows aprovados.',
    buildUserPrompt: ({ focusHint, leadContext }) => {
      const base = `Contexto do lead:\n${leadContext}`;
      return focusHint ? `${base}\n\nFoco do resumo: ${focusHint}` : base;
    },
    maxOutputTokens: 1800
  });
}
