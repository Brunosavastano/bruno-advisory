# T3.5 Cycle 3 — legacy settlement route removed

## O que foi feito
- Confirmei que a rota legada implícita `apps/web/app/api/cockpit/leads/[leadId]/billing-settlements/route.ts` não existe mais.
- Mantive a rota canônica direcionada por charge em `apps/web/app/api/cockpit/leads/[leadId]/billing-settlements/[chargeId]/route.ts`.
- Verifiquei a surface de detalhe do lead e confirmei que os formulários de liquidação usam apenas a action com `chargeId`.
- Mantive o verificador local por route handler compilado em `infra/scripts/verify-t35-cycle-3-local.sh`.

## Onde está
- Rota canônica mantida: `apps/web/app/api/cockpit/leads/[leadId]/billing-settlements/[chargeId]/route.ts`
- Surface validada: `apps/web/app/cockpit/leads/[leadId]/page.tsx`
- Verificador: `infra/scripts/verify-t35-cycle-3-local.sh`
- Evidência: `state/evidence/T3.5-cycle-3/summary-local.json`

## Como verificar
- `npm run typecheck`
- `npm run build`
- `bash infra/scripts/verify-t35-cycle-3-local.sh`
- Confirmar no `summary-local.json` que:
  - `legacyRouteFilePresent` é `false`
  - `manifestHasTargetedRoute` é `true`
  - `manifestHasLegacyRoute` é `false`
  - `targetedSettlement.status` é `201`

## Risco remanescente
- Scripts e notas históricas dos ciclos T3 anteriores ainda mencionam a rota legada como parte da evolução do sistema. Isso é aceitável como histórico, mas não deve ser reutilizado como baseline ativo.

## Próximo melhor passo
- Prosseguir para o próximo ciclo de hardening mantendo `billing-settlements/[chargeId]` como único mutation path de settlement.
