# repo_layout.md

## Recomendação

Um único repo privado, com uma única codebase principal, e estado operacional explícito no próprio repo.

```text
bruno-advisory/
  apps/
    web/                    # site público + portal + control room (role-gated)
  packages/
    core/                   # utilidades, tipos, validações
    ui/                     # componentes compartilhados
  agents/
    ZEUS.md
    VULCANUS.md
    tranches/
      T0_foundation_prompt.md
      T1_offer_prompt.md
      T2_site_prompt.md
      T3_crm_billing_prompt.md
      T4_portal_prompt.md
      T5_beta_prompt.md
  state/
    decision-log.md
    risk-log.md
    zeus-mandate.md
    evidence/
      T0/
      T1/
      T2/
      T3/
      T4/
      T5/
  docs/
    architecture.md
    data-model.md
    billing.md
    onboarding.md
  infra/
    docker/
    scripts/
    backups/
    deploy/
  PROJECT.md
  AGENTS.md
  ROADMAP.md
  project.yaml
  heartbeat.md
  CONTROL_ROOM_SPEC.md
```

## Observações
- Um app pode servir público, cliente e control room com route groups e RBAC.
- Um DB só para o projeto.
- Um storage só para o projeto.
- Um pipeline só para o projeto.
- Um arquivo de estado legível por agente e por humano.
- `state/` é a fonte canônica de estado operacional.

## Branching
- `main` protegida
- feature branches curtas
- Zeus aprova merge
- releases tagueadas
