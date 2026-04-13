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
- 2026-04-13 — T1 abrirá com uma única oferta principal para PF premium, sem múltiplos planos — reduz ambiguidade comercial e simplifica operação, onboarding, CRM e copy — impacto: pacote comercial coerente e implementável para destravar T2 — dono: Vulcanus
- 2026-04-13 — Pricing inicial do V1 será taxa de entrada + mensalidade recorrente + compromisso mínimo de 6 meses — mantém simplicidade comercial e evita overbuild de billing cedo demais — impacto: proposta inicial mais vendável e rastreável — dono: Vulcanus
- 2026-04-13 — T0 dev DB independente será SQLite local em `data/dev/bruno-advisory-dev.sqlite3` — prova independência de banco sem puxar infra compartilhada ou escopo prematuro de produção — impacto: init script e evidência de DB local no repo — dono: Vulcanus
- 2026-04-13 — T0 deploy proof independente será a saída standalone do Next executada localmente — prova caminho de deploy real sem depender de VLH ou de um host de produção prematuro — impacto: script de verificação standalone e evidência dedicada em `state/evidence/T0/` — dono: Vulcanus
- 2026-04-13 — CI mínima de T0 será um gate local no próprio repo via `.githooks/pre-push` chamando `infra/scripts/ci-local.sh` — fecha a exigência de integração contínua sem usar componentes externos não aprovados — impacto: hook instalado, evidência de CI local e bloqueio de push quando a prova quebrar — dono: Zeus
- 2026-04-13 — T0 foi aceito e fechado por evidência — app local, audit path, healthcheck, backup, env contract, DB independente, deploy standalone e CI local ficaram comprovados no repo — impacto: `project.yaml` atualizado para `tranche_status: done` e projeto entra em espera até definição de T1 — dono: Zeus
- 2026-04-13 — Bruno autorizou a abertura da T1 — a tranche de oferta/comercial passa a ser a ativa e o projeto sai do estado de espera — impacto: `project.yaml` atualizado para `active_tranche: T1`, `tranche_status: active`, `stage_gate: proposition` — dono: Bruno
- 2026-04-13 — O canon local da T1 passa a ser composto por pack comercial + copy pública + pacote de compliance reconciliado no working tree local — elimina drift entre o estado local de T1 e o origin/main ainda parado em T0/compliance isolado — impacto: revisão de T1 pode acontecer inteiramente no repo local sem fake progress — dono: Vulcanus
- 2026-04-13 — T1 foi aceita e fechada localmente por Zeus — o pack comercial, a copy pública base e a surface de compliance formam uma proposta coerente, vendável e implementável para destravar T2 — impacto: `project.yaml` passa para `tranche_status: done` em T1; T2 não abre automaticamente e depende de decisão explícita posterior — dono: Zeus
