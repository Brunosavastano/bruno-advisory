# T3 Closure

## Status
Aceita e fechada localmente por Zeus.

## Data
2026-04-14

## Critério de fechamento aplicado
Gate de saída da T3 no `ROADMAP.md` e no `T3_crm_billing_prompt.md`: um lead pode virar cliente, um cliente pode ter cobrança recorrente configurada no sistema, os eventos principais ficam registrados e Bruno consegue acompanhar a operação no Control Room/cockpit interno.

## Evidência auditada
- `packages/core/src/commercial-stage-model.ts`
- `packages/core/src/billing-entry-model.ts`
- `packages/core/src/local-billing-model.ts`
- `packages/core/src/local-billing-charge-model.ts`
- `packages/core/src/local-billing-settlement-model.ts`
- `packages/core/src/local-billing-charge-progression-model.ts`
- `packages/core/src/local-billing-settlement-targeting-model.ts`
- `packages/core/src/local-billing-overview-model.ts`
- `apps/web/app/cockpit/leads/page.tsx`
- `apps/web/app/cockpit/leads/[leadId]/page.tsx`
- `apps/web/app/cockpit/billing/page.tsx`
- `apps/web/app/api/cockpit/leads/[leadId]/commercial-stage/route.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/notes/route.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/tasks/route.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/tasks/[taskId]/status/route.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/billing-readiness/route.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/billing-record/route.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/billing-charges/route.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/billing-charges/next/route.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/billing-settlements/route.ts`
- `apps/web/app/api/cockpit/leads/[leadId]/billing-settlements/[chargeId]/route.ts`
- `apps/web/lib/intake-storage.ts`
- `state/t3-cycle-1-operator-spine.md`
- `state/t3-cycle-2-operator-record-notes-tasks.md`
- `state/t3-cycle-3-task-lifecycle-audit.md`
- `state/t3-cycle-4-billing-readiness.md`
- `state/t3-cycle-5-local-billing-activation.md`
- `state/t3-cycle-6-local-charge-creation.md`
- `state/t3-cycle-7-local-settlement.md`
- `state/t3-cycle-8-recurring-charge-progression.md`
- `state/t3-cycle-9-charge-targeted-settlement.md`
- `state/t3-cycle-10-billing-operations-overview.md`
- `state/evidence/T3-cycle-1/summary-local.json`
- `state/evidence/T3-cycle-2/summary-local.json`
- `state/evidence/T3-cycle-3/summary-local.json`
- `state/evidence/T3-cycle-4/summary-local.json`
- `state/evidence/T3-cycle-5/summary-local.json`
- `state/evidence/T3-cycle-6/summary-local.json`
- `state/evidence/T3-cycle-7/summary-local.json`
- `state/evidence/T3-cycle-8/summary-local.json`
- `state/evidence/T3-cycle-9/summary-local.json`
- `state/evidence/T3-cycle-10/summary-local.json`

## O que ficou fechado na T3
- CRM interno com estágio comercial persistido e auditável
- detalhe operacional do lead com notas, tarefas e trilha mínima de auditoria
- gate de prontidão para entrada em billing
- ativação de billing local com pricing canônico do T1
- primeira cobrança recorrente local persistida
- liquidação local auditável
- progressão recorrente para a próxima cobrança em sequência
- liquidação explicitamente direcionada por `chargeId`
- overview global de billing no cockpit com links para detalhe do lead
- registro persistido dos principais eventos operacionais e de cobrança

## O que NÃO foi aberto aqui
- provider externo de billing
- reconciliação financeira ampla
- collections workflow mais rico
- portal do cliente de T4
- expansão de auth/RBAC além do mínimo já existente no projeto
- abertura automática da T4

## Verdade operacional
A T3 está fechada no canon local do repo. O projeto continua em `release_mode: shadow` e `prod_ready: false`. A prova segue baseada em verificação local/compiled-route porque este sandbox bloqueia bind HTTP bruto (`listen EPERM`), mas a trilha auditável cobre os estados centrais do CRM e do billing local, inclusive visão de acompanhamento no cockpit.

## Próximo passo sugerido
Esperar autorização explícita de Bruno antes de abrir a T4. Se Bruno quiser continuar no eixo operacional antes de portal, a próxima conversa deve decidir conscientemente se vale abrir uma tranche intermediária ou ir direto para o gate de T4.
