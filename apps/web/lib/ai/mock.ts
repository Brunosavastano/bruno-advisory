// Mock provider used by the verifier and by local dev runs.
// Returns deterministic content + token counts so cost tracking and budget checks are reproducible.

import type { AiCallParams, AiCallResult, AiProvider } from './types';

export class MockAiProvider implements AiProvider {
  readonly name = 'mock';
  readonly supportsCaching = true;

  async generate(params: AiCallParams): Promise<AiCallResult> {
    const startedAt = Date.now();

    // Deterministic mock response. Token counts are derived from char counts so different prompts
    // produce different costs (useful for budget tests).
    const content = `[MOCK PROVIDER] Draft response for model=${params.modelId}\n\n` +
      `Echo of user prompt prefix: ${params.userPrompt.slice(0, 80)}...`;

    const inputTokens = Math.ceil((params.systemPrompt.length + params.userPrompt.length) / 4);
    const outputTokens = Math.ceil(content.length / 4);
    const latencyMs = Math.max(1, Date.now() - startedAt);

    return {
      ok: true,
      content,
      inputTokens,
      outputTokens,
      cachedInputTokens: 0,
      latencyMs,
      rawProviderResponseHash: null
    };
  }
}
