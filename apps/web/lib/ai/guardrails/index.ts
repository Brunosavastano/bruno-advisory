// Guardrail registry + runner. Add new rules to the `guardrailRules` array.
// runGuardrails returns aggregated results so the orchestrator can decide whether to block, warn,
// or pass through.

import { noPromisedReturnsRule } from './no-promised-returns';
import { noRiskMinimizationRule } from './no-risk-minimization';
import { noSpecificAssetAdviceRule } from './no-specific-asset-advice';
import type { GuardrailContext, GuardrailRule, GuardrailRunResult } from './types';

export const guardrailRules: ReadonlyArray<GuardrailRule> = [
  noPromisedReturnsRule,
  noRiskMinimizationRule,
  noSpecificAssetAdviceRule
];

export function runGuardrails(text: string, context: GuardrailContext): GuardrailRunResult {
  const results = guardrailRules.map((rule) => {
    const ruleResult = rule.check(text, context);
    return { name: rule.name, ...ruleResult };
  });
  const blockingRule = results.find((r) => r.status === 'block')?.name ?? null;
  return {
    results,
    blocked: blockingRule !== null,
    warned: results.some((r) => r.status === 'warn'),
    blockingRule
  };
}

export type { GuardrailContext, GuardrailNamedResult, GuardrailRule, GuardrailRunResult, GuardrailStatus } from './types';
