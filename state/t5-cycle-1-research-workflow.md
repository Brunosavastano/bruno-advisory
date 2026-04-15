# T5 Cycle 1 — Research workflow skeleton

## What was built
- Container manual-first de research workflow sem IA.
- Modelo canônico com status `draft -> in_progress -> review -> approved -> delivered`.
- Persistência SQLite dedicada em `research_workflows`.
- CRUD operacional no cockpit por lead.
- Exposição read-only no portal apenas para itens `delivered`, isolados por sessão.
- Verifier local que prova criação, avanço para `delivered`, visibilidade no portal, bloqueio de não-delivered e isolamento cross-lead.

## Where it is
- Modelo: `packages/core/src/research-workflow-model.ts`
- Export: `packages/core/src/index.ts`
- Schema SQLite: `apps/web/lib/storage/db.ts`
- Storage: `apps/web/lib/storage/research-workflows.ts`
- Barrel export: `apps/web/lib/intake-storage.ts`
- Cockpit API: `apps/web/app/api/cockpit/leads/[leadId]/research-workflows/route.ts`
- Cockpit surface: `apps/web/app/cockpit/leads/[leadId]/research-workflows-panel.tsx`
- Lead detail integration: `apps/web/app/cockpit/leads/[leadId]/page.tsx`
- Portal API: `apps/web/app/api/portal/research-workflows/route.ts`
- Portal surface: `apps/web/app/portal/research/page.tsx`
- Portal dashboard link: `apps/web/app/portal/dashboard/page.tsx`
- Verifier: `infra/scripts/verify-t5-cycle-1-local.sh`
- Evidence: `state/evidence/T5-cycle-1/summary-local.json`

## How to verify
1. `npm run typecheck`
2. `npm run build`
3. `npm run verify:t5:cycle1:local`
4. Confirmar em `state/evidence/T5-cycle-1/summary-local.json` que `ok` é `true`.
5. Confirmar no summary que:
   - portal do lead A vê apenas o workflow `delivered` dele
   - workflow `draft` não aparece no portal
   - portal do lead B não vê dados do lead A

## Remaining risk
- O ciclo entrega só o container de workflow. Ainda não existe memo vinculado, fila de review humana, nem trilha unificada de auditoria de ações críticas.
- A verificação continua no modo local por invocação de rotas compiladas quando bind HTTP bruto fica bloqueado no sandbox.

## Next best step
- Abrir T5 ciclo 2 para memo skeleton manual, com vínculo opcional ao research workflow e publicação controlada no portal.
