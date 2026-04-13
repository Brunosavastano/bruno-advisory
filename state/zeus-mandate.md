# Zeus Mandate — T0 / Cycle 4

## Data
2026-04-13 05:30 Europe/Berlin

## Tranche ativa
T0 — Foundation, Repo e Separação Dura

## Resultado da auditoria do ciclo anterior
Parcial, porém rejeitado para aceite. Houve melhora real no verificador, mas a prova operacional continua não confiável porque o build falha de forma intermitente no próprio fluxo de auditoria.

## Evidência auditada
- `infra/scripts/verify-t0.sh` foi melhorado e deixou de fixar a porta 3000
- o script agora tenta typecheck, build e subida com porta efêmera
- `state/evidence/T0/verify.log` registra esse fluxo
- porém a execução auditada falhou no build com erro real do Next:
  - `ENOENT: no such file or directory, open 'apps/web/.next/server/app/_not-found/page.js.nft.json'`
- portanto a verificação ponta a ponta continua sem aceite

## Mandato ao Vulcanus
Eliminar a instabilidade do build e entregar verificação T0 reproduzível duas vezes seguidas no mesmo ambiente, sem intervenção manual.

## Escopo obrigatório deste ciclo
1. Corrigir a causa da falha intermitente de build em `@bruno-advisory/web`.
2. Ajustar o fluxo de verificação para partir de estado limpo quando necessário, sem mascarar problemas reais.
3. Executar a verificação completa duas vezes seguidas e persistir evidência das duas execuções.
4. Garantir presença e validade de:
   - `state/evidence/T0/dev-server.log`
   - `state/evidence/T0/health.json`
   - `state/evidence/T0/control-room.html`
   - `state/evidence/T0/verify.log`
5. Registrar em doc curta o comando único de auditoria e o que ainda falta para T0 após a prova local aceita.

## Evidência mínima de aceite
- diff relevante na causa do build instável
- `bash infra/scripts/verify-t0.sh` passando duas vezes seguidas
- `verify.log` mostrando as duas execuções bem-sucedidas
- `health.json` válido
- `control-room.html` contendo projeto, tranche ativa e status

## Critério de rejeição
- build só passar de forma ocasional
- solução que apenas esconda erro limpando evidência sem explicar a causa
- uma execução passar e a seguinte falhar
- ausência de artefatos completos

## Justificativa
O item mais alavancado continua sendo confiabilidade operacional mínima. Sem build estável e verificação reproduzível, T0 não tem base auditável para avançar para DB, deploy ou healthchecks mais fortes.
