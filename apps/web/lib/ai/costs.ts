// Cost computation helpers for the AI gateway.
// Pricing is stored per ai_model_version row as JSON (input_price_json, output_price_json).
// We deliberately keep cents-per-million as the unit so integer math is exact for usual ranges.

export type TokenPricing = {
  inputCentsPerMillion: number;
  outputCentsPerMillion: number;
  cachedInputCentsPerMillion: number;
};

export const DEFAULT_PRICING: Readonly<Record<string, TokenPricing>> = {
  // Anthropic public pricing as of 2026-04 (approximation, in US cents):
  // Sonnet 4.x: $3/MTok input, $15/MTok output, $0.30/MTok cache read.
  // Update via ai_model_versions.input_price_json/output_price_json when prices change.
  'claude-sonnet-4-6': {
    inputCentsPerMillion: 300,
    outputCentsPerMillion: 1500,
    cachedInputCentsPerMillion: 30
  },
  'claude-opus-4-7': {
    inputCentsPerMillion: 1500,
    outputCentsPerMillion: 7500,
    cachedInputCentsPerMillion: 150
  },
  'claude-haiku-4-5-20251001': {
    inputCentsPerMillion: 80,
    outputCentsPerMillion: 400,
    cachedInputCentsPerMillion: 8
  }
};

export function parsePricing(jsonInput: string | null, jsonOutput: string | null, modelId: string): TokenPricing {
  // Parse strings like '{"centsPerMillion":300,"cachedCentsPerMillion":30}' for input
  // and {"centsPerMillion":1500} for output. If parsing fails or fields missing, fall back to DEFAULT_PRICING.
  const fallback = DEFAULT_PRICING[modelId];

  let input: { centsPerMillion?: number; cachedCentsPerMillion?: number } = {};
  let output: { centsPerMillion?: number } = {};

  if (jsonInput) {
    try {
      input = JSON.parse(jsonInput);
    } catch {
      input = {};
    }
  }
  if (jsonOutput) {
    try {
      output = JSON.parse(jsonOutput);
    } catch {
      output = {};
    }
  }

  if (typeof input.centsPerMillion === 'number' && typeof output.centsPerMillion === 'number') {
    return {
      inputCentsPerMillion: input.centsPerMillion,
      outputCentsPerMillion: output.centsPerMillion,
      cachedInputCentsPerMillion: typeof input.cachedCentsPerMillion === 'number' ? input.cachedCentsPerMillion : 0
    };
  }

  if (fallback) return fallback;

  throw new Error(`No pricing available for model ${modelId} and parsed JSON did not provide centsPerMillion`);
}

export type ComputeCostParams = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  pricing: TokenPricing;
};

// Returns total cost in integer cents (rounded UP to nearest cent — conservative for budget tracking).
export function computeCostCents({ inputTokens, outputTokens, cachedInputTokens = 0, pricing }: ComputeCostParams): number {
  const billableInput = Math.max(0, inputTokens - cachedInputTokens);
  const inputCost = (billableInput * pricing.inputCentsPerMillion) / 1_000_000;
  const cachedCost = (cachedInputTokens * pricing.cachedInputCentsPerMillion) / 1_000_000;
  const outputCost = (outputTokens * pricing.outputCentsPerMillion) / 1_000_000;
  return Math.ceil(inputCost + cachedCost + outputCost);
}

// Rough pre-call token estimate. Anthropic's actual tokenizer differs, but ~4 chars/token holds for
// English/Portuguese prose within a small margin. Plus 100 tokens for system prompt boilerplate.
// Used ONLY for budget pre-checks; real token counts come from the response.usage object post-call.
export function estimateInputTokens(systemPrompt: string, userPrompt: string): number {
  const totalChars = systemPrompt.length + userPrompt.length;
  return Math.ceil(totalChars / 4) + 100;
}
