# AI-0 Cycle 2 Closure — flags POST + checklist POST

## Date
2026-04-26

## Status
**AI-0 Cycle 2 closed by evidence.** Os dois write endpoints identificados como out-of-scope no closure do Cycle 1 agora têm `requireCockpitSession`. Hardening residual de auth do cockpit está completo.

## What AI-0 Cycle 2 delivered

### Auth nos dois endpoints residuais
Ambos chamam `requireCockpitSession(request)` como primeira instrução do handler:
- `apps/web/app/api/cockpit/leads/[leadId]/flags/route.ts` (POST — set flag)
- `apps/web/app/api/cockpit/leads/[leadId]/checklist/route.ts` (POST — create checklist item)

O import de `requireCockpitSession` já estava presente (Cycle 1 adicionou para os GETs). Esta tranche apenas estendeu a guarda para os POSTs.

### Verifier executável
- `infra/scripts/verify-ai-0-cycle-2-local.sh` (typecheck + build + verifier ts)
- `infra/scripts/verifiers/ai-0-cycle-2.ts` (probes runtime + source-shape audits)

## Evidence
Output do verifier em `state/evidence/AI-0-cycle-2/summary-local.json`. Resumo:

- 2/2 probes com cookie falso → **401**
- `flags POST` e `checklist POST`: source-shape audit confirma que `requireCockpitSession` é a primeira instrução e o early-return precede qualquer chamada de storage.

## Riscos atualizados em `risk-log.md`
Risco "flags POST + checklist POST sem auth" (criado no closure do Cycle 1) marcado como resolvido.

## Out-of-scope (deliberadamente)
- Remoção definitiva do fallback `COCKPIT_SECRET` continua deferida.
- Wrapper `route-guards.ts` continua descartado.
- Auth residual fora do cockpit (rotas `/api/portal/*`) é responsabilidade do `portalSessionCookie` próprio do portal — não foi alvo de AI-0.

## Next
**AI-1 Cycle 1** — criar modelos/tabelas de IA (`ai_jobs`, `ai_artifacts`, `ai_messages`, `ai_prompt_templates`, `ai_guardrail_results`, `ai_budget_caps`, `ai_model_versions`). Sem chamada de Anthropic/OpenAI ainda — apenas o esqueleto de auditabilidade, cost tracking, budget caps e model versioning.
