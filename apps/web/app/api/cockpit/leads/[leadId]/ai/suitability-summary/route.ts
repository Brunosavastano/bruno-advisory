// AI-3 Cycle 3 surface: suitability_summary.
// Resume respostas + caps + flags + constraints de um suitability assessment
// para apoio à decisão do consultor. Não emite perfil; apenas narra.

import { suitabilityQuestionnaireV1 } from '@savastano-advisory/core';
import { handleLeadAiSurfacePost } from '../../../../../../../lib/ai/lead-surface';
import {
  getAssessment,
  getCurrentClientProfile,
  listAssessmentsByLead
} from '../../../../../../../lib/intake-storage';

function safeParse<T>(json: string | null): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function answerLabel(sectionKey: string, questionId: string, value: string | string[]): string {
  const section = suitabilityQuestionnaireV1.find((s) => s.key === sectionKey);
  const question = section?.questions.find((q) => q.id === questionId);
  if (!question) return Array.isArray(value) ? value.join(', ') : String(value);
  if (typeof value === 'string') {
    return question.options.find((o) => o.value === value)?.label ?? value;
  }
  return value.map((v) => question.options.find((o) => o.value === v)?.label ?? v).join(', ');
}

function buildSuitabilityContext(leadId: string, focusHint: string | null): string {
  let assessmentId = focusHint;
  if (!assessmentId) {
    const profile = getCurrentClientProfile(leadId);
    if (profile?.currentAssessmentId) {
      assessmentId = profile.currentAssessmentId;
    } else {
      const list = listAssessmentsByLead(leadId);
      assessmentId = list[0]?.assessmentId ?? null;
    }
  }

  if (!assessmentId) {
    return 'Nenhum suitability_assessment disponível para este lead.';
  }

  const a = getAssessment(assessmentId);
  if (!a || a.leadId !== leadId) {
    return `Assessment ${assessmentId} não encontrado para este lead.`;
  }

  const sections: Record<string, Record<string, string | string[]>> = {
    objectives: safeParse(a.objectivesJson) ?? {},
    financial_situation: safeParse(a.financialSituationJson) ?? {},
    knowledge_experience: safeParse(a.knowledgeExperienceJson) ?? {},
    liquidity_needs: safeParse(a.liquidityNeedsJson) ?? {},
    restrictions: safeParse(a.restrictionsJson) ?? {}
  };

  const caps = safeParse<Array<{ reasonCode: string; maxProfile: string }>>(a.capsAppliedJson) ?? [];
  const flags = safeParse<Array<{ code: string; severity: string; message: string }>>(a.reviewFlagsJson) ?? [];
  const constraints = safeParse<Array<{ section: string; questionId: string; labels: string[] }>>(a.constraintsJson) ?? [];
  const breakdown = safeParse<Record<string, number>>(a.breakdownJson) ?? {};

  const lines: string[] = [];
  lines.push(`Assessment ${a.assessmentId} (versão ${a.questionnaireVersion}, status ${a.status})`);
  lines.push(`Submetido por ${a.submittedBy ?? '-'} (${a.submittedByRole ?? '-'}) em ${a.submittedAt ?? '-'}`);
  lines.push(`Score: ${a.score ?? '-'} / 100. Calibração: ${a.scoringCalibrationVersion ?? '-'}`);
  lines.push('');

  for (const section of suitabilityQuestionnaireV1) {
    lines.push(`### ${section.description}`);
    lines.push(`Score normalizado da seção: ${breakdown[section.key]?.toFixed?.(1) ?? '-'}`);
    for (const q of section.questions) {
      const ans = sections[section.key]?.[q.id];
      lines.push(`- ${q.prompt}`);
      lines.push(`  Resposta: ${ans !== undefined ? answerLabel(section.key, q.id, ans) : '—'}`);
    }
    lines.push('');
  }

  if (caps.length > 0) {
    lines.push('### Caps prudenciais aplicados');
    for (const cap of caps) {
      lines.push(`- ${cap.reasonCode} → perfil máximo: ${cap.maxProfile}`);
    }
    lines.push('');
  }

  if (flags.length > 0) {
    lines.push('### Flags de revisão');
    for (const flag of flags) {
      lines.push(`- [${flag.severity}] ${flag.message} (${flag.code})`);
    }
    lines.push('');
  }

  if (constraints.length > 0) {
    lines.push('### Restrições declaradas pelo cliente');
    for (const c of constraints) {
      lines.push(`- ${c.section}: ${c.labels.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  return handleLeadAiSurfacePost(request, context, {
    jobType: 'suitability_summary',
    artifactType: 'suitability_summary',
    artifactTitle: () => `Resumo de suitability (${new Date().toISOString().slice(0, 10)})`,
    promptTemplateName: 'suitability_summary',
    systemPrompt:
      'Você é um assistente interno de um consultor de valores mobiliários registrado na CVM. Resuma o suitability assessment fornecido — não emita perfil, não recomende produto, não prometa retorno. Apenas narre o que está no contexto e sugira esclarecimentos.',
    buildUserPrompt: ({ leadId, focusHint }) => {
      const suitabilityContext = buildSuitabilityContext(leadId, focusHint);
      return `Contexto de suitability do lead:\n${suitabilityContext}`;
    },
    maxOutputTokens: 1500
  });
}
