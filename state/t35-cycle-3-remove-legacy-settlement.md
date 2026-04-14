# T3.5 Cycle 3 — Remoção da rota legada de settlement

## O que foi feito
- Removi a rota legada implícita no nível do lead em `apps/web/app/api/cockpit/leads/[leadId]/billing-settlements/route.ts`.
- Mantive funcional apenas a rota direcionada por `chargeId` em `billing-settlements/[chargeId]/route.ts`.
- Ajustei a surface do detalhe do lead para apontar apenas para a liquidação direcionada por charge específica.

## Onde está
- Remoção: `apps/web/app/api/cockpit/leads/[leadId]/billing-settlements/route.ts`
- Rota mantida: `apps/web/app/api/cockpit/leads/[leadId]/billing-settlements/[chargeId]/route.ts`
- Surface ajustada: `apps/web/app/cockpit/leads/[leadId]/page.tsx`
- Verificador: `infra/scripts/verify-t35-cycle-3-local.sh`
- Evidência: `state/evidence/T3.5-cycle-3/summary-local.json`

## Como verificar
- `bash infra/scripts/verify-t35-cycle-3-local.sh`
- Confirmar que:
  - o arquivo da rota legada não existe mais
  - o manifest só contém `/api/cockpit/leads/[leadId]/billing-settlements/[chargeId]`
  - a liquidação direcionada continua retornando `201`
  - o detalhe do lead só aponta para action com `chargeId`

## O que falta
- Seguir para o próximo ciclo de hardening sem reintroduzir settlement implícito por lead.
