# T4 Cycle 1, auth skeleton por invite code

## Objective
Abrir o portal do cliente com isolamento de rotas e sessão própria, usando apenas invite code local, sem provider externo e sem abrir checklist, upload ou ledger neste ciclo.

## What changed
- Mantido o portal sob rotas dedicadas `/portal/*`.
- Fluxo de login por invite code disponível em `/portal/login`.
- Sessão própria do portal via cookie `portal_session`, separada de `COCKPIT_SECRET`.
- Gate de `/portal/*` no `proxy.ts`, com redirecionamento para `/portal/login` quando não há sessão do portal.
- Gestão de invite codes a partir do cockpit no detalhe do lead, com criação e revogação.
- Revogação também invalida sessões do portal associadas ao invite revogado.
- Verificador local criado com evidência reproduzível.

## Where
- `apps/web/proxy.ts`
- `apps/web/app/portal/page.tsx`
- `apps/web/app/portal/login/page.tsx`
- `apps/web/app/portal/dashboard/page.tsx`
- `apps/web/app/portal/logout/route.ts`
- `apps/web/app/api/portal/session/route.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/portal-invite-codes/route.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/portal-invite-codes/[inviteId]/revoke/route.ts`
- `apps/web/app/cockpit/leads/[leadId]/page.tsx`
- `apps/web/lib/storage/portal.ts`
- `apps/web/lib/storage/db.ts`
- `apps/web/lib/intake-storage.ts`
- `infra/scripts/verify-t4-cycle-1-local.sh`

## Verify
```bash
bash infra/scripts/verify-t4-cycle-1-local.sh
```

## Notes
- Sem dependências novas.
- Sem provider externo.
- Sem acoplamento com VLH.
- Sem widen para checklist, upload ou ledger.
