# T5 Cycle 2 — Memo skeleton

## What was built
- Container manual-first de memos, sem geração por IA.
- Modelo canônico com status `draft -> pending_review -> approved -> published`.
- Persistência SQLite em `memos`, com vínculo opcional a `research_workflows`.
- CRUD operacional no cockpit por lead, incluindo atualização de body e status.
- Exposição no portal apenas para memos `published`, isolados por sessão.
- Verifier local que prova memo standalone publicado, memo linkado com persistência de `researchWorkflowId`, bloqueio de não-published e isolamento cross-lead.

## Where it is
- Modelo: `packages/core/src/memo-model.ts`
- Export: `packages/core/src/index.ts`
- Schema SQLite: `apps/web/lib/storage/db.ts`
- Storage: `apps/web/lib/storage/memos.ts`
- Barrel: `apps/web/lib/intake-storage.ts`
- Cockpit API: `apps/web/app/api/cockpit/leads/[leadId]/memos/route.ts`
- Cockpit surface: `apps/web/app/cockpit/leads/[leadId]/memos-panel.tsx`
- Lead detail integration: `apps/web/app/cockpit/leads/[leadId]/page.tsx`
- Portal API: `apps/web/app/api/portal/memos/route.ts`
- Portal surface: `apps/web/app/portal/memos/page.tsx`
- Portal dashboard link: `apps/web/app/portal/dashboard/page.tsx`
- Verifier: `infra/scripts/verify-t5-cycle-2-local.sh`
- Evidence: `state/evidence/T5-cycle-2/summary-local.json`

## How to verify
1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:t5:cycle2:local`
4. Confirmar em `state/evidence/T5-cycle-2/summary-local.json` que `ok` é `true`.
5. Confirmar no summary que:
   - portal do lead A vê só o memo `published` dele
   - memo não publicado não aparece no portal
   - portal do lead B não vê dados do lead A
   - `researchWorkflowId` do memo linkado persiste no DB

## Remaining risk
- O ciclo entrega só o container manual de memos. Ainda faltam fila humana de review, auditoria crítica unificada e fluxos operacionais de beta/go-live.
- A verificação continua em modo local por invocação de rotas compiladas quando bind HTTP bruto fica bloqueado no sandbox.

## Next best step
- Abrir T5 ciclo 3 para a review queue humana, listando research workflows e memos em `pending_review` com ações diretas de aprovação ou rejeição.
