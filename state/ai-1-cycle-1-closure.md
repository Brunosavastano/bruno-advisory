# AI-1 Cycle 1 Closure — Schema layer da camada de IA (sem provider)

## Date
2026-04-26

## Status
**AI-1 Cycle 1 closed by evidence.** Infraestrutura de auditabilidade da camada de IA pronta antes de qualquer chamada a LLM. Nenhuma linha de código chama Anthropic, OpenAI, ou Gemini — isso vem em AI-1 Cycle 2.

## What AI-1 Cycle 1 delivered

### 1. 9 tabelas SQLite em `apps/web/lib/storage/db.ts`
- `ai_jobs` (audit row de cada chamada futura: prompts, tokens, custo, latência, hashes, status com lifecycle)
- `ai_artifacts` (output persistido com revisão humana e flag de grounding)
- `ai_messages` (append-only across 9 surfaces — public_chat, portal_copilot, cockpit_copilot, email_*, whatsapp_*, marketing_copilot)
- `ai_prompt_templates` (versionamento com unique constraint em (name, version))
- `ai_guardrail_results` (append-only, rule_name × pass/warn/block)
- `ai_budget_caps` (unique scope: scope_type × scope_value × period)
- `ai_model_versions` (status lifecycle candidate→active→deprecated→blocked com unique constraint parcial em (provider, model_id) WHERE status='active')
- `ai_eval_cases` + `ai_eval_runs` (golden set com FKs encadeadas)

10 índices criados. CHECK constraints em todos os enums. FK encadeadas (ai_artifacts → ai_jobs, ai_messages → ai_jobs, ai_eval_runs → 3 tabelas).

### 2. 9 core models em `packages/core/src/`
Padrão `aiXxxStatuses` array tipado + `AiXxxStatus` type alias + `aiXxxModel` objeto com `canonicalArtifact` + `AiXxxRecord` type. Cada model file declara explicitamente sua tabela de transições válidas (`aiJobStatusTransitions`, `aiArtifactStatusTransitions`, `aiModelVersionStatusTransitions`) — fonte única de verdade pra o que pode → o que.

Barrel atualizado em [packages/core/src/index.ts](packages/core/src/index.ts) com 9 `export *`.

### 3. 9 storage helpers em `apps/web/lib/storage/` (CRUD completo)
Todos seguem padrão de `memos.ts`: `BEGIN`/`COMMIT`/`ROLLBACK`, SELECT com `AS camelCase`, validação de FK antes do INSERT (lookup explícito em `intake_leads`/`ai_jobs`/etc.), `writeAuditLog` em cada mutação. Funções de transição validam contra a tabela de transições do model, lançam erro com mensagem explícita quando inválida.

Funções principais por arquivo:
- `ai-jobs.ts`: createAiJob, getAiJob, listAiJobs, updateAiJobStatus (com COALESCE para timing/cost), cancelAiJob
- `ai-artifacts.ts`: createAiArtifact, getAiArtifact, listArtifactsForJob, listArtifactsForLead, updateArtifactStatus (exige rejection_reason quando status=rejected), archiveArtifact
- `ai-messages.ts`: appendAiMessage, getAiMessage, listAiMessages, listMessagesForJob (sem update/delete — append-only)
- `ai-prompt-templates.ts`: createPromptTemplate, getPromptTemplate, getActiveTemplate, listActivePromptTemplates (filtro opcional por surface), deactivateTemplate, reactivateTemplate
- `ai-guardrail-results.ts`: recordGuardrailResult, listGuardrailResultsForJob, summarizeGuardrailResultsForJob (retorna `{passed, warned, blocked}`)
- `ai-budget-caps.ts`: setBudgetCap (upsert por unique scope), getBudgetCap, listActiveBudgetCaps, listAllBudgetCaps, deactivateBudgetCap, reactivateBudgetCap
- `ai-model-versions.ts`: registerModelVersion, getModelVersion, getActiveModelVersion, listModelVersions, transitionModelVersion (preenche pinned_at/deprecated_at/blocked_at conforme transição)
- `ai-eval-cases.ts`: createEvalCase (valida que inputJson/expectedConstraintsJson são JSON parseáveis), getEvalCase, listActiveEvalCases, deactivateEvalCase, reactivateEvalCase
- `ai-eval-runs.ts`: recordEvalRun (valida FKs em 3 tabelas), listEvalRunsForCase, listEvalRunsForModelVersion

14 actions canônicas no `audit_log`: `ai_prompt_template_created`, `ai_prompt_template_deactivated`, `ai_prompt_template_reactivated`, `ai_model_version_registered`, `ai_model_version_transitioned`, `ai_job_created`, `ai_job_status_changed`, `ai_job_cancelled`, `ai_artifact_created`, `ai_artifact_approved`, `ai_artifact_rejected`, `ai_artifact_archived`, `ai_message_appended`, `ai_guardrail_pass`, `ai_guardrail_warn`, `ai_guardrail_block`, `ai_budget_cap_set`, `ai_budget_cap_updated`, `ai_budget_cap_deactivated`, `ai_budget_cap_reactivated`, `ai_eval_case_created`, `ai_eval_case_deactivated`, `ai_eval_case_reactivated`, `ai_eval_run_pass`, `ai_eval_run_warn`, `ai_eval_run_fail`.

### 4. Verifier executável
- `infra/scripts/verify-ai-1-cycle-1-local.sh` (typecheck + build + verifier ts)
- `infra/scripts/verifiers/ai-1-cycle-1.ts` (probes runtime + source-shape audits)
- `apps/web/app/api/dev/ai-1-cycle-1/exercise/route.ts` — **rota dev-only** que exercita todas as 9 helpers em-process. Gated por `process.env.AI_DEV_HARNESS_ENABLED === '1'`. Retorna 404 se a env var não está setada (default).

#### Por que não usar `NODE_ENV` no gate
Next.js substitui estaticamente `process.env.NODE_ENV` durante `next build`. Um check `if (process.env.NODE_ENV === 'production')` no código compilado vira `if ('production' === 'production')` — sempre true em build de produção, false em dev. Para o verifier rodar contra o build de produção mas exercitar a rota, precisamos de uma env var não-substituída. `AI_DEV_HARNESS_ENABLED` é lida em runtime e não está em `.env.example` nem em `infra/env.production.example`, então a rota é 404 por default em qualquer ambiente.

## Evidence
Output completo em `state/evidence/AI-1-cycle-1/summary-local.json`. Resumo:

- 9/9 tabelas presentes em sqlite_master após `getDatabase()` init.
- CHECK constraint rejeita `status='NOT_A_VALID_STATUS'` em `ai_jobs`.
- FK constraint rejeita `lead_id='00000000-...'` (lead inexistente).
- Runtime exercise: prompt template criado e ativo, model version promovido candidate→active, job ciclou queued→running→succeeded com cost/tokens/latency, artefato pending_review→approved (com reviewedBy preenchido)→archived, mensagem appendada, guardrail pass + summary `{passed:1, warned:0, blocked:0}`, budget cap set→deactivated, eval case + run criados.
- Transições inválidas rejeitadas: `queued→succeeded` (queued precisa ir pra running primeiro), `cancel` em job já `succeeded`, `deprecated→active` (deprecated é terminal exceto pra blocked).
- 14 contagens distintas em `audit_log` para as actions exercitadas.
- Source-shape audit: 9/9 modelos com `aiXxxModel`, `AiXxxRecord`, `canonicalArtifact`. 8/9 com `aiXxxStatuses` (eval-case-model não tem status).
- Source audit do gate: rota usa `process.env.AI_DEV_HARNESS_ENABLED !== '1'` e retorna 404 com body vazio.

## Mapping de retenção (gap #8 do session-handoff)

Documentação de regras — implementação do cleanup é **out-of-scope desta tranche**. Mapping para tranche futura:

| Tabela | Retenção | Base | Gatilho de cleanup |
|---|---|---|---|
| `ai_jobs` | 5 anos pós-criação | CVM 19 art. 22 (manutenção de arquivos da consultoria) + LGPD art. 16 II | Cron diário: `DELETE FROM ai_jobs WHERE created_at < date('now', '-5 years')` cascata para artifacts/messages/guardrails |
| `ai_artifacts` | 5 anos pós-`reviewed_at` (cliente ativo) ou pós-última atualização do lead | CVM 19 art. 22 + CFA Standard V(C) | Junto com cleanup de cliente |
| `ai_messages` em surfaces de cliente (portal_copilot, whatsapp_*, email_*) | 5 anos pós-encerramento do contrato OU 2 anos sem interação se lead nunca converteu | LGPD art. 15 + CVM 19 art. 22 | Cron mensal por lead status |
| `ai_messages` em `public_chat` | 2 anos sem interação | LGPD art. 15 (lead não convertido) | Cron mensal |
| `ai_guardrail_results` | 5 anos pós-job_id resolução | Audit trail consistente com ai_jobs | Cascade do cleanup de ai_jobs |
| `ai_prompt_templates` | Indeterminado enquanto `active=1`. Pós-`deactivated_at`: 5 anos. | Auditabilidade de versões usadas | Cron anual |
| `ai_budget_caps` | Indeterminado enquanto `active=1`. Pós-`deactivated_at`: 5 anos. | Auditabilidade financeira | Cron anual |
| `ai_model_versions` | Indeterminado (registro permanente do modelo usado) | Reprodutibilidade de jobs históricos | Sem cleanup automático |
| `ai_eval_cases` + `ai_eval_runs` | Indeterminado enquanto `active=1` (cases). Runs: 2 anos. | Histórico de qualidade ao decidir upgrades de modelo | Cron mensal pra runs |

Tranche dedicada de cleanup será aberta quando primeira tabela atingir o trigger de migração para Postgres (deferida em V2 conforme `project.yaml`).

## Out-of-scope desta tranche

- ❌ Provider Anthropic (Cycle 2)
- ❌ Cost estimation pré-call e cost tracking pós-call (Cycle 2)
- ❌ Budget enforcement (Cycle 2)
- ❌ Guardrails ativos: regex de promessa de retorno, classifier de minimização de risco, anti-hallucination (Cycle 3)
- ❌ Redaction layer (Cycle 3)
- ❌ Tabelas RAG: `ai_source_chunks`, `ai_embeddings`, `ai_retrieval_events` (AI-6)
- ❌ Cleanup automático conforme retenção (tranche futura)
- ❌ UI de cockpit pra visualizar jobs/budgets (Cycle 2+)
- ❌ Deploy em produção (sem código que use as tabelas, criação idempotente no primeiro request do Cycle 2)

## Riscos atualizados em `risk-log.md`
Infra de auditabilidade existe antes do primeiro LLM call. Risco "logs pobres e drafts sem revisão" parcialmente mitigado — falta o gate de IA não publicar (Cycle 5) + guardrails ativos (Cycle 3).

## Lifecycle da rota dev-only
A rota `/api/dev/ai-1-cycle-1/exercise` é descartável. Será removida quando AI-1 Cycle 2 introduzir um provider real e rotas que naturalmente exercitam as helpers. Decisão registrada aqui pra que o próximo ciclo limpe.

## Next
**AI-1 Cycle 2** — implementar provider Anthropic com modelo pinned, cost tracking real (estimar tokens pré-call, registrar tokens/cost pós-call), budget enforcement (estourou cap → status `blocked_budget`, sem chamar provider). Env vars `ANTHROPIC_API_KEY`, `AI_PROVIDER=anthropic`, `AI_MODEL=<id-pinned>`, `AI_DEFAULT_MONTHLY_BUDGET_CENTS`, etc. entram em `.env.example` e `infra/env.production.example`. Primeira chamada a LLM nessa tranche, em surface `cockpit_copilot` (memo draft).
