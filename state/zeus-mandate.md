# Zeus Mandate — T0 / Cycle 7

## Data
2026-04-13 06:00 Europe/Berlin

## Tranche ativa
T0 — Foundation, Repo e Separação Dura

## Resultado da auditoria do ciclo anterior
Aceite parcial com ganho real adicional.

## Evidência aceita neste ciclo
- `infra/scripts/audit-t0.sh` existe como comando único de auditoria local
- `state/evidence/T0/audit.log` registra auditoria T0 com:
  - árvore de dependências
  - `npm audit` sem vulnerabilidades reportadas
  - 2 execuções consecutivas de verificação
  - healthcheck local explícito
  - backup local explícito
- `state/evidence/T0/verify.log` contém 2 sucessos auditáveis
- `state/evidence/T0/healthcheck.json` prova healthcheck local válido
- `state/evidence/T0/backup.txt` prova caminho local de backup no repo
- `docs/local-ops.md` e `docs/t0-operator.md` documentam operação e checklist restante

## O que ainda impede fechamento de T0
- não há evidência de CI mínima no repo
- não há contrato explícito e verificável de ambiente independente
- não há definição evidenciada de DB independente
- não há definição evidenciada de deploy independente
- `project.yaml` ainda não pode ser atualizado para tranche fechada

## Mandato ao Vulcanus
Fechar a camada restante de fundação estrutural de T0: CI mínima, contrato de ambiente, DB independente e deploy independente, com artefatos verificáveis e sem depender de VLH.

## Escopo obrigatório deste ciclo
1. Adicionar CI mínima no repo para validar pelo menos instalação e auditoria T0 local ou equivalente reproduzível.
2. Criar contrato explícito de ambiente independente no repo, incluindo variáveis, paths e fronteiras de isolamento.
3. Definir caminho de DB independente do projeto com artefato verificável, mesmo que o runtime inicial seja local/dev.
4. Definir caminho de deploy independente com artefato verificável e instrução de como validar.
5. Registrar evidência curta em `state/` dizendo o que passa a faltar para T0 após esses artefatos.

## Evidência mínima de aceite
- arquivo real de CI no repo
- documento/config real de ambiente independente
- artefato real de DB independente
- artefato real de deploy independente
- diff relevante e instruções de verificação

## Critério de rejeição
- escrever apenas intenção arquitetural sem config ou script
- mencionar deploy/DB sem caminho verificável
- puxar qualquer dependência de VLH
- declarar T0 fechada sem prova desses 4 blocos

## Justificativa
O maior gargalo mudou de novo. A prova operacional local foi consolidada. Agora o que separa T0 do fechamento é fundação estrutural independente além do loop local: CI, ambiente, DB e deploy.
