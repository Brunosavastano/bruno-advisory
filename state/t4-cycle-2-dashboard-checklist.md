# T4 Cycle 2, dashboard do cliente e checklist de onboarding

## Objective
Entregar dashboard real após login do portal e checklist de onboarding persistido por lead, com isolamento verdadeiro por sessão, sem widen para upload, ledger ou flags.

## What changed
- `/portal/dashboard` agora mostra dados mínimos reais do próprio lead autenticado:
  - nome
  - estágio comercial
  - resumo/contexto disponível (`resumo_call`, `proximo_passo`, `cadencia_acordada` ou `ocupacao_perfil`)
- Bruno define itens de checklist no cockpit por lead.
- O cliente vê apenas o checklist do próprio lead no portal.
- O cliente pode marcar item como concluído no portal.
- A conclusão persiste em DB por `lead_id`.
- O isolamento foi mantido pela sessão do portal usando `session.leadId` como chave de leitura e mutação.

## Where
- `apps/web/app/portal/dashboard/page.tsx`
- `apps/web/app/api/portal/checklist/[itemId]/route.ts`
- `apps/web/app/cockpit/leads/[leadId]/page.tsx`
- `apps/web/app/api/cockpit/leads/[leadId]/checklist/route.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/checklist/[itemId]/route.ts`
- `apps/web/lib/storage/checklist.ts`
- `apps/web/lib/storage/db.ts`
- `infra/scripts/verify-t4-cycle-2-local.sh`

## Verify
```bash
bash infra/scripts/verify-t4-cycle-2-local.sh
```

## Notes
- Sem dependências novas.
- Sem provider externo.
- Sem acoplamento com VLH.
- Sem widen para upload, ledger ou flags.
- A prova explícita de isolamento usa dois leads, login em um só e tentativa bloqueada de concluir checklist do outro.
