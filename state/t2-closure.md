# T2 Closure

## Status
Aceita e fechada localmente por Zeus.

## Data
2026-04-13

## Critério de fechamento aplicado
Gate de saída da T2 no `ROADMAP.md` e no `T2_site_prompt.md`: um visitante consegue entender a proposta, consegue enviar seus dados, esses dados entram na DB do projeto, Bruno consegue ver o lead no painel interno e há evidência de fluxo ponta a ponta testado.

## Evidência auditada
- `apps/web/app/page.tsx`
- `apps/web/app/para-quem-e/page.tsx`
- `apps/web/app/como-funciona/page.tsx`
- `apps/web/app/privacidade/page.tsx`
- `apps/web/app/termos/page.tsx`
- `apps/web/app/intake/page.tsx`
- `apps/web/app/api/intake/route.ts`
- `apps/web/app/cockpit/leads/page.tsx`
- `apps/web/lib/intake-storage.ts`
- `infra/scripts/verify-t2.sh`
- `infra/scripts/inspect-t2-db.sh`
- `state/t2-cycle-3-db-persistence.md`
- `state/t2-cycle-4-public-surface.md`
- `state/t2-cycle-5-verification.md`
- `state/evidence/T2-cycle-5/summary.json`
- `state/evidence/T2-cycle-5/verify.log`

## O que ficou fechado na T2
- homepage pública com proposta compreensível
- páginas institucionais essenciais
- CTA principal real
- formulário de intake real
- validação no servidor
- captura do lead na DB do projeto
- eventos básicos do funil
- visualização interna dos leads recebidos
- prova ponta a ponta repetível via script repo-local

## O que NÃO foi aberto aqui
- CRM/backoffice de T3
- billing recorrente
- portal do cliente
- auth/RBAC
- produção pública final
- preenchimento automático de detalhes canônicos ainda pendentes na superfície de compliance
- abertura automática da T3

## Verdade operacional
A T2 está fechada no canon local do repo. O projeto continua em `release_mode: shadow` e `prod_ready: false`. Existem detalhes públicos de compliance ainda marcados como pendentes de publicação, mas isso não impediu o fechamento do gate funcional da T2 porque a tranche exigia superfície pública entendível, intake real, persistência em DB, visibilidade interna e prova ponta a ponta auditável.

## Próximo passo sugerido
Se Bruno autorizar, abrir a T3 com foco estrito em backoffice mínimo: estados do lead/cliente, notas internas, tasks/flags, billing recorrente e trilha mínima de auditoria.
