// Blocks any model output that promises a guaranteed return.
// CVM Resolução 19 art. 16 + Código de Ética CFA proíbem promessa de rentabilidade.

import type { GuardrailRule } from './types';

const PATTERNS: ReadonlyArray<RegExp> = [
  /rentabilidade\s+garantida/gi,
  /retorno\s+garantido/gi,
  /ganho\s+(?:garantido|assegurado)/gi,
  /lucro\s+(?:garantido|assegurado|certo)/gi,
  /\d+(?:[.,]\d+)?\s*%\s+(?:ao\s+m[êe]s|por\s+m[êe]s|ao\s+ano|por\s+ano|garantid)/gi,
  /vai\s+(?:render|valorizar|subir)\s+\d+/gi,
  /com\s+certeza\s+(?:rende|valoriza|paga)/gi
];

export const noPromisedReturnsRule: GuardrailRule = {
  name: 'no_promised_returns',
  description: 'Bloqueia frases que prometem retorno garantido (CVM 19 art. 16).',
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
