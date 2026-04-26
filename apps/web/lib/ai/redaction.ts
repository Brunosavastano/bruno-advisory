// Redaction layer — strips PII from text before it reaches the provider.
// Conservative scope per AI-1 Cycle 3 decision: only sensitive identifiers (CPF, CNPJ, RG, credit
// card, generic 14+ digit account-like numbers). Names, emails, phones, asset bands stay because
// they're necessary lead context the model uses to write meaningful drafts.
//
// Why patterns are written tolerant: input text comes from operator + lead-form data which may have
// been pasted/typed with mixed formatting (CPF with or without dots/dashes). Patterns match common
// human-typed variations. Anything that escapes detection is by design preserved — the goal is
// reducing PII surface, not zero-knowledge.

export type RedactionLevel = 'none' | 'minimal' | 'strict';

export type RedactionResult = {
  redactedText: string;
  counts: Record<string, number>;
};

const PATTERNS: Array<{ name: string; pattern: RegExp; placeholder: string; minLevel: RedactionLevel }> = [
  // CPF: 11 digits, common formats include 000.000.000-00 or 00000000000
  {
    name: 'cpf',
    pattern: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{11}\b/g,
    placeholder: '[CPF_REDACTED]',
    minLevel: 'minimal'
  },
  // CNPJ: 14 digits, formats 00.000.000/0000-00 or 00000000000000
  {
    name: 'cnpj',
    pattern: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b|\b\d{14}\b/g,
    placeholder: '[CNPJ_REDACTED]',
    minLevel: 'minimal'
  },
  // Credit card: 13–19 digit groups, often 4-4-4-4
  {
    name: 'card',
    pattern: /\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g,
    placeholder: '[CARD_REDACTED]',
    minLevel: 'minimal'
  },
  // Brazilian RG: most common SP/RJ format XX.XXX.XXX-X (digit or X)
  {
    name: 'rg',
    pattern: /\b\d{2}\.\d{3}\.\d{3}-[\dxX]\b/g,
    placeholder: '[RG_REDACTED]',
    minLevel: 'strict'
  }
];

export function redact(text: string, level: RedactionLevel = 'strict'): RedactionResult {
  if (level === 'none') return { redactedText: text, counts: {} };

  let redactedText = text;
  const counts: Record<string, number> = {};

  for (const entry of PATTERNS) {
    if (level === 'minimal' && entry.minLevel === 'strict') continue;
    let n = 0;
    redactedText = redactedText.replace(entry.pattern, () => {
      n += 1;
      return entry.placeholder;
    });
    if (n > 0) counts[entry.name] = n;
  }

  return { redactedText, counts };
}

export function isValidRedactionLevel(value: unknown): value is RedactionLevel {
  return value === 'none' || value === 'minimal' || value === 'strict';
}
