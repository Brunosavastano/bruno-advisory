# T3.5 Cycle 1 — Governança canônica

## O que foi corrigido
- `ROADMAP.md` não tinha T3.5, embora `project.yaml` e os artefatos de estado já a referissem.
- `state/decision-log.md` não registrava a abertura de T3.5, então o estado ativo ficava sem trilha decisória explícita.
- A correção foi feita sem abrir T4 e sem depender de VLH.

## Onde está
- Definição explícita de T3.5 no roadmap: `ROADMAP.md`
- Registro decisório da abertura intermediária: `state/decision-log.md`
- Estado ativo coerente: `project.yaml`
- Evidência de autorização/escopo já existente no repo: `state/t35-opening.md`, `state/zeus-mandate.md`
- Prova local: `infra/scripts/verify-t35-governance-local.sh`
- Diff relevante: `state/evidence/T3.5-cycle-1/governance.diff`

## Como verificar
- `bash infra/scripts/verify-t35-governance-local.sh`
- Inspecionar `state/evidence/T3.5-cycle-1/governance.diff`

## O que ainda falta
- Executar e aceitar os ciclos de hardening da T3.5 com evidência própria por ciclo.
- Fechar a tranche com `state/t35-closure.md` e atualização final de `project.yaml` quando o hardening terminar.

## Base probatória usada
- `state/t3-closure.md` mostra T3 fechada e T4 não aberta automaticamente.
- `state/t35-opening.md` registra autorização e escopo de T3.5.
- `state/zeus-mandate.md` registra T3.5 aberta, ciclo atual e entregáveis.
