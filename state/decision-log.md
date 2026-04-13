# decision-log.md

## Formato
- data
- decisão
- motivo
- impacto
- dono

## Entradas

- 2026-04-13 — Projeto será completamente separado do VLH — evita confusão operacional e vazamento de acoplamento — impacto: repo/db/deploy/identidade próprios — dono: Bruno
- 2026-04-13 — Zeus será o único orquestrador e Vulcanus o único builder na fase inicial — reduz complexidade e força cadeia de comando clara — impacto: nenhum novo OpenClaw antes de T3 salvo exceção expressa — dono: Bruno
- 2026-04-13 — V1 focará em PF premium — acelera posicionamento e simplifica operação — impacto: copy, onboarding e CRM partem desse ICP — dono: Bruno
- 2026-04-13 — Marca pública será Bruno Savastano — reforça autoridade pessoal e simplifica branding inicial — impacto: site e copy sem marca paralela — dono: Bruno
- 2026-04-13 — Baseline T0 do app será Next.js 16.2.3 com React 18 existente — fecha a vulnerabilidade ainda aberta no `npm audit` sem abrir escopo além do app local já verificado — impacto: dependência principal endurecida e trilha de auditoria local mantida — dono: Vulcanus
- 2026-04-13 — T0 terá caminhos locais explícitos de auditoria, backup e healthcheck dentro do repo — reduz ambiguidade operacional antes de qualquer passo de deploy — impacto: scripts em `infra/scripts/` e evidência em `state/evidence/T0/` — dono: Vulcanus
