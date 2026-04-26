// Warns when output includes direct buy/sell instructions for specific tickers.
// Recomendação personalizada exige suitability vigente — gate é aplicado em AI-5
// (Recommendation Ledger). Por ora marcamos como warn para que o consultor revise.
// Futuramente vira block quando o suitability check estiver disponível.

import type { GuardrailRule } from './types';

// Brazilian B3 tickers tend to be 4 uppercase letters + 1 or 2 digits (e.g. PETR4, VALE3, BVMF11).
// US tickers, BDRs, and crypto are caught by their own pattern blocks below.
const PATTERNS: ReadonlyArray<RegExp> = [
  /\b(?:compre|venda|comprar|vender)\s+(?:[A-Z]{4}\d{1,2}|[A-Z]{1,5})\b/g,
  /\b(?:compre|venda)\s+(?:bitcoin|btc|ethereum|eth|solana|sol)\b/gi,
  /\brecomendo\s+(?:comprar|vender)\s+(?:[A-Z]{4}\d{1,2}|[A-Z]{1,5})\b/g,
  /\b(?:investir|alocar|colocar)\s+\d+\s*%?\s*em\s+[A-Z]{4}\d{1,2}\b/g
];

export const noSpecificAssetAdviceRule: GuardrailRule = {
  name: 'no_specific_asset_advice',
  description: 'Avisa quando o output recomenda compra/venda de ativo específico — exige revisão humana e suitability vigente.',
  check(text) {
    for (const pattern of PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return {
          status: 'warn',
          detail: `Recomendação direta de ativo detectada: "${match[0]}". Confirmar suitability vigente antes de aprovar.`
        };
      }
    }
    return { status: 'pass' };
  }
};
