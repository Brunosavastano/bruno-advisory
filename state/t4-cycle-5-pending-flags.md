# T4 Cycle 5, internal pending flags + Bruno overview

## Objective
Entregar flags internas por lead no cockpit, com persistência auditável em SQLite, overview agregado para Bruno e invisibilidade completa no portal do cliente.

## What changed
- Flags internas canônicas em `packages/core/src/pending-flag-model.ts`.
- Persistência em `lead_pending_flags` com `flag_id`, `lead_id`, `flag_type`, `note`, `set_at`, `set_by`, `cleared_at`, `cleared_by`.
- Storage local com mutação real (`setFlag`, `clearFlag`) e leitura agregada (`listAllLeadsWithActiveFlags`).
- Cockpit por lead com criação e remoção de flags internas.
- Overview agregado em `/cockpit/flags` para Bruno ver todos os leads com pendências ativas.
- Nenhuma rota/superfície nova foi adicionada ao portal do cliente.

## Where
- `packages/core/src/pending-flag-model.ts`
- `packages/core/src/index.ts`
- `apps/web/lib/storage/db.ts`
- `apps/web/lib/storage/flags.ts`
- `apps/web/lib/storage/types.ts`
- `apps/web/lib/intake-storage.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/flags/route.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/flags/[flagType]/route.ts`
- `apps/web/app/api/cockpit/flags/route.ts`
- `apps/web/app/cockpit/flags/page.tsx`
- `apps/web/app/cockpit/leads/[leadId]/lead-flags-panel.tsx`
- `apps/web/app/cockpit/leads/[leadId]/page.tsx`
- `infra/scripts/verify-t4-cycle-5-local.sh`
- `state/evidence/T4-cycle-5/summary-local.json`

## Verify
```bash
npm run typecheck
bash infra/scripts/verify-t4-cycle-5-local.sh
```

## Acceptance evidence
- Mutação real no cockpit para criar flag `pending_document` e `pending_call`.
- Remoção real de flag via cockpit.
- Persistência auditável em DB com trilha mínima de set/clear por operador.
- Leitura agregada real em `/api/cockpit/flags` e `/cockpit/flags`.
- Prova explícita de invisibilidade no portal em `state/evidence/T4-cycle-5/summary-local.json`.

## Notes
- Sem dependências novas.
- Sem provider externo.
- Sem acoplamento com VLH.
