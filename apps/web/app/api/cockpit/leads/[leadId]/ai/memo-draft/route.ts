// AI-1 Cycle 2 surface: memo draft for cockpit operator review.
// Uses the shared lead-surface handler so behaviour is uniform with research-summary,
// pre-call-brief, follow-up-draft, and pending-checklist (AI-2 Cycle 1).

import { handleLeadAiSurfacePost } from '../../../../../../../lib/ai/lead-surface';

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  return handleLeadAiSurfacePost(request, context, {
    jobType: 'memo_draft',
    artifactType: 'memo_draft',
    artifactTitle: () => `Rascunho de memo (${new Date().toISOString().slice(0, 10)})`,
    promptTemplateName: 'memo_internal_draft',
    systemPrompt:
      'Você é um assistente interno de um consultor de valores mobiliários registrado na CVM. Gere rascunho INTERNO para revisão humana.',
    buildUserPrompt: ({ focusHint, leadContext }) => {
      const base = `Contexto do lead:\n${leadContext}`;
      return focusHint ? `${base}\n\nFoco específico solicitado pelo consultor: ${focusHint}` : base;
    },
    maxOutputTokens: 1500
  });
}
