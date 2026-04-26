# AI-0 Cycle 1 Closure — Hardening residual antes de IA

## Date
2026-04-26

## Status
**AI-0 Cycle 1 closed by evidence.** 10 rotas residuais do cockpit guardadas, middleware fail-closed em produção, vazamento de `leadId` no intake removido. Zero IA adicionada nesta tranche — gate de saída para AI-1.

## What AI-0 Cycle 1 delivered

### 1. Auth nas 10 rotas residuais
Todas chamam `requireCockpitSession(request)` no início do handler, padrão T6:
- `apps/web/app/api/cockpit/review-queue/route.ts` (GET)
- `apps/web/app/api/cockpit/leads/[leadId]/recommendations/route.ts` (GET, POST)
- `apps/web/app/api/cockpit/leads/[leadId]/memos/route.ts` (GET, POST, DELETE — PATCH já guardado em T6)
- `apps/web/app/api/cockpit/leads/[leadId]/notes/route.ts` (POST)
- `apps/web/app/api/cockpit/leads/[leadId]/tasks/route.ts` (POST)
- `apps/web/app/api/cockpit/leads/[leadId]/tasks/[taskId]/status/route.ts` (POST)
- `apps/web/app/api/cockpit/leads/[leadId]/flags/route.ts` (GET)
- `apps/web/app/api/cockpit/leads/[leadId]/checklist/route.ts` (GET)
- `apps/web/app/api/cockpit/leads/[leadId]/documents/route.ts` (GET)
- `apps/web/app/api/cockpit/leads/[leadId]/audit-log/route.ts` (GET)

Decisão: NÃO criar `apps/web/lib/route-guards.ts` (wrapper sugerido no brief v2). `requireCockpitSession` em `apps/web/lib/cockpit-session.ts` já cumpre o papel e é o padrão das 12 rotas fechadas em T6. Adicionar abstração nova seria churn sem ganho.

### 2. Middleware fail-closed em produção
`apps/web/proxy.ts` agora retorna 503 (`{ ok: false, error: 'misconfigured', reason: 'cockpit_secret_missing' }`) quando `NODE_ENV === 'production'` e `COCKPIT_SECRET` está ausente. Em desenvolvimento mantém pass-through com warning no console (preserva workflow local).

### 3. Intake success sem vazamento de `leadId`
`apps/web/app/intake/intake-form.tsx`: removido `ID: {submitState.leadId}` e o link `<a href="/cockpit/leads">`. Texto novo alinhado a `COMPLIANCE_PACKAGE.md` §5.8.

### 4. Verifier executável
- `infra/scripts/verify-ai-0-cycle-1-local.sh` (typecheck + build + verifier ts)
- `infra/scripts/verifiers/ai-0-cycle-1.ts` (probes runtime + source-text audits)

## Evidence
Output do verifier em `state/evidence/AI-0-cycle-1/summary-local.json`. Resumo:

- 13/13 probes com cookie falso retornaram **401** (review-queue GET; recommendations GET+POST; memos GET+POST+DELETE; notes POST; tasks POST; tasks status POST; flags GET; checklist GET; documents GET; audit-log GET).
- `recommendations POST`: source-shape audit confirma que `requireCockpitSession` é a primeira instrução e o early-return precede qualquer chamada de storage.
- `intake-form.tsx` success state: zero ocorrências de `leadId`, `/cockpit/leads`, `ID:`.
- `proxy.ts`: branch `NODE_ENV === 'production'` retornando `status: 503` + `cockpit_secret_missing` confirmado.
- Todos os 10 arquivos de rota importam/chamam `requireCockpitSession`.

## Riscos atualizados em `risk-log.md`
- Risk A (auth incompleta nas APIs do cockpit): resolvido após T6 + AI-0 Cycle 1.
- Risk B (middleware fail-open): resolvido — em prod falha fechada.
- Risk C (intake expõe `leadId`): resolvido.

## Out-of-scope identificado durante a tranche
Durante a edição dos arquivos de rota, observei que `flags POST` (set flag) e `checklist POST` (create item) também não têm `requireCockpitSession`. Não foram fechados nesta tranche por estarem fora do escopo aprovado (que listava apenas GET para flags e checklist). Recomendo abrir um Cycle 2 curto cobrindo:
- `apps/web/app/api/cockpit/leads/[leadId]/flags/route.ts` POST
- `apps/web/app/api/cockpit/leads/[leadId]/checklist/route.ts` POST

## Deferrals
- **Remoção definitiva do fallback `COCKPIT_SECRET`**: continua deferida. A escolha em AI-0 foi endurecer mas não remover. Tranche dedicada futura quando a base de admins reais via cockpit_session estiver consolidada.
- **Wrapper `route-guards.ts` com `withCockpitSession`/`withCockpitAdmin`**: rejeitado deliberadamente. Reabrir só se houver demanda concreta (ex.: rate-limiting compartilhado).

## Next
**AI-1 Cycle 1** — criar modelos/tabelas `ai_jobs`, `ai_artifacts`, `ai_messages`, `ai_prompt_templates`, `ai_guardrail_results`, `ai_budget_caps`, `ai_model_versions`. Antes de qualquer chamada de Anthropic/OpenAI, a infra de auditabilidade, cost tracking, budget caps e model versioning precisa estar pronta.
