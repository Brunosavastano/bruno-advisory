# PROJECT.md

## Nome interno
Bruno Advisory

## Identidade pública
Bruno Savastano

## Tese do projeto
Construir uma operação digital própria para consultoria de valores mobiliários com foco inicial em PF premium, usando IA como staff operacional invisível, sem terceirizar a responsabilidade final de aconselhamento.

## Regras fundacionais

1. Este projeto é independente do VLH.
2. Nada de dados, segredos, workflows, DBs, deploys ou identidades compartilhados com o VLH.
3. Apenas Zeus pode transitar entre universos. Mesmo assim, sem sincronização automática de estado.
4. Reuso de padrões técnicos é permitido. Reuso de instância não é.
5. O público compra Bruno Savastano. Não compra OpenClaws.
6. IA prepara, organiza, testa e acelera. Bruno decide e assume.
7. Cada tranche deve produzir avanço substancial e verificável.
8. Sem feature theater. Sem arquitetura ornamental.

## Cliente inicial
PF premium.
PJ pode entrar oportunisticamente, mas não define o V1.

## Objetivo do V1
Lançar uma operação enxuta, auditável e comercializável, composta por:

- site público em PT-BR
- captura e qualificação de leads
- CRM interno mínimo viável
- billing recorrente
- portal privado do cliente
- recommendation ledger básico
- cockpit interno de controle
- workflows assistidos por IA com aprovação humana

## Anti-objetivos

- virar uma cópia do VLH
- abrir cinco linhas de negócio ao mesmo tempo
- overbuild de agentes
- acoplamento secreto a infra legada
- marketing espalhafatoso
- recomendação autônoma sem supervisão
- launch sem trilha de auditoria mínima

## Decisão de arquitetura

### Separação dura
O projeto terá:

- repo próprio
- banco próprio
- segredos próprios
- domínio próprio
- deploy próprio
- storage próprio
- bot próprio, se houver notificações
- logs próprios
- backups próprios

### Reuso permitido
É permitido copiar e adaptar:

- padrões de código
- convenções de prompts
- esqueleto de observabilidade
- scripts utilitários
- ideias de arquitetura
- componentes genéricos sem estado legado

## Estado operacional mínimo

O projeto deve manter no repo os seguintes objetos canônicos:

- tranche ativa
- stage gate atual
- backlog priorizado
- log de decisões
- log de riscos
- evidências por tranche
- artefatos de deploy
- incident log
- release notes

## Critério de realidade
Nada é considerado pronto sem evidência verificável no repo, no ambiente ou no app.
