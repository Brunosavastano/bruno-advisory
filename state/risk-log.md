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
