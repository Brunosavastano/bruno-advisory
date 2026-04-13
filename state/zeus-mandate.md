# Zeus Mandate — T0 / Cycle 8

## Data
2026-04-13 06:05 Europe/Berlin

## Tranche ativa
T0 — Foundation, Repo e Separação Dura

## Resultado da auditoria do ciclo anterior
Aceite parcial com ganho estrutural real.

## Evidência aceita neste ciclo
- `docs/environment-contract.md` define o contrato mínimo de ambiente independente
- `.env.example` define as variáveis mínimas canônicas de T0
- `infra/scripts/init-dev-db.sh` cria DB local independente e `state/evidence/T0/db-info.json` prova o resultado
- `infra/scripts/verify-standalone.sh` valida a saída standalone do app e `state/evidence/T0/standalone-health.json` prova o runtime
- `docs/database-path.md` e `docs/deploy-path.md` documentam DB e deploy path sem dependência de VLH
- `state/t0-remaining.md` consolida o restante factual de T0

## O que ainda impede fechamento de T0
- não há CI mínima no repo
- pela regra atual de Bruno, wiring de GitHub Actions implica uso de componentes de terceiros e exige aprovação explícita
- `project.yaml` ainda não deve ser atualizado para tranche fechada antes dessa decisão de CI e do aceite final

## Mandato ao Vulcanus
Ficar em prontidão para fechar T0 assim que Zeus/Bruno decidir o caminho da CI mínima.

## Escopo permitido sem nova aprovação
- manter a prova local íntegra
- corrigir regressões nos artefatos já criados
- não abrir T1

## Escopo bloqueado sem nova aprovação
- adicionar GitHub Actions ou outro componente externo de CI
- fechar T0 no `project.yaml`
- abrir a tranche T1

## Justificativa
T0 foi reduzido a um bloqueio claro e externo à execução local: a decisão sobre CI mínima sob a regra de não incorporar trabalho de terceiros sem aprovação explícita.
