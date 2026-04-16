# Savastano Advisory

Este pacote substitui a proposta anterior e assume as novas regras fundacionais:

- projeto 100% novo
- repo próprio
- DB própria
- workflows próprios
- deploy próprio
- identidade própria
- zero dependência operacional do VLH
- Zeus = único orquestrador
- Vulcanus = único builder

## Princípio central

Reusar padrões técnicos é aceitável. Reusar instância, estado, dados, segredos, workflows, deploys ou identidade é proibido.

## Stack recomendado

- **App**: Next.js + React + TypeScript
- **DB**: PostgreSQL em produção; SQLite apenas para desenvolvimento local, se desejar
- **Auth**: camada própria do projeto
- **Jobs**: scripts Node/bash + cron do projeto
- **Deploy**: pipeline independente
- **Observabilidade**: logs, backups e healthchecks independentes

## Pastas principais

- `PROJECT.md`: escopo, princípios, anti-objetivos
- `AGENTS.md`: papéis e contrato operacional entre Zeus e Vulcanus
- `ROADMAP.md`: tranches e stage gates
- `project.yaml`: estado de máquina do projeto
- `heartbeat.md`: loop 24/7 dos OpenClaws
- `CONTROL_ROOM_SPEC.md`: especificação do cockpit interno
- `repo_layout.md`: layout sugerido do repo
- `agents/tranches/*`: prompts detalhados por tranche

## Recomendação prática

1. Criar repo privado novo.
2. Subir ambiente novo, com segredos novos.
3. Colar estes arquivos.
4. Marcar `T0` como tranche ativa.
5. Deixar Zeus governar o bootstrap.
