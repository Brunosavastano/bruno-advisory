// Retry wrapper for AiProvider. Wraps provider.generate with exponential backoff on transient
// errors (rate_limited, provider_error). Auth/invalid/insufficient credit are NOT retried.
//
// Latency reported to the orchestrator is cumulative (sum of all attempts including the final
// successful one), so cost dashboards and audit logs reflect real wall-clock time.

import type { AiCallParams, AiCallResult, AiProvider } from './types';

export type RetryOptions = {
  maxAttempts: number; // total attempts including the first; 1 = no retry
  baseDelayMs: number; // delay before retry 2 (retry 3 doubles, etc.)
};

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000
};

const RETRYABLE_ERROR_CODES = new Set(['rate_limited', 'provider_error']);

function shouldRetry(result: AiCallResult, attempt: number, maxAttempts: number): boolean {
  if (result.ok) return false;
  if (attempt >= maxAttempts) return false;
  return RETRYABLE_ERROR_CODES.has(result.errorCode);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function withRetry(provider: AiProvider, options?: Partial<RetryOptions>): AiProvider {
  const opts: RetryOptions = { ...DEFAULT_OPTIONS, ...options };
  return {
    name: provider.name,
    supportsCaching: provider.supportsCaching,
    async generate(params: AiCallParams): Promise<AiCallResult> {
      let cumulativeLatencyMs = 0;
      let lastResult: AiCallResult | undefined;
      for (let attempt = 1; attempt <= opts.maxAttempts; attempt += 1) {
        const result = await provider.generate(params);
        cumulativeLatencyMs += result.latencyMs;
        if (result.ok) {
          return { ...result, latencyMs: cumulativeLatencyMs };
        }
        lastResult = { ...result, latencyMs: cumulativeLatencyMs };
        if (!shouldRetry(result, attempt, opts.maxAttempts)) {
          return lastResult;
        }
        const delayMs = opts.baseDelayMs * Math.pow(2, attempt - 1);
        await sleep(delayMs);
      }
      // Should never reach here because the loop always returns; the bang is to satisfy TS.
      return lastResult!;
    }
  };
}

export function readMaxAttemptsFromEnv(): number {
  const raw = process.env.AI_RETRY_MAX_ATTEMPTS;
  if (!raw) return DEFAULT_OPTIONS.maxAttempts;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10) return DEFAULT_OPTIONS.maxAttempts;
  return parsed;
}
