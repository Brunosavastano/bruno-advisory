// Guardrail rule contract. Each rule inspects the model's output (post-call) and returns one of
// pass | warn | block. A block on any rule prevents artifact creation and marks the job
// blocked_guardrail. Warn is logged and surfaced to the operator but does not stop publication.

export type GuardrailStatus = 'pass' | 'warn' | 'block';

export type GuardrailContext = {
  surface: string;
  jobType: string;
  requiresGrounding: boolean;
};

export type GuardrailRuleResult = {
  status: GuardrailStatus;
  detail?: string;
};

export type GuardrailRule = {
  name: string;
  description: string;
  check(text: string, context: GuardrailContext): GuardrailRuleResult;
};

export type GuardrailNamedResult = GuardrailRuleResult & { name: string };

export type GuardrailRunResult = {
  results: GuardrailNamedResult[];
  blocked: boolean;
  warned: boolean;
  blockingRule: string | null;
};
