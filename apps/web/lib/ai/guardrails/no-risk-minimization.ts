// Blocks any model output that minimizes investment risk.
// "Sem risco", "investimento seguro", "carteira sem volatilidade" são frases proibidas em superfícies
// client-facing per regulamentação CVM e princípios de ética profissional.

import type { GuardrailRule } from './types';

const PATTERNS: ReadonlyArray<RegExp> = [
  /sem\s+risco/gi,
  /risco\s+zero/gi,
  /(?:totalmente|completamente)\s+seguro/gi,
  /investimento\s+seguro/gi,
  /carteira\s+(?:sem\s+volatilidade|estável)/gi,
  /n[ãa]o\s+(?:tem|h[áa])\s+(?:risco|volatilidade|perda)/gi,
  /n[ãa]o\s+pode\s+(?:perder|cair|desvalorizar)/gi,
  /imune\s+(?:a|à|ao)\s+(?:risco|volatilidade|crise|queda)/gi
];

export const noRiskMinimizationRule: GuardrailRule = {
  name: 'no_risk_minimization',
  description: 'Bloqueia frases que minimizam ou negam risco de investimento.',
  check(text) {
    for (const pattern of PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return {
          status: 'block',
          detail: `Padrão proibido detectado: "${match[0]}"`
        };
      }
    }
    return { status: 'pass' };
  }
};
