// Provider-agnostic types for the AI gateway.
// Concrete adapters (anthropic.ts, mock.ts) implement the AiProvider interface.

export type AiCallParams = {
  modelId: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
};

export type AiCallSuccess = {
  ok: true;
  content: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  latencyMs: number;
  rawProviderResponseHash: string | null;
};

export type AiCallFailure = {
  ok: false;
  errorCode: 'provider_error' | 'rate_limited' | 'invalid_request' | 'auth_error' | 'unknown';
  errorMessage: string;
  latencyMs: number;
};

export type AiCallResult = AiCallSuccess | AiCallFailure;

export interface AiProvider {
  readonly name: string;
  readonly supportsCaching: boolean;
  generate(params: AiCallParams): Promise<AiCallResult>;
}
