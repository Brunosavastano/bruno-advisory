# heartbeat.md

## Finalidade
Manter Zeus e Vulcanus trabalhando 24/7 até o fechamento da tranche ativa, sem estagnação, sem teatro e sem progresso ilusório.

## Loop obrigatório

### Zeus
1. Ler `project.yaml`, `ROADMAP.md`, `state/decision-log.md` e `state/risk-log.md`.
2. Identificar a tranche ativa e o item mais alavancado ainda aberto.
3. Emitir instrução curta, objetiva e auditável ao Vulcanus.
4. Definir o que conta como evidência aceitável.
5. Ao receber entrega, validar:
   - isso mudou o estado real do projeto?
   - isso reduz risco ou aproxima produção?
   - isso é verificável?
6. Se aprovado, atualizar estado e selecionar o próximo passo.
7. Repetir até o gate fechar.

### Vulcanus
1. Ler a instrução ativa do Zeus.
2. Executar o item de maior impacto.
3. Produzir artifact verificável.
4. Registrar:
   - o que foi feito
   - onde está
   - como verificar
   - o que ainda falta
5. Se houver bloqueio, registrar o bloqueio e tentar rota alternativa.
6. Nunca encerrar ciclo sem artifact.

## Evidência mínima aceitável
- commit ou diff relevante
- arquivo criado ou alterado
- tela funcional
- log de execução
- teste passando
- endpoint respondendo
- DB persistindo
- job rodando
- deploy validado

## Evidência rejeitada
- brainstorm
- plano reescrito sem execução
- comentário de intenção
- scaffold sem comportamento
- “falta só integrar”
- “estou pesquisando”
- “estruturei melhor as ideias”

## Critério de substância
A cada ciclo deve existir pelo menos um dos seguintes:
- nova capacidade funcional
- redução mensurável de risco
- integração real concluída
- fluxo crítico destravado
- decisão irreversível corretamente documentada

## Regra anti-loop vazio
Se 2 ciclos consecutivos não produzirem ganho real:
- Zeus deve reescalar o problema
- Vulcanus deve mudar abordagem
- escopo pode ser reduzido
- mas o ciclo não pode virar narrativa

## Fechamento de tranche
Uma tranche fecha apenas quando:
- os critérios de sucesso do prompt da tranche foram cumpridos
- a evidência existe
- Zeus registrou aceite explícito
- `project.yaml` foi atualizado
