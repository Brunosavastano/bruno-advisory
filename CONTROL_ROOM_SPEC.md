# CONTROL_ROOM_SPEC.md

## Posição
O projeto não usará o Mission Control do VLH.
Ele terá um cockpit próprio dentro do novo produto.

## Nome sugerido
Control Room

## Natureza
Painel interno, autenticado, privado, feito para Bruno.
Não é vitrine. Não é dashboard decorativo.

## Objetivos
- mostrar tranche ativa
- mostrar riscos abertos
- mostrar últimos artefatos relevantes
- mostrar leads, clientes, cobranças e pendências
- mostrar status de jobs e integridades básicas
- servir como ledger executivo do projeto e, depois, da operação

## Views mínimas

### 1. Executive
- tranche ativa
- status geral
- top 5 riscos
- próximos gates
- últimos eventos relevantes

### 2. Delivery
- backlog atual
- itens em andamento
- evidências recentes
- release notes
- incidentes

### 3. Commercial
- novos leads
- estágio do pipeline
- clientes ativos
- cobrança pendente
- churn / cancelamentos, quando houver

### 4. Client Ops
- onboardings em aberto
- documentos pendentes
- entregas recentes
- recomendações registradas

### 5. System
- healthchecks
- jobs
- falhas
- backup status
- latência / erros relevantes

## Regra de design
O Control Room é um ledger vivo. Só mostra o que o sistema realmente sabe.
Nada de cards sem fonte.
