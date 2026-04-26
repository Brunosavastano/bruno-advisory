# AI-1 Cycle 3 Closure — Guardrails + redaction + retry + grounding

## Date
2026-04-26

## Status
**AI-1 Cycle 3 closed by evidence.** Toda chamada à IA agora passa por: (1) redação de PII pré-call, (2) retry exponencial em falhas transientes, (3) guardrails regex pós-call, (4) validação de schema JSON quando o template exige. Memo-draft em produção continua funcionando — agora com proteção compliance ativa.

## What AI-1 Cycle 3 delivered

### 1. Redaction layer — `apps/web/lib/ai/redaction.ts`
Strip de PII sensível **antes** do prompt chegar ao provider. Levels:
- `none` — sem redação (uso só interno controlado)
- `minimal` — CPF + CNPJ + cartão de crédito
- `strict` (default) — minimal + RG

Decisão deliberada: nome, email, telefone, faixa patrimonial **passam** pro provider. Esses dados são contexto necessário pra IA gerar memos úteis e foram coletados com consentimento explícito (`privacy_consent_accepted=1`). Brief v2 chama isso de "strict" e está alinhado a CFA Standard III(E) (preservação de informação necessária).

`ai_jobs.input_hash` é calculado da versão **redacted** — o hash auditável reflete o que foi enviado ao provider, não o original.

`ai_jobs.cost_breakdown_json` agora inclui `redactionCounts: {cpf: 1, ...}` pra rastreabilidade.

### 2. Retry policy — `apps/web/lib/ai/retry.ts`
`withRetry(provider, opts)` envolve qualquer `AiProvider` com backoff exponencial (1s/2s/4s) em até `AI_RETRY_MAX_ATTEMPTS=3`. Retry **só** em:
- `rate_limited` (HTTP 429)
- `provider_error` (HTTP 5xx)

NÃO retry em: `auth_error` (401), `invalid_request` (400), `unknown` errors. Falhas de billing (402) vêm como `invalid_request` no adapter Anthropic.

Latência reportada é cumulativa (soma de todas as tentativas). Audit log e custo refletem wall-clock real.

`getActiveProvider()` em `provider.ts` agora aplica o wrapper automaticamente — toda chamada por `runAiJob` ganha retry de graça.

### 3. Guardrails — `apps/web/lib/ai/guardrails/`
Registry de regras que rodam pós-call sobre o output do provider. 3 regras iniciais:

| Regra | Status | Patterns |
|---|---|---|
| `no_promised_returns` | **block** | "rentabilidade garantida", "retorno garantido", "ganho assegurado", "X% ao mês com certeza" |
| `no_risk_minimization` | **block** | "sem risco", "risco zero", "investimento seguro", "imune a volatilidade" |
| `no_specific_asset_advice` | **warn** | "compre PETR4", "venda VALE3", "invista 30% em ITUB4" |

Cada execução grava em `ai_guardrail_results` com `pass`/`warn`/`block`. Block em qualquer regra → job vai pra `blocked_guardrail`, **nenhum artifact é criado**, custo real é registrado mesmo assim (tokens já foram cobrados pela Anthropic). Operador vê no audit log o motivo exato.

`no_specific_asset_advice` é warn (não block) porque vai virar block apenas quando AI-5 trouxer suitability gating — recomendação de ativo é OK desde que com suitability vigente.

### 4. Grounding / schema validator — `apps/web/lib/ai/grounding.ts`
Validação estrutural mínima de JSON output:
1. Parseia o output como JSON.
2. Se `output_schema` declara `type: "object"` + `required: [...]`, confirma presença das chaves.

Comportamento:
- Output válido → `output_schema_valid: pass`
- Output inválido + `requires_grounding=0` → `output_schema_valid: warn`, job ainda succeeds
- Output inválido + `requires_grounding=1` → `output_schema_valid: block`, job vai pra `blocked_guardrail`

Validação completa de JSON Schema (per-property types, formats, claims com source_id) fica para AI-6 (RAG). O schema atual é o suficiente pra catch outputs que perderam estrutura (LLM esqueceu de campo, retornou texto puro, etc.).

### 5. Mudanças em `run-job.ts`
Pipeline novo (na ordem):
1. Resolve template + model_version
2. **Redact** user prompt (strict por default)
3. Estimate cost a partir do prompt redacted
4. Budget check
5. Create job (input_hash da versão redacted)
6. Provider call (já com retry envolvendo)
7. **Run guardrails** sobre o output → grava cada resultado
8. Se template tem `output_schema` → **validate** + grava resultado
9. Se algum block (guardrail OU schema com `requires_grounding=1`) → status `blocked_guardrail`, custo registrado, sem artifact
10. Senão → status `succeeded` + artifact em `pending_review`

`AiJobStatusTransitions` atualizado pra permitir `running → blocked_guardrail` (block pós-call). `queued → blocked_guardrail` continua reservado pra futuro pre-call check.

### 6. Env vars novas
`.env.example` + `infra/env.production.example`:
```
AI_RETRY_MAX_ATTEMPTS=3
```
Default no código se não setar. Kill-switch granular.

### 7. Verifier executável
`infra/scripts/verify-ai-1-cycle-3-local.sh` + `infra/scripts/verifiers/ai-1-cycle-3.ts`:
- Happy path com CPF no prompt → confirma redação (cost_breakdown.redactionCounts.cpf=1) + 3 guardrails pass + 1 schema warn
- Source-shape audits exaustivos de cada novo módulo + wiring em run-job
- Transition table check (running → blocked_guardrail aceito)

End-to-end block path não testado pelo verifier (mock provider sempre retorna texto seguro). Cobertura via auditoria de fonte: regex patterns existem, runGuardrails é chamado, blocked_guardrail status é populado. AI-2 (próximo ciclo) trará rotas que aceitam prompt customizado, permitindo teste e2e do block.

## Evidence
Output em `state/evidence/AI-1-cycle-3/summary-local.json`. Resumo dos checks:

| Check | Resultado |
|---|---|
| Happy path: CPF redacted | `redactionCounts.cpf=1` ✓ |
| Happy path: guardrails | 3 pass + 1 warn (schema, esperado) ✓ |
| Retry: imports + chamada + env read | ✓ |
| Retry: backoff exponencial + cumulative latency | ✓ |
| Retry: 429/5xx retried, auth NÃO | ✓ |
| Grounding: JSON parse + required fields | ✓ |
| run-job: chama runGuardrails + validate + redact | ✓ |
| run-job: hash usa redacted, call usa redacted | ✓ |
| Transition table: running→blocked_guardrail aceito | ✓ |
| 8/8 novos arquivos presentes | ✓ |

## Out-of-scope intencional
- **Pre-call guardrails** (validar input do operador) — futuro
- **Sentry/Datadog** observability — backlog
- **Streaming SSE** — vai com AI-6
- **Source-id grounding completo** (cada claim com `source_id` válido) — AI-6 (RAG)
- **Suitability gate** que vira `no_specific_asset_advice` em block — AI-5
- **Custo de retry** registrado separadamente — atual: latência somada, mas cost_cents do retry já está embutido na chamada que sucede

## Riscos atualizados em `risk-log.md`
- Risco "IA produzir material não auditável" — alta — **resolvido pra surfaces internas**: guardrails ativos + grounding validator + redaction + retry. Cobertura completa pra client-facing exige AI-5 (compliance gate de recomendação) + AI-6 (RAG real com source-id).
- Risco "PII vaza pro provider externo" — média — **mitigado**: redaction strict default em todos os jobs. Hash auditável é da versão redacted.

## Comportamento end-to-end agora em produção (após deploy)

Quando você clicar "Gerar rascunho de memo com IA":

1. Sistema redact CPF/CNPJ/RG/cartão do prompt
2. Verifica budget (US$5/dia, US$50/mês)
3. Chama Sonnet 4.6 (com retry em 429/5xx)
4. Roda 3 regex guardrails sobre o output
5. Se schema declarado, valida JSON
6. **Se output diz "rentabilidade garantida 5% ao mês"** → job `blocked_guardrail`, sem memo na review queue, audit log mostra motivo
7. Se tudo passa → memo aparece em `/cockpit/review-queue` com status `pending_review`
8. Você aprova/rejeita manualmente

## Next
**AI-2** — copiloto interno completo:
- Botões adicionais no cockpit por lead: "Resumir documentos aceitos", "Pré-call brief", "Follow-up pós-call", "Checklist de pendências"
- UX mobile-first da review queue (cards, swipe, push)
- Cada nova surface usa o mesmo `runAiJob` com prompts dedicados

Cycle 3 entrega protege todas as próximas surfaces sem trabalho adicional.
