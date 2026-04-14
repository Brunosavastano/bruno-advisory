# T3.5 Cycle 5 - CRM field expansion

## Status
Concluido localmente em 2026-04-14.

## Entregas
- `apps/web/lib/storage/db.ts`
- `apps/web/lib/storage/types.ts`
- `apps/web/lib/storage/leads.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/crm-fields/route.ts`
- `apps/web/app/cockpit/leads/[leadId]/page.tsx`
- `infra/scripts/verify-t35-cycle-5-local.sh`
- `state/evidence/T3.5-cycle-5/summary-local.json`

## O que mudou
- Os 12 campos de CRM definidos em T1 foram adicionados ao schema SQLite com migração segura para bases já existentes.
- O tipo `StoredLead` agora expõe os novos campos no storage local.
- `getStoredLeadById` e `listStoredLeads` passaram a ler os campos de CRM.
- `updateLeadCrmFields()` atualiza qualquer subconjunto dos campos de CRM e mantém `updated_at` consistente.
- A rota `PATCH /api/cockpit/leads/[leadId]/crm-fields` valida payload parcial e persiste os campos.
- A tela de detalhe do lead agora mostra os novos campos em modo somente leitura.

## Verificação
- `npm run build`
- `bash infra/scripts/verify-t35-cycle-5-local.sh`

## Observação técnica
A verificação local usa route handlers compilados do Next.js em vez de bind HTTP, porque o sandbox bloqueia `listen` com `EPERM`.
