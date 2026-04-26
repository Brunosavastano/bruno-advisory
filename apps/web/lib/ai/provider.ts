// Provider factory. Picks the active AiProvider based on env:
//   - AI_USE_MOCK=1 → MockAiProvider (verifier + local dev)
//   - AI_PROVIDER=anthropic (default) → AnthropicAiProvider, requires ANTHROPIC_API_KEY
//
// Throws if AI is not enabled or the requested provider is missing credentials. Callers should
// catch and surface a meaningful HTTP error.

import { AnthropicAiProvider } from './anthropic';
import { MockAiProvider } from './mock';
import { readMaxAttemptsFromEnv, withRetry } from './retry';
import type { AiProvider } from './types';

export function isAiEnabled(): boolean {
  return process.env.AI_ENABLED === 'true' || process.env.AI_ENABLED === '1';
}

export function isMockMode(): boolean {
  return process.env.AI_USE_MOCK === '1';
}

function getBaseProvider(): AiProvider {
  if (isMockMode()) {
    return new MockAiProvider();
  }

  const providerName = (process.env.AI_PROVIDER ?? 'anthropic').toLowerCase();

  if (providerName === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not set. Either provision the key or set AI_USE_MOCK=1.');
    }
    return new AnthropicAiProvider({ apiKey });
  }

  throw new Error(`Unknown AI_PROVIDER=${providerName}. Supported: anthropic, or set AI_USE_MOCK=1.`);
}

export function getActiveProvider(): AiProvider {
  return withRetry(getBaseProvider(), { maxAttempts: readMaxAttemptsFromEnv() });
}
