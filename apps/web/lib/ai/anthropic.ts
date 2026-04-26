// Anthropic provider adapter. Wraps @anthropic-ai/sdk Messages API.
// All errors translate to AiCallFailure so the orchestrator (run-job.ts) can update ai_jobs to
// status='failed' with error_message preserved. SDK exceptions are NEVER thrown out of generate().

import Anthropic from '@anthropic-ai/sdk';
import { createHash } from 'node:crypto';
import type { AiCallFailure, AiCallParams, AiCallResult, AiProvider } from './types';

type AnthropicProviderOptions = {
  apiKey: string;
  baseUrl?: string;
};

export class AnthropicAiProvider implements AiProvider {
  readonly name = 'anthropic';
  readonly supportsCaching = true;

  private readonly client: Anthropic;

  constructor(options: AnthropicProviderOptions) {
    this.client = new Anthropic({
      apiKey: options.apiKey,
      ...(options.baseUrl ? { baseURL: options.baseUrl } : {})
    });
  }

  async generate(params: AiCallParams): Promise<AiCallResult> {
    const startedAt = Date.now();
    try {
      const response = await this.client.messages.create({
        model: params.modelId,
        max_tokens: params.maxOutputTokens,
        system: params.systemPrompt,
        messages: [{ role: 'user', content: params.userPrompt }]
      });

      const latencyMs = Date.now() - startedAt;

      // The Messages API returns content as an array of blocks. For our use cases the first text
      // block carries the full response. Concatenate all text blocks defensively.
      const text = response.content
        .map((block) => (block.type === 'text' ? block.text : ''))
        .join('');

      const usage = response.usage;
      const inputTokens = usage?.input_tokens ?? 0;
      const outputTokens = usage?.output_tokens ?? 0;
      const cachedInputTokens = usage?.cache_read_input_tokens ?? 0;

      const responseHash = createHash('sha256')
        .update(JSON.stringify({ id: response.id, content: text, usage }))
        .digest('hex');

      return {
        ok: true,
        content: text,
        inputTokens,
        outputTokens,
        cachedInputTokens,
        latencyMs,
        rawProviderResponseHash: `sha256:${responseHash}`
      };
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);

      let errorCode: AiCallFailure['errorCode'] = 'unknown';
      if (error instanceof Anthropic.APIError) {
        const status = error.status ?? 0;
        if (status === 401 || status === 403) errorCode = 'auth_error';
        else if (status === 429) errorCode = 'rate_limited';
        else if (status >= 400 && status < 500) errorCode = 'invalid_request';
        else errorCode = 'provider_error';
      }

      return {
        ok: false,
        errorCode,
        errorMessage: message,
        latencyMs
      };
    }
  }
}
