# AI-1 Cycle 2 Closure — Provider Anthropic + cost tracking + budget enforcement

## Date
2026-04-26

## Status
**AI-1 Cycle 2 closed by evidence (build artifact only — não deployed em produção).**
Gateway de IA funcional, primeira surface integrada (memo draft no cockpit), cost tracking real, budget enforcement, governança de model versions. Verifier roda 100% com mock provider — zero gasto. Deploy aguarda você provisionar `ANTHROPIC_API_KEY` e `AI_ENABLED=true` na `.env` do servidor.

## What AI-1 Cycle 2 delivered

### 1. Gateway provider-agnostic em `apps/web/lib/ai/`
| Arquivo | Responsabilidade |
|---|---|
| `types.ts` | Interface `AiProvider` + tipos `AiCallParams`/`AiCallResult` |
| `costs.ts` | Pricing parser, `computeCostCents`, `estimateInputTokens` (heurística ~4 chars/token) |
| `budgets.ts` | `checkBudgetForJob` — soma `cost_cents` no escopo (global/surface/job_type/lead) × período (day/month), bloqueia se projeção > cap E action='block' |
| `mock.ts` | `MockAiProvider` — usado pelo verifier e em dev local. Nunca chama API real. |
| `anthropic.ts` | `AnthropicAiProvider` — SDK 0.91.1, traduz `Anthropic.APIError` em `AiCallFailure` (auth_error / rate_limited / invalid_request / provider_error / unknown) |
| `provider.ts` | Factory `getActiveProvider()` — `AI_USE_MOCK=1` força mock, senão `AI_PROVIDER` (cycle 2: só `anthropic`) |
| `run-job.ts` | `runAiJob` — orquestrador. Resolve template + model_version, estima custo, checa budget, cria `ai_job`, transita queued→running, chama provider, transita succeeded/failed/blocked_budget com tokens/cost reais |

Decisão de design: `provider` no `ai_jobs` registra o **upstream service** (`'anthropic'`), não o nome do adapter (`'mock'` em testes). Isso preserva integridade de relatórios de custo quando alternamos mock/real para debug.

### 2. Bootstrap seed em `apps/web/lib/storage/db.ts`
Função `ensureAiBootstrapSeeds(db)` chamada após CREATE TABLE inserts idempotentemente:
- `ai_model_versions`: id `seed-anthropic-claude-sonnet-4-6`, status `active`, pricing `300/1500/30 cents per million` (input/output/cached).
- `ai_prompt_templates`: id `seed-memo-internal-draft-v0-1-0`, body em PT-BR com restrições obrigatórias (não promete retorno, não minimiza risco, lista pendências em vez de inferir, retorna JSON com 7 chaves), `requires_grounding=0`, `allowed_surfaces=['cockpit_copilot']`.

`INSERT OR IGNORE` na primary key — execução repetida é no-op. Bypass dos storage helpers para evitar recursão durante init de `getDatabase()`.

### 3. Primeira surface: `POST /api/cockpit/leads/[leadId]/ai/memo-draft`
- Auth: `requireCockpitSession` (cookie real OU legacy COCKPIT_SECRET).
- Lê contexto do lead (nome, email, faixa patrimonial, desafio, estágio, fit_summary, últimas 3 recomendações, últimos 3 memos, últimos 5 eventos do audit log).
- Aceita `focusHint` opcional no body (string livre, instrução adicional do consultor).
- Chama `runAiJob` com surface=`cockpit_copilot`, jobType=`memo_draft`, max_tokens=1500.
- Em sucesso: cria `ai_artifact` com status=`pending_review`, retorna `{ jobId, artifactId, costCents, latencyMs }` + 201.
- Em block: 402 com `error: 'blocked_budget'` e detalhes do cap em `budgetCheck`.
- Em provider failure: 502 com `error: 'provider_failure'` + `errorMessage`.
- Em ausência de template/model: 500.

### 4. Admin route: `/api/cockpit/ai/model-versions`
- `GET` (operador+): lista versions, filtrável por `?status=active|candidate|deprecated|blocked`.
- `POST` (admin only): registra candidate com pricing JSON.
- `PATCH` (admin only): transição com validação (queued→running etc., agora aplicada também em model versions).

Legacy `cockpit_token` cookie é resolvido como `role='operator'` por `cockpit-session.ts` — não passa em `requireCockpitAdmin`. Apenas sessões reais com `role='admin'` mutate.

### 5. Env vars novas
`.env.example` e `infra/env.production.example` ganharam:
```
AI_ENABLED=false              # kill switch global
AI_PROVIDER=anthropic
AI_MODEL=claude-sonnet-4-6
ANTHROPIC_API_KEY=
AI_USE_MOCK=0
AI_DEFAULT_MONTHLY_BUDGET_CENTS=5000
AI_DEV_HARNESS_ENABLED=0
```
Em produção: `AI_ENABLED=false` por default. Você flipa pra `true` só após provisionar a chave Anthropic.

### 6. Pipeline de upgrade governado (`infra/scripts/check-model-updates.sh`)
Stub manual que:
1. Lista versions registradas no DB local.
2. Imprime os curl commands para registrar candidate, promover candidate→active, deprecated old.
3. Aponta para a doc Anthropic.

Auto-promotion **não** é implementado — decisão sua. Quando Sonnet 4.7 sair, fluxo é: registrar candidate → rodar golden eval (Cycle 4 automatiza) → você dá `Autorizado` → PATCH transition.

### 7. Verifier executável
`infra/scripts/verify-ai-1-cycle-2-local.sh` + `infra/scripts/verifiers/ai-1-cycle-2.ts`. Sempre roda em mock mode (`AI_USE_MOCK=1`) — verifier nunca gasta dinheiro real.

## Evidence
Output em `state/evidence/AI-1-cycle-2/summary-local.json`. 7 cenários green:

| Cenário | Resultado |
|---|---|
| Bootstrap seeds presentes | 1 active sonnet 4.6 + 1 active memo template |
| Auth sem cookie | 401 ✅ |
| Happy path com sessão admin | 201, jobId + artifactId, costCents=1, latencyMs=1, job.status=succeeded, artifact.status=pending_review |
| Audit log | ai_job_created + ai_job_status_changed (running, succeeded) + ai_artifact_created presentes |
| Budget block (cap=1 cent) | 402, ai_jobs.status=blocked_budget, sem artifact |
| Admin GET model-versions | 1 row, Sonnet 4.6 active |
| POST model-versions com cookie legacy (operator) | 403 forbidden |
| POST model-versions com sessão admin real | 201, novo candidate registrado |

## Por que NÃO deployar agora
Brief v2 e session-handoff são explícitos: deploy só com evidência completa. Cycle 2 introduz dependência externa (`ANTHROPIC_API_KEY`) e custo real ($0.014/memo). Sequência:

1. Você cria conta em `console.anthropic.com`, gera API key, adiciona billing.
2. Você adiciona `ANTHROPIC_API_KEY=sk-ant-...` no `/home/savastano-advisory/.env` do servidor (NÃO no git).
3. Você flipa `AI_ENABLED=true` na mesma `.env`.
4. Você roda o deploy: `ssh savastano-prod && cd /home/savastano-advisory && git pull && docker compose -f docker-compose.production.yml up -d --build`.
5. Smoke test em produção: criar 1 budget cap modesto via SQL ou cockpit, gerar 1 memo, validar custo registrado.
6. (Recomendado) criar budget cap dia=US$5 + mês=US$50 antes de liberar uso amplo.

Posso conduzir os passos 4 e 5 com a chave SSH que você já me autorizou. Passos 1–3 são manuais seus.

## Out-of-scope (vai pra Cycle 3 ou depois)
- ❌ Guardrails ativos (regex de promessa de retorno, classifier, anti-hallucination) — Cycle 3
- ❌ Redaction layer (PII removal antes de enviar pro provider) — Cycle 3
- ❌ JSON schema validation do output do template — Cycle 3
- ❌ Streaming SSE (gap #1 do session-handoff) — Cycle 3 ou AI-2
- ❌ Retry/fallback policy (gap #3) — Cycle 3
- ❌ Observabilidade externa (Sentry/Datadog) (gap #9) — Cycle 3
- ❌ Cockpit UI para listar jobs e budgets — quando houver dado real (futuro próximo)
- ❌ Aprovação de artifact via UI (já tem rota — UI vem depois)
- ❌ Auto-promoção de model_version (intencional — fica manual)

## Riscos atualizados em `risk-log.md`
- Risco "IA produzir material não auditável" — alta — **mais mitigado**: cada chamada agora grava jobs/artifacts/messages auditáveis, custo real, transição de status com audit trail. Falta Cycle 3 (guardrails ativos) pra mitigar 100%.
- Risco novo: **Custo descontrolado**. Mitigado por budget cap padrão (5000 cents/mês) + verifier prova que `block` funciona. Você precisa setar o cap real via SQL/admin antes do primeiro memo em produção.
- Risco novo: **API key vazamento**. Chave fica só na `.env` do servidor (fora do git, fora de imagens Docker). Acesso ao servidor = acesso à chave. Documentar rotação em runbook futuro.

## Lifecycle do dev-only route do Cycle 1
A rota `/api/dev/ai-1-cycle-1/exercise` continua existindo. Pode ser removida no Cycle 3 OU mantida como diagnóstico — sem dano em produção (gated por `AI_DEV_HARNESS_ENABLED=1`, default 0). Decisão deferida.

## Next
**AI-1 Cycle 3** — guardrails ativos:
1. Regex/heurística para bloquear promessa de retorno, "sem risco", "carteira pronta" em qualquer surface.
2. Classifier de intent (educacional vs recomendação vs reclamação) — usado em surfaces públicas.
3. JSON schema validator para outputs com `requires_grounding=1`.
4. Retry policy com backoff exponencial em falhas transientes.
5. Redaction layer básico (CPF, dados de cartão) antes de enviar ao provider.

Após Cycle 3, AI-2 (memos no cockpit com UX completa) pode rodar plenamente.
