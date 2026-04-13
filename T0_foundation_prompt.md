# T0 — Foundation Prompt

## Dono da tranche
Zeus

## Executor principal
Vulcanus

## Missão
Construir a fundação do projeto em ambiente totalmente independente do VLH.

## Restrições
- nenhum compartilhamento de repo, DB, secrets, workflows, deploy ou identidade com VLH
- sem novos agentes
- sem features cosméticas

## Entregáveis mínimos
- repo privado estruturado
- docs canônicas no root
- app inicial sobe localmente
- ambiente independente definido
- DB do projeto configurada
- pipeline/deploy mínimo independente
- skeleton do Control Room
- logs e backup path definidos
- healthcheck simples disponível

## Sucesso
A tranche fecha quando:
1. existe repo novo operando sozinho
2. o app sobe sem qualquer dependência operacional do VLH
3. há uma página interna de Control Room exibindo pelo menos:
   - projeto
   - tranche ativa
   - status geral
4. o estado do projeto está versionado no repo
5. há prova de deploy/execução em ambiente próprio

## Fracasso
A tranche falha se:
- houver qualquer dependência ativa do VLH
- o repo existir, mas sem execução real
- não houver trilha mínima de logs/backup
- o Control Room for apenas mock

## Instrução para Vulcanus
Entregue primeiro a independência estrutural. Só depois o conforto ergonômico.
Cada ciclo precisa reduzir risco estrutural.
