// Grounding / output schema validation.
// AI-1 Cycle 3 ships a basic structural validator: parses the LLM output as JSON, checks required
// fields against ai_prompt_templates.output_schema, returns errors. Full source-id grounding (every
// claim must cite a chunk_id from searchApprovedSources) lands in AI-6.
//
// The schema format we accept is a tiny subset of JSON Schema: { type: 'object', required: [...] }.
// More elaborate validation (per-property types, formats, enums) is future scope.

export type GroundingValidationResult = {
  ok: boolean;
  parsedOutput: unknown | null;
  errors: string[];
};

type SimpleObjectSchema = {
  type?: string;
  required?: string[];
};

function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false; reason: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

export function validateOutputAgainstSchema(content: string, schemaJson: string | null): GroundingValidationResult {
  if (!schemaJson) {
    // No schema declared on the template → nothing to validate, treat as pass.
    return { ok: true, parsedOutput: null, errors: [] };
  }

  const parsedSchema = tryParseJson(schemaJson);
  if (!parsedSchema.ok) {
    return { ok: false, parsedOutput: null, errors: [`output_schema is not valid JSON: ${parsedSchema.reason}`] };
  }
  const schema = parsedSchema.value as SimpleObjectSchema;

  const parsedContent = tryParseJson(content);
  if (!parsedContent.ok) {
    return {
      ok: false,
      parsedOutput: null,
      errors: [`provider output is not valid JSON: ${parsedContent.reason}`]
    };
  }

  const errors: string[] = [];
  if (schema.type === 'object') {
    if (
      typeof parsedContent.value !== 'object' ||
      parsedContent.value === null ||
      Array.isArray(parsedContent.value)
    ) {
      errors.push('output is not a JSON object');
    } else if (Array.isArray(schema.required)) {
      const obj = parsedContent.value as Record<string, unknown>;
      for (const requiredKey of schema.required) {
        if (!(requiredKey in obj)) {
          errors.push(`missing required field: ${requiredKey}`);
        }
      }
    }
  }

  return { ok: errors.length === 0, parsedOutput: parsedContent.value, errors };
}
