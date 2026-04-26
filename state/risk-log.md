# risk-log.md

## Formato
- risco
- severidade
- sinal de alerta
- resposta

## Riscos iniciais

- Acoplamento invisível ao VLH — alta — scripts, segredos ou padrões puxados sem isolamento — separar infra, credenciais e pipelines desde T0
- Overbuild antes de venda — alta — muito tempo em arquitetura e pouco tempo em oferta/site/intake — fechar T1 e T2 cedo
- Billing complexo cedo demais — média — integração travar T3 — escolher fluxo simples e auditável
- Portal crescer antes do CRM — média — cliente entra sem backoffice consistente — manter ordem T3 antes de T4
- IA produzir material não auditável — alta — logs pobres e drafts sem revisão — gate obrigatório de aprovação humana
- Cockpit com chave mestra única até T6 — alta — sem rastreabilidade individual, sem revogação granular, sem separação de papéis — T6 implementa RBAC com fallback do secret; remoção do secret em T7
- Lockout durante migração para RBAC — alta — bootstrap do admin falhar ou cookie quebrar antes do login funcionar — manter COCKPIT_SECRET ativo todo o T6; bootstrap testado em C2 antes de refatorar middleware em C4
- Edge runtime do middleware Next.js não acessa SQLite — alta (evitada) — tentar DB lookup no proxy.ts quebra o build ou runtime — design separa: middleware só checa presença de cookie; validação real em route handler via requireCockpitSession

## Riscos resolvidos em AI-0 Cycle 1 (2026-04-26)

- Risk A — Auth incompleta nas APIs do cockpit — alta → **resolvido** — 10 rotas residuais (review-queue GET; recommendations GET+POST; memos GET/POST/DELETE; notes POST; tasks POST + status POST; flags GET; checklist GET; documents GET; audit-log GET) agora chamam `requireCockpitSession`. Verifier `infra/scripts/verify-ai-0-cycle-1-local.sh` prova 401 com cookie falso.
- Risk B — Middleware fail-open quando `COCKPIT_SECRET` ausente — alta → **resolvido** — `apps/web/proxy.ts` retorna 503 em produção; pass-through com warning apenas em dev.
- Risk C — Intake público expõe `leadId` e link para `/cockpit/leads` na mensagem de sucesso — média → **resolvido** — texto da seção de sucesso reescrito alinhado a `COMPLIANCE_PACKAGE.md` §5.8.

## Riscos resolvidos em AI-0 Cycle 2 (2026-04-26)

- `flags POST` e `checklist POST` sem `requireCockpitSession` — média → **resolvido** — ambos chamam `requireCockpitSession` como primeira instrução. Verifier `infra/scripts/verify-ai-0-cycle-2-local.sh` prova 401 com cookie falso.

## Mitigações de AI-1 Cycle 1 (2026-04-26)

- Risco "IA produzir material não auditável (logs pobres, drafts sem revisão)" — alta — **parcialmente mitigado**: schema de auditabilidade (ai_jobs, ai_artifacts, ai_messages, ai_prompt_templates, ai_guardrail_results, ai_budget_caps, ai_model_versions, ai_eval_cases, ai_eval_runs) ergueu antes da primeira chamada de provider. Toda mutação grava ação canônica em `audit_log`. Gate de aprovação humana (artifact status pending_review→approved) é exigido por design — sem rota que publique sem revisão. Mitigação completa exige Cycle 3 (guardrails ativos: bloqueio de promessa de retorno, recomendação sem suitability, etc.) + AI-5 (recommendation ledger v2 com compliance gate).

## Mitigações + riscos novos de AI-1 Cycle 2 (2026-04-26)

- Risco "IA produzir material não auditável" — alta — **mais mitigado**: gateway grava cada chamada com tokens, custo real, latência, hashes de input/output, model version e prompt template version. Mock provider permite verifier sem custo real. Falta Cycle 3 (guardrails) pra mitigação completa.
- Risco "Custo descontrolado em IA" — alta → **mitigado**: budget caps com escopo (global/surface/job_type/lead) × período (day/month) e ação (warn/block) funcionam — verifier prova HTTP 402 em cap exceeded. Default seed value de 5000 cents/mês documentado em env.example. Você precisa setar o cap real via SQL/admin antes do primeiro memo em produção.
- Risco novo "API key vazamento" — média — **a mitigar**: `ANTHROPIC_API_KEY` fica só na `/home/savastano-advisory/.env` do servidor (fora do git, fora das imagens Docker). Acesso ao servidor = acesso à chave. Pendência: documentar processo de rotação em runbook futuro.
- Risco novo "Modelo upgrade quebra prompts em produção" — média — **mitigado por design**: pin explícito de `claude-sonnet-4-6` via env + `ai_model_versions` com status lifecycle. Auto-update intencionalmente NÃO implementado. Promoção candidate→active exige PATCH admin + golden eval (Cycle 4 automatiza).

## Mitigações + riscos novos de AI-1 Cycle 3 (2026-04-26)

- Risco "IA produzir material não auditável" — alta → **resolvido para surfaces internas**: guardrails regex (no_promised_returns, no_risk_minimization, no_specific_asset_advice) rodam em todo output, com persistência em `ai_guardrail_results`. Schema validator (`grounding.ts`) bloqueia outputs malformados quando `requires_grounding=1`. Cobertura completa para client-facing exige AI-5 (compliance gate de recomendação publicada) + AI-6 (RAG real com source-id grounding).
- Risco novo "PII vaza para provider externo" — média → **mitigado**: redaction layer strip CPF/CNPJ/RG/cartão antes do prompt chegar ao Anthropic. `ai_jobs.input_hash` é calculado da versão redacted. Decisão consciente: nome, email, telefone, faixa patrimonial passam (necessários ao output, consentidos no intake).
- Risco novo "Falha transiente do provider quebra UX" — baixa → **mitigado**: retry policy com backoff exponencial (1s/2s/4s, 3 tentativas) em 429/5xx via `lib/ai/retry.ts`. Auth/invalid request NÃO são retried. Latência cumulativa preserva auditoria.
