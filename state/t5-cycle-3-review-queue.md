# T5 Cycle 3 — Human review queue

## What was built
- Fila única de revisão humana para memos em `pending_review` e research workflows em `review`.
- Ações inline de aprovação e rejeição a partir da própria fila.
- Persistência de `reviewRejectionReason` e `reviewedAt` em memos e research workflows.
- Novo status `rejected` em ambos os modelos canônicos.
- Audit trail dedicado com `memo_events` e `research_workflow_events` para aprovações e rejeições.
- Verifier local que prova fila preenchida, transições corretas, persistência de motivo, gravação de eventos e esvaziamento da queue após ação.

## Where it is
- Review queue API: `apps/web/app/api/cockpit/review-queue/route.ts`
- Review queue page: `apps/web/app/cockpit/review-queue/page.tsx`
- Review queue client panel: `apps/web/app/cockpit/review-queue/review-queue-panel.tsx`
- Modelos canônicos:
  - `packages/core/src/memo-model.ts`
  - `packages/core/src/research-workflow-model.ts`
- Schema SQLite + event tables: `apps/web/lib/storage/db.ts`
- Storage:
  - `apps/web/lib/storage/memos.ts`
  - `apps/web/lib/storage/research-workflows.ts`
  - `apps/web/lib/storage/review-queue.ts`
- Lead detail / cockpit links:
  - `apps/web/app/cockpit/leads/page.tsx`
  - `apps/web/app/cockpit/leads/[leadId]/page.tsx`
- Verifier: `infra/scripts/verify-t5-cycle-3-local.sh`
- Evidence: `state/evidence/T5-cycle-3/summary-local.json`

## How to verify
1. `npm run typecheck`
2. `npm run build`
3. `bash infra/scripts/verify-t5-cycle-3-local.sh`
4. Confirmar em `state/evidence/T5-cycle-3/summary-local.json` que `ok` é `true`.
5. Confirmar no summary que:
   - `queueBefore` contém um `memo` e um `research_workflow`
   - `approvedMemo.status` é `approved` e `reviewedAt` está preenchido
   - `rejectedWorkflow.status` é `rejected` e `reviewRejectionReason` persiste
   - `memoEvents` e `workflowEvents` contêm os eventos esperados
   - `queueAfter` está vazio

## Remaining risk
- A fila humana agora existe, mas ainda falta a trilha de auditoria crítica unificada do ciclo 4.
- A revisão inline usa prompt no cliente para o motivo da rejeição, funcional e mínima, mas ainda sem UX refinada.
- A verificação continua em modo local por invocação de rotas compiladas quando bind HTTP bruto fica bloqueado no sandbox.

## Next best step
- Abrir T5 ciclo 4 para audit log unificado das ações críticas, consolidando billing, review, portal e operações do cockpit em uma superfície única de auditoria.
