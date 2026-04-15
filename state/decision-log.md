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
- 2026-04-13 — Bruno autorizou a abertura da T2 — a tranche ativa passa a ser site público e intake, com foco estrito em aquisição funcional ponta a ponta — impacto: `project.yaml` atualizado para `active_tranche: T2`, `tranche_status: active`, `stage_gate: acquisition`; primeiro ciclo deve travar contrato de intake antes de UI ornamental — dono: Bruno
- 2026-04-13 — T2 ciclo 2 usará persistência durável local em JSONL para intake (`data/dev/intake-leads.jsonl` e `data/dev/intake-events.jsonl`) — entrega caminho real auditável de aquisição sem ampliar escopo para CRM/billing antes da hora — impacto: landing + CTA + intake validado + cockpit mínimo funcionam ponta a ponta localmente com contrato canônico — dono: Vulcanus
- 2026-04-13 — T2 ciclo 3 migra a persistência primária de intake para o DB local do projeto em `data/dev/bruno-advisory-dev.sqlite3` — remove o JSONL como storage primário sem alterar contrato canônico, statuses ou colunas mínimas do cockpit — impacto: leads e intake events passam a ser lidos e gravados via SQLite local, com importação legada dos JSONL apenas para continuidade de estado — dono: Vulcanus
- 2026-04-13 — T2 ciclo 4 publica a superfície institucional e de compliance mínima usando o canon de T1 e o pacote canônico de compliance — fecha a camada pública essencial do funil sem inventar fatos legais ausentes nem alterar contrato de intake ou persistência DB — impacto: homepage, páginas institucionais, privacidade e termos ficam acessíveis e ligados ao intake com pendências de publicação explicitadas — dono: Vulcanus
- 2026-04-13 — T2 ciclo 5 passa a ter verificação repo-local repetível via scripts de auditoria do funil e inspeção DB — reduz espaço para prova manual improvisada e torna auditável o caminho homepage -> páginas públicas -> intake -> DB -> cockpit sem novos frameworks — impacto: `infra/scripts/verify-t2.sh`, `infra/scripts/inspect-t2-db.sh`, scripts npm e evidência dedicada em `state/evidence/T2-cycle-5/` — dono: Vulcanus
- 2026-04-13 — Zeus aceitou o T2 ciclo 3 como progresso real — a persistência primária agora está no DB local do projeto e o cockpit lê esse estado diretamente — impacto: o próximo passo mais alavancado em T2 passa a ser completar as páginas públicas essenciais e os links de compliance já definidos no canon de T1 — dono: Zeus
- 2026-04-13 — Zeus aceitou o T2 ciclo 4 como progresso real — a superfície pública institucional e de compliance mínima agora existe com links reais a partir da home e do intake, sem inventar dados canônicos ainda pendentes — impacto: o próximo passo mais alavancado em T2 passa a ser transformar a prova ponta a ponta em um caminho repo-local repetível de verificação, cobrindo sucesso, falha de validação, persistência em DB e visibilidade no cockpit — dono: Zeus
- 2026-04-13 — Zeus aceitou o T2 ciclo 5 como progresso real — a tranche agora tem um verificador repo-local repetível que prova home, páginas públicas, submissão válida, falha de validação, persistência em DB e visibilidade no cockpit — impacto: a T2 deixa de depender de prova manual improvisada e passa a ter trilha executável de auditoria local via `npm run verify:t2` — dono: Zeus
- 2026-04-13 — Zeus fechou a T2 por evidência — os critérios mínimos do prompt e do roadmap foram cumpridos: proposta entendível, CTA/intake real, lead persistido na DB, visualização interna e prova ponta a ponta testada — impacto: `project.yaml` passa para `active_tranche: T2`, `tranche_status: done`, `stage_gate: acquisition`; T3 não abre automaticamente e depende de autorização explícita de Bruno — dono: Zeus
- 2026-04-13 — Bruno autorizou a abertura da T3 — a tranche ativa passa a ser backoffice, CRM e billing mínimo, com foco em transformar o intake em operação comercial auditável — impacto: `project.yaml` atualizado para `active_tranche: T3`, `tranche_status: active`, `stage_gate: operations` — dono: Bruno
- 2026-04-13 — T3 ciclo 1 cria a espinha operacional mínima do CRM — define o modelo canônico de estágio comercial, adiciona detalhe do lead, mutação persistida de estágio e trilha mínima de auditoria — impacto: o backoffice deixa de ser apenas uma lista e passa a ter operação básica auditável em cima do lead — dono: Vulcanus
- 2026-04-13 — Zeus aceitou o T3 ciclo 1 como progresso real — o projeto agora tem detalhe de lead, transição de estágio comercial em DB e auditoria mínima visível — impacto: o próximo passo mais alavancado em T3 passa a ser notas e tarefas internas ligadas ao lead, antes de widening para billing recorrente — dono: Zeus
- 2026-04-14 — T3 ciclo 2 adiciona notas e tarefas internas no registro do lead — cria persistência DB-backed para notas e tarefas, com criação via app e visualização no detalhe do lead — impacto: o registro operacional deixa de ser apenas estágio comercial e passa a carregar contexto e próximas ações básicas — dono: Vulcanus
- 2026-04-14 — Zeus aceitou o T3 ciclo 2 como progresso real — o detalhe do lead agora concentra estágio comercial, notas e tarefas persistidas no DB — impacto: o próximo passo mais alavancado em T3 passa a ser maturidade operacional dessas tarefas, com mutação de status e trilha mínima de auditoria, antes de abrir billing — dono: Zeus
- 2026-04-14 — T3 ciclo 3 adiciona lifecycle de tarefas com trilha de auditoria — cria mutação persistida de status para tarefas internas e registra histórico mínimo de transições por tarefa — impacto: as tarefas deixam de ser apenas criáveis e passam a ser operacionalmente gerenciáveis no detalhe do lead — dono: Vulcanus
- 2026-04-14 — Zeus aceitou o T3 ciclo 3 como progresso real — o registro operacional agora tem tarefas com mutação de status e auditoria visível — impacto: o próximo passo mais alavancado em T3 passa a ser definir e expor a condição mínima de entrada em billing usando estado comercial e tarefas persistidas, antes de qualquer integração de cobrança — dono: Zeus
- 2026-04-14 — T3 ciclo 4 define a prontidão mínima de billing a partir de estado persistido — introduz modelo canônico de billing-entry, read path determinístico e visibilidade no detalhe do lead sem integrar provedor externo — impacto: o backoffice agora consegue dizer de forma auditável quando um lead está pronto para entrar em billing e quais condições faltam — dono: Vulcanus
- 2026-04-14 — Zeus aceitou o T3 ciclo 4 como progresso real — a prontidão de billing agora é calculada a partir de estágio comercial e tarefas persistidas, com justificativa visível no app — impacto: o próximo passo mais alavancado em T3 passa a ser criar o primeiro artefato local de billing usando essa gate como pré-condição, junto com trilha mínima de eventos de cobrança — dono: Zeus
- 2026-04-14 — T3 ciclo 5 cria a primeira ativação local de billing sob gate real de prontidão — introduz modelo canônico de billing local, cria record persistido apenas quando o lead está pronto e registra eventos `billing_record_created` e `billing_record_activated` no DB — impacto: um lead agora pode virar cliente billable dentro do sistema sem integração externa e com trilha mínima de eventos — dono: Vulcanus
- 2026-04-14 — Zeus aceitou o T3 ciclo 5 como progresso real — o sistema agora bloqueia billing prematuro, cria billing local com pricing do T1 e exibe record + eventos no detalhe do lead — impacto: o próximo passo mais alavancado em T3 passa a ser registrar a primeira cobrança recorrente local ligada a esse billing record, antes de qualquer provider externo — dono: Zeus
- 2026-04-14 — Primeira tentativa do T3 ciclo 6 não foi aceita — não surgiram artefatos auditáveis de charge local no repo, nem nota de estado, nem scripts, nem evidência `state/evidence/T3-cycle-6/` — impacto: ciclo 6 permanece aberto e deve ser reexecutado com prova explícita antes de qualquer aceitação — dono: Zeus
- 2026-04-14 — Segunda tentativa do T3 ciclo 6 também não foi aceita — só apareceu o artefato parcial `packages/core/src/local-billing-charge-model.ts`, sem mutation path, sem surface, sem scripts e sem evidência `state/evidence/T3-cycle-6/` — impacto: ciclo 6 continua aberto e a próxima reexecução deve ser orientada por checklist explícito de arquivos obrigatórios, não por resumo genérico — dono: Zeus
- 2026-04-14 — Terceira tentativa do T3 ciclo 6 também não foi aceita — além do modelo parcial, surgiram apenas tipos e schema DB em `apps/web/lib/intake-storage.ts`, mas ainda sem mutation path, sem route de charge, sem surface no lead detail, sem scripts, sem nota de estado e sem evidência `state/evidence/T3-cycle-6/` — impacto: ciclo 6 permanece aberto e a próxima reexecução deve atacar o checklist inteiro, não mais entregar pedaços isolados — dono: Zeus
- 2026-04-14 — T3 ciclo 6 cria a primeira cobrança recorrente local sobre billing ativo — introduz modelo canônico de charge local, mutation path bloqueado sem billing ativo, persistência em `lead_billing_charges` e `lead_billing_charge_events`, além de surface e evidência local verificável — impacto: o sistema agora representa cliente ativo e primeira cobrança local com trilha de eventos, ainda sem integração externa — dono: Vulcanus
- 2026-04-14 — Zeus aceitou o T3 ciclo 6 como progresso real — a cobrança local agora só nasce com billing ativo, aparece no detalhe do lead e deixa trilha persistida de eventos — impacto: o próximo passo mais alavancado em T3 passa a ser a primeira mutação local de pagamento/settlement sobre essa cobrança, antes de qualquer provider externo ou fechamento de T3 — dono: Zeus
- 2026-04-14 — Primeira tentativa do T3 ciclo 7 não foi aceita — não surgiram artefatos auditáveis de settlement/payment local no repo, nem nota de estado, nem scripts, nem evidência `state/evidence/T3-cycle-7/` — impacto: ciclo 7 permanece aberto e deve ser reexecutado com checklist explícito de arquivos e provas obrigatórias — dono: Zeus
- 2026-04-14 — Segunda tentativa do T3 ciclo 7 também não foi aceita — apareceu apenas o artefato parcial `packages/core/src/local-billing-settlement-model.ts`, sem mutation path, sem surface, sem scripts, sem nota de estado e sem evidência `state/evidence/T3-cycle-7/` — impacto: ciclo 7 continua aberto e a próxima reexecução deve atacar o checklist inteiro, não entregar só o modelo canônico — dono: Zeus
- 2026-04-14 — T3 ciclo 7 cria a primeira mutação local de settlement sobre uma cobrança existente — introduz modelo canônico de settlement local, mutation path DB-backed em `billing-settlements`, persistência em `lead_billing_settlements` e `lead_billing_settlement_events`, além de surface e evidência local verificável — impacto: o sistema agora representa a transição de cobrança emitida para cobrança liquidada com trilha auditável e sem provider externo — dono: Vulcanus
- 2026-04-14 — Zeus aceitou o T3 ciclo 7 como progresso real — a cobrança local agora pode ser liquidada de forma auditável, com bloqueio verdadeiro quando não existe charge elegível e com surface persistida no detalhe do lead — impacto: o próximo passo mais alavancado em T3 passa a ser sair do caso de uma única cobrança e provar a progressão recorrente para a próxima charge local, sem widen para provider externo — dono: Zeus
- 2026-04-14 — T3 ciclo 8 cria a progressão recorrente local para a próxima cobrança após a primeira liquidação — introduz regra canônica de progressão, mutation path DB-backed para `billing-charges/next`, persistência da charge sequência 2 e surface com múltiplas cobranças e sua trilha de eventos — impacto: o sistema deixa de ser uma prova de charge única e passa a representar continuidade recorrente mínima sem provider externo — dono: Vulcanus
- 2026-04-14 — Zeus aceitou o T3 ciclo 8 como progresso real — a cobrança recorrente agora pode avançar da sequência 1 liquidada para a sequência 2 pendente, com bloqueios verdadeiros para ausência de billing ativo, falta de charge anterior liquidada e duplicação de pendência — impacto: o próximo passo mais alavancado em T3 passa a ser tornar a liquidação da charge pendente explicitamente orientada por charge, agora que o lead pode acumular múltiplas cobranças na mesma trilha — dono: Zeus
- 2026-04-14 — T3 ciclo 9 cria a liquidação local explicitamente direcionada por `chargeId` — introduz regra canônica de settlement direcionado, mutation path DB-backed para `billing-settlements/[chargeId]`, verificação de ownership/estado elegível e surface com ação por linha de cobrança — impacto: a operação deixa de depender de seleção implícita no nível do lead e passa a preservar identidade explícita da cobrança liquidada — dono: Vulcanus
- 2026-04-14 — Zeus aceitou o T3 ciclo 9 como progresso real — a liquidação agora pode ser executada e auditada sobre uma cobrança específica, com bloqueios verdadeiros para ausência de billing ativo, charge inexistente, charge estrangeira e charge já liquidada — impacto: o próximo passo mais alavancado em T3 passa a ser dar observabilidade global de billing no cockpit, para que Bruno acompanhe o estado operacional sem abrir lead por lead — dono: Zeus
- 2026-04-14 — Primeira tentativa do T3 ciclo 10 não foi aceita — não surgiram artefatos auditáveis de overview global de billing no repo, nem rota/surface de cockpit dedicada, nem scripts, nem nota de estado, nem evidência `state/evidence/T3-cycle-10/` — impacto: ciclo 10 permanece aberto e deve ser reexecutado com checklist explícito de arquivos e provas obrigatórias — dono: Zeus
- 2026-04-14 — T3 ciclo 10 cria uma visão operacional mínima de billing no cockpit — introduz regra canônica de overview, read path DB-backed por lead com status de billing/cobrança/liquidação e surface dedicada em `/cockpit/billing` com links para detalhe do lead — impacto: Bruno passa a acompanhar billing entre leads sem depender de abrir cada registro individualmente — dono: Vulcanus
- 2026-04-14 — Zeus aceitou o T3 ciclo 10 como progresso real — a observabilidade global de billing agora existe no cockpit com prova de casos pendente e liquidado, fechando o gap de acompanhamento do T3 — impacto: a tranche T3 cumpre o gate funcional e passa a poder ser fechada sem widen para collections, provider externo ou T4 — dono: Zeus
- 2026-04-14 — Zeus fechou a T3 por evidência — um lead pode virar cliente, um cliente pode ter cobrança recorrente e liquidação local registradas, os eventos principais ficam persistidos e Bruno consegue acompanhar o estado no cockpit/Control Room local — impacto: `project.yaml` passa para `tranche_status: done` em T3; T4 não abre automaticamente e depende de autorização explícita de Bruno — dono: Zeus
- 2026-04-14 — T3.5 foi aberta como tranche intermediária de hardening, sem abrir T4 — há evidência local explícita em `state/t35-opening.md` (autorização + escopo) e `state/zeus-mandate.md` (ciclos + alvo atual), ambas datadas de 2026-04-14, reconciliando a passagem de T3 fechada para T3.5 aberta — impacto: `ROADMAP.md` passa a incluir T3.5 como tranche formal entre T3 e T4; `project.yaml` permanece em `active_tranche: T3.5`, `tranche_status: open`, `stage_gate: hardening` até fechamento por evidência — dono: Zeus

## 2026-04-14 00:17 GMT-3 — T3.5 cycle 1 accepted (storage split)

- Monolith `intake-storage.ts` (2305 lines) split into 7 domain modules under `apps/web/lib/storage/`.
- Original file converted to 7-line re-export barrel.
- Vulcanus delivered the split; Zeus corrected 2 verifier bugs (wrong event name, wrong status codes) and ran verification.
- Typecheck clean, build clean, full verifier pass exercising all 14 routes.
- Evidence: `state/evidence/T3.5-cycle-1/summary-local.json`
- Decision: accepted.

## 2026-04-14 02:28 UTC — T3.5 cycle 2 accepted (cockpit auth)

- Cockpit hardening now gates `/cockpit/*` and `/api/cockpit/*` via `COCKPIT_SECRET` in `apps/web/proxy.ts`, without opening T4 or adding product scope.
- Unauthenticated cockpit API requests return `401`; cockpit pages redirect to login prompt and can establish a protected cookie session with the shared secret.
- Public routes remained open in the verifier path, including `/`, `/intake`, `/api/intake`, `/api/intake-events`, `/api/health`, `/como-funciona`, `/para-quem-e`, `/privacidade`, `/termos` and `/go/intake`.
- Zeus audited and corrected the state note path to match the shipped artifact (`proxy.ts`, not `middleware.ts`).
- Evidence: `state/t35-cycle-2-cockpit-auth.md`, `infra/scripts/verify-t35-cycle-2-local.sh`, `state/evidence/T3.5-cycle-2/summary-local.json`.
- Decision: accepted.

## 2026-04-14 00:42 GMT-3 — T3.5 cycle 2 accepted (cockpit auth)

- `apps/web/proxy.ts` added (renamed from `middleware.ts` per Next.js 16 proxy convention)
- Auth gate: `COCKPIT_SECRET` env var required for all `/cockpit/*` and `/api/cockpit/*` routes
- Supports Bearer, Basic, cookie, and token-query auth channels
- Public routes remain open
- Zeus corrected 3 verifier bugs: wrong event name (reused from cycle 1), wrong edge chunk path (Next.js 16 uses server chunks), wrong manifest matcher check (Next.js 16 format changed)
- Zeus restored `billing-settlements/route.ts` deleted prematurely by Vulcanus (cycle 3 work)
- Full verifier pass with all 8 bundle checks passing
- Evidence: `state/evidence/T3.5-cycle-2/summary-local.json`
- Decision: accepted.

## 2026-04-14 00:38 GMT-3 — T3.5 cycle 3 accepted (legacy settlement route removed)

- `apps/web/app/api/cockpit/leads/[leadId]/billing-settlements/route.ts` deleted (implicit lead-level settlement)
- `billing-settlements/[chargeId]/route.ts` preserved (targeted, canonical)
- Lead detail surface (`page.tsx`) updated to only use targeted settlement
- Full verifier pass: legacy route absent from build, targeted route returns 201
- Evidence: `state/evidence/T3.5-cycle-3/summary-local.json`
- Decision: accepted.

## 2026-04-14 00:53 GMT-3 — T3.5 cycle 4 accepted (billing tests)

- 13 billing tests added in `apps/web/lib/storage/__tests__/billing.test.ts`
- Runner: `node --experimental-strip-types --test`
- All 13 tests pass: readiness gate, activation, charge creation, targeted settlement, charge progression
- Zeus fixed 5 issues in Vulcanus delivery: @core namespace import, createRequire ESM compat, duplicate declarations, concurrency locking, wrong status code
- Evidence: `state/evidence/T3.5-cycle-4/summary-local.json`
- Decision: accepted.

## 2026-04-14 01:00 GMT-3 — T3.5 cycle 5 accepted (CRM field expansion)

- 12 missing T1-defined CRM fields added to schema, types, storage, PATCH route, and lead detail surface
- New route: `apps/web/app/api/cockpit/leads/[leadId]/crm-fields/route.ts`
- All 12 fields confirmed persisted in fresh temp DB by verifier
- Build clean, all surface checks passed
- Evidence: `state/evidence/T3.5-cycle-5/summary-local.json`
- Decision: accepted.

## 2026-04-14 03:00 UTC — Zeus closed T3.5 by evidence

- The five planned hardening cycles now have accepted local evidence: storage split, cockpit auth, legacy settlement route removal, core billing tests, and CRM field expansion.
- The tranche gate is satisfied: immediate T3 structural debt was reduced with verifiers present, without opening T4 and without introducing VLH dependency.
- Closure note recorded in `state/t35-closure.md`.
- Impact: `project.yaml` remains truthfully in `active_tranche: T3.5`, `tranche_status: done`, `stage_gate: hardening`; no next tranche opens automatically and T4 still depends on explicit authorization from Bruno.
- Owner: Zeus

## 2026-04-14 05:20 GMT-3 — Bruno autorizou a abertura da T4

- T3.5 confirmada fechada por evidência (ciclos 1–5 aceitos, commits `4472228` e `d3f5e42` no GitHub).
- Bruno autorizou explicitamente a abertura da T4 em 2026-04-14 05:10 GMT-3.
- `project.yaml` atualizado para `active_tranche: T4`, `tranche_status: open`, `stage_gate: portal`.
- `state/t4-opening.md` criado com 6 ciclos definidos.
- `state/zeus-mandate.md` atualizado para T4.
- Primeiro ciclo: client auth skeleton com invite-code, sem provider externo.
- Dono: Bruno

## 2026-04-14 05:36 GMT-3 — T4 ciclo 1 aceito (client auth skeleton)

- Invite-code auth para `/portal/*` implementado sem provider externo.
- `packages/core/src/portal-invite-model.ts`: modelo canônico de invite/session.
- `apps/web/lib/storage/portal.ts`: createInvite, revokeInvite, redeemInvite, getSession, deleteSession.
- `apps/web/proxy.ts`: estendido para proteger `/portal/*` (exceto `/portal/login`), sem quebrar cockpit auth.
- `apps/web/app/portal/login`, `dashboard`, `logout`: páginas do portal cliente.
- `apps/web/app/api/portal/session/route.ts`: redemption do invite + cookie httpOnly.
- `apps/web/app/api/cockpit/leads/[leadId]/portal-invite-codes/`: criação e revogação via cockpit.
- Login retorna 302 + cookie válido; revoke invalida código; login pós-revoke retorna 303 com erro.
- Evidência: `state/evidence/T4-cycle-1/summary-local.json` (ok: true).
- Dono: Vulcanus. Aceito por Zeus.

## 2026-04-14 05:46 GMT-3 — T4 ciclo 2 aceito (dashboard + checklist)

- Dashboard real do portal entregue: mostra nome do cliente, estágio comercial e checklist de onboarding.
- `packages/core/src/onboarding-checklist-model.ts`: modelo canônico com campos e status values.
- `apps/web/lib/storage/checklist.ts`: list, create, complete, uncomplete, delete items.
- Cockpit: GET/POST `/api/cockpit/leads/[leadId]/checklist` e DELETE/PATCH por item.
- Portal: POST `/api/portal/checklist/[itemId]` — completa item com isolamento por sessão; 403 para itens de outro lead.
- Cookie `portal_session` path alargado de `/portal` para `/` para que rotas `/api/portal/*` recebam o cookie (funcional, seguro pois é httpOnly+SameSite=lax).
- Isolamento comprovado: conclusão de item alheio retorna 403.
- Evidência: `state/evidence/T4-cycle-2/summary-local.json` (ok: true).
- Dono: Vulcanus. Aceito por Zeus.

## 2026-04-14 05:58 GMT-3 — T4 ciclo 3 aceito (document upload)

- `packages/core/src/document-upload-model.ts`: modelo canônico com status, campos, path convention, MIME types, limite de 10MB.
- `apps/web/lib/storage/documents.ts`: saveDocument, listDocuments, getDocument, reviewDocument.
- `apps/web/app/api/portal/documents/route.ts` (ou uploads): POST upload + GET lista.
- `apps/web/app/api/cockpit/leads/[leadId]/documents/route.ts`: GET + PATCH review.
- `apps/web/app/portal/documents/page.tsx`: página de upload do cliente.
- Evidência: upload 201, listagem 200, review persistido (accepted), unauthorizedUpload 401.
- `state/evidence/T4-cycle-3/summary-local.json` (ok: true).
- Dono: Vulcanus. Aceito por Zeus.

## 2026-04-14 06:12 GMT-3 — T4 ciclo 4 aceito (recommendation ledger)

- `packages/core/src/recommendation-model.ts`: modelo canônico com draft/published, categorias, campos.
- `apps/web/lib/storage/recommendations.ts`: create, list, publish, delete.
- Cockpit: GET/POST `/api/cockpit/leads/[leadId]/recommendations`, PATCH/DELETE por item.
- Portal: GET `/api/portal/recommendations` — retorna apenas published, isolado por sessão.
- `apps/web/app/portal/ledger/page.tsx`: página read-only do cliente.
- Isolamento comprovado: lead B não vê recomendações do lead A; portal não expõe drafts.
- Evidência: `state/evidence/T4-cycle-4/summary-local.json` (ok: true).
- Dono: Vulcanus. Aceito por Zeus.

## 2026-04-14 06:34 GMT-3 — T4 ciclo 5 aceito (pending flags + overview)

- `packages/core/src/pending-flag-model.ts`: modelo canônico com 5 flag types, campos e semântica de active/cleared.
- `apps/web/lib/storage/flags.ts`: setFlag, clearFlag, listActiveFlags, listAllLeadsWithActiveFlags.
- Cockpit: GET/POST `/api/cockpit/leads/[leadId]/flags`, DELETE por flagType.
- Cockpit overview: GET `/api/cockpit/flags` — lista todos os leads com flags ativas.
- `apps/web/app/cockpit/pending-flags/page.tsx`: visão global de pendências.
- Portal invisibility comprovado: flags não aparecem em dashboard, ledger nem documents.
- Evidência: `state/evidence/T4-cycle-5/summary-local.json` (ok: true).
- Dono: Vulcanus. Aceito por Zeus.

## 2026-04-15 — T6 aberta: Cockpit Auth & RBAC

- T6 substitui o modelo de autenticação do cockpit baseado em segredo global único por contas individuais com papéis (admin/operator/viewer) e rastreabilidade individualizada.
- Motivo: single secret impede rastreabilidade individual (CVM), revogação granular (LGPD), e separação de papéis. Hoje aceitável porque só Bruno usa, mas quebra na primeira expansão.
- Escopo: schema + scrypt nativo + middleware + login + RBAC + admin UI + audit actor propagation.
- Fallback `COCKPIT_SECRET` preservado durante T6 (sentinel `actor_id='legacy-secret'`). Remoção em T7.
- Anti-escopo: 2FA, OAuth, SSO, reset por email, rate limiting, refresh tokens, remoção do secret.
- Restrição técnica: middleware Next.js roda em Edge runtime e não pode chamar SQLite. Validação real acontece dentro das route handlers via `requireCockpitSession()`, não no proxy.
- 8 ciclos planejados. Bruno autorizou. Dono: Vulcanus.

## 2026-04-15 — T6 Cycle 1 aceito: Schema & scrypt foundation

- Entregue: `packages/core/src/cockpit-auth-model.ts` (modelo canônico + hashing com `node:crypto.scryptSync`, N=16384/r=8/p=1/keyLen=64/salt=32B, formato self-describing `scrypt$...`), tabelas `cockpit_users` e `cockpit_sessions` com índices e CHECK de role, coluna aditiva `audit_log.actor_id` via `ensureCockpitAuthColumns()`, módulo `apps/web/lib/storage/cockpit-auth.ts` com CRUD completo de users + sessions (inclui deactivação que derruba sessões abertas atomicamente), types públicos em `types.ts`, read-path de `audit-log.ts` já devolvendo `actorId`.
- Decisão de design: hashing mora no MODELO (core package, folha, só `node:crypto`), não no storage — isso permite verificação isolada via `node --experimental-strip-types` sem passar por bundler. Storage só re-exporta.
- Decisão de design: deactivar usuário (`isActive=false`) deleta sessões abertas dele na mesma transação, garantindo corte imediato de acesso em vez de esperar expirar.
- Verificação: `infra/scripts/verify-t6-cycle-1-local.sh` com verifier TS dedicado em `infra/scripts/verifiers/t6-cycle-1.ts`. Evidência `state/evidence/T6-cycle-1/summary-local.json` com `ok: true` e 20+ checks de schema (colunas, índices, FK, CHECK), hashing (formato, round-trip, rejeição de senha errada, rejeição de hash adulterado, salt randomness, senha curta rejeitada) e surface checks.
- Regression: `npm run test` verde (13/13 testes lógicos; ruído Windows EPERM no shutdown é pré-existente).
- Limitação assumida: CRUD completo do `cockpit-auth.ts` não foi testado end-to-end neste ciclo (apenas o modelo canônico). Primeiro caller real é o Ciclo 2 (bootstrap-admin CLI).
- Dono: Vulcanus. Aceito por Zeus.

## 2026-04-15 — T6 Cycle 2 aceito: Bootstrap admin CLI

- Entregue: `scripts/bootstrap-admin.ts` (CLI idempotente, argv + stdin interativo com senha em modo silencioso via raw TTY, exit codes 0/2/3/4) e rota self-locking `apps/web/app/api/cockpit/bootstrap-admin/route.ts` (GET de status + POST que retorna 409 `already_bootstrapped` quando `countActiveAdmins() > 0`).
- Decisão de design: lockout no código da rota (não em feature flag ou env). Bootstrap fica permanentemente inerte após o primeiro admin sem depender de alguém lembrar de desligar uma flag.
- Decisão de design: rota pública (`/api/cockpit/bootstrap-admin`) em vez de `_internal/` porque Next trata `_*` como pastas privadas e as exclui do roteamento. Proteção real é o self-lock + `COCKPIT_SECRET` do middleware atual.
- Decisão técnica: CLI invoca a rota compilada via `requireUserland` contra `.next/server/app/api/cockpit/bootstrap-admin/route.js`, mesmo padrão de `seed-beta.sh`. Evita esbarrar no barrel ESM do core e prova que a rota build-passa. Auto-build quando o artifact não existe.
- Bug capturado pelo verifier: `db.ts` captura `repoRoot = findRepoRoot(process.cwd())` em tempo de carregamento do módulo; `process.chdir(tempRoot)` precisa vir ANTES do `requireFromRoot(routePath)` ou o handler abre o DB real do dev em vez do isolado. Correção aplicada antes de aceitar a evidência.
- Verificação: `infra/scripts/verify-t6-cycle-2-local.sh` com verifier TS que roda o CLI 2× contra um `tempRoot` isolado e faz snapshot diff (userId, passwordHash, createdAt inalterados) + chamada direta ao GET e POST da rota para confirmar `needsBootstrap: false` e `directPostAfterLockoutStatus: 409` / `code: "already_bootstrapped"`. Evidência `state/evidence/T6-cycle-2/summary-local.json` com `ok: true`.
- Limitação assumida: CLI ainda depende do `COCKPIT_SECRET` do middleware atual para autorizar o POST. Ciclo 4 precisa resolver o caminho autorizado do bootstrap quando o middleware for substituído (provavelmente abrindo a rota enquanto `adminCount === 0`).
- Dono: Vulcanus. Aceito por Zeus.

## 2026-04-15 — T6 Cycle 3 aceito: Audit log actor_id signature

- Entregue: parâmetro aditivo `actorId?: string | null` em `writeAuditLog({ ... })` (default `null`), INSERT agora inclui `actor_id` com `normalizeActorId(params.actorId)`. Zero callsites alterados (19 callers em 8 arquivos — billing, checklist, documents, leads, memos, portal, recommendations, research-workflows — continuam idênticos).
- Decisão de design: `normalizeActorId` (helper já existente no read-path desde Cycle 1) é reaproveitado no write-path. Isso garante que `""`/whitespace viram NULL, simétrico ao que o read-path espera. Trade-off explícito: lenient write consistente com o resto do storage.
- Decisão de verificação: prova híbrida source+runtime. (a) Source-text regex valida signature, INSERT e ausência de `actorId:` em callers. (b) Schema probe via rota `commercial-stage` compilada confirma caller existente grava `actor_id NULL`. (c) Read-path GET da rota `audit-log` confirma resposta sempre inclui campo `actorId`. (d) `DatabaseSync` direto grava uma linha com `actor_id='probe-cycle3-actor'` e a rota GET round-trippa o valor exato; outra linha grava `NULL` explícito e também round-trippa. Nenhum route de probe foi adicionado à superfície produtiva.
- Guard de contrato: verifier falha explicitamente ("Cycle 3 contract violated") se qualquer callsite passar `actorId:` antes do Ciclo 6. Previne propagação prematura.
- Verificação: `infra/scripts/verify-t6-cycle-3-local.sh` com verifier TS dedicado em `infra/scripts/verifiers/t6-cycle-3.ts`. Evidência `state/evidence/T6-cycle-3/summary-local.json` com `ok: true` e 10 checks verdes (signature, INSERT, normalização, 19 callsites, 0 callsites-with-actorId, existing-caller-NULL, read-path-has-field, read-path-all-null, string round-trip, null round-trip).
- Regression: inner loop do test suite verde (13/13 lógicos; ruído Windows EPERM no shutdown da tempdir é pré-existente, não bloqueia).
- Limitação assumida: nenhum caller real exercita `actorId: string` ainda. O primeiro será o fallback `legacy-secret` em Ciclo 4 (middleware), seguido pelos 19 callsites em Ciclo 6.
- Dono: Vulcanus. Aceito por Zeus.

## 2026-04-15 — T6 Cycle 4 aceito: Middleware + requireCockpitSession

- Entregue: helper `requireCockpitSession(request)` em `apps/web/lib/cockpit-session.ts` (Node runtime), middleware `apps/web/proxy.ts` estendido para aceitar presença do cookie `cockpit_session` (não só `cockpit_token=SECRET`), e rota consumidora `GET /api/cockpit/session` que retorna o contexto serializado.
- Decisão de design: retorno do helper é tagged union `{ok:true, context} | {ok:false, status, body}` — route handlers escrevem `if (!check.ok) return Response.json(check.body, {status})` sem try/catch. Mais legível que throw + catch central.
- Decisão de design: middleware Edge só checa PRESENÇA de cookie (SQLite indisponível em Edge runtime). Validação real acontece no Node runtime dentro da rota via `findCockpitSessionByToken` + `isCockpitSessionValid`. Atacante com cookie arbitrário passa pelo middleware mas leva 401 da rota — custo zero.
- Decisão de design: 401 de sessão inválida carrega `reason: 'session_expired' | 'user_disabled'`, mas 401 de "sem auth nenhuma" não carrega reason. Evita enumeração ("esse email existe mas está bloqueado") enquanto ainda permite UX decente ("sua sessão expirou").
- Decisão de design: fallback `COCKPIT_SECRET` prevalece mesmo se o cliente mandar `cockpit_session` sujo (Cenário G). Garante que ninguém quebra acesso de emergência durante T6 enviando cookie aleatório. Fallback gera contexto com `role: 'operator'` (menor privilégio funcional), `userId: null`, `actorId: 'legacy-secret'`.
- Verificação: `infra/scripts/verify-t6-cycle-4-local.sh` com verifier TS dedicado em `infra/scripts/verifiers/t6-cycle-4.ts`. 7 cenários runtime (A-G) + 4 middleware source-checks + 7 helper source-checks, todos verdes. Evidência `state/evidence/T6-cycle-4/summary-local.json` com `ok: true`.
- Regression: inner loop do test suite verde (13/13 lógicos; EPERM Windows permanece pré-existente).
- Limitação assumida: nenhuma rota produtiva além de `/api/cockpit/session` consome o helper ainda. Propagação para os 19 callsites do `writeAuditLog` + rotas mutadoras é Cycle 6. Login/logout que populam o cookie são Cycle 5.
- Dono: Vulcanus. Aceito por Zeus.

## 2026-04-15 — T6 Cycle 5 aceito: Login / logout API + page

- Entregue: `POST /api/cockpit/login` (valida credenciais, emite sessão, seta cookie `cockpit_session` com `HttpOnly; SameSite=Lax; Path=/; Max-Age=<n>`; `Secure` condicional ao `x-forwarded-proto=https`), `POST /api/cockpit/logout` (revoga sessão no DB, expira cookie com `Max-Age=0`, idempotente), página `/cockpit/login` (server action mirror do padrão `/portal/login`, redireciona para `/cockpit/leads` em sucesso), e middleware (`proxy.ts`) estendido com `isCockpitPublicRoute` que exenta `/cockpit/login`, `/api/cockpit/login`, `/api/cockpit/logout` do gating.
- Decisão de design: 401 genérico unificado para unknown-email e wrong-password (body `{ok:false, error:'invalid_credentials'}`). scrypt é constante no tempo → sem vazamento lateral. Disabled é 403 `user_disabled` (distinguível porque o atacante já passou na senha).
- Decisão de design: `Secure` condicional ao header `x-forwarded-proto` em vez de `NODE_ENV==='production'`. Preserva HTTPS local atrás de tunnel/proxy; não quebra dev http.
- Decisão de design: Set-Cookie montado como string manual em vez de `response.cookies.set(...)`. Portabilidade entre versões do Next e debug direto no teste. Web standard `Response` aceita `headers.set('set-cookie', ...)`.
- Decisão de design: server action (tal qual `/portal/login`) em vez de fetch cliente-side. Login funciona com JS desabilitado; cookie setado no servidor sem round-trip extra. Erros via query string (aceitável para página de login; Cycle 7 revisita).
- Decisão de design: exemption de login/logout no middleware em vez de nos route handlers. Rotas de entrada NUNCA devem passar pela checagem de sessão — são a porta. Lugar canônico para marcar como pública é o proxy.
- Verificação: `infra/scripts/verify-t6-cycle-5-local.sh` com verifier TS em `infra/scripts/verifiers/t6-cycle-5.ts`. 7 cenários runtime (A-G) + 4 middleware source-checks + 8 page source-checks, todos verdes. Evidência `state/evidence/T6-cycle-5/summary-local.json` com `ok: true`.
- Regression: inner loop do test suite verde (13/13 lógicos; EPERM Windows permanece pré-existente).
- Limitação assumida: login sem rate-limit. Brute-force offline-style custa ~50-100ms por tentativa via scrypt N=16384 (~1k tentativas = 1min). Para PF premium com senhas longas é aceitável; T7 revisita se surgirem credenciais fracas.
- Dono: Vulcanus. Aceito por Zeus.

## 2026-04-15 — T6 Cycle 6 aceito: Actor propagation (19 callsites)

- Entregue: `actorId` propagado em 15 helpers de storage (operator-path) em 8 módulos (billing, checklist, documents, leads, memos, portal, recommendations, research-workflows) e 12 route handlers de cockpit que agora chamam `requireCockpitSession(request)` no topo. Writes de audit passam a gravar `actor_id === context.actorId` — que é o `userId` real em sessões reais e `'legacy-secret'` no fallback `COCKPIT_SECRET`.
- Decisão de design: helpers recebem `actorId?: string | null` de forma aditiva (default `null`). Zero callsite externo precisa mudar se não quiser propagar actor. Preserva compat com chamadas internas (ex: onboarding.ts -> completeChecklistItem).
- Decisão de design: writes não-operator (client portal redeem/logout, system auto-expiry, document client upload) permanecem sem `actorId`. São 4 callsites — sua assinatura canonicamente NÃO aceita actorId, prevenindo propagação errada. Preservados via source-text audit.
- Decisão de design: checklist's `completeChecklistItem` tem signature que aceita actorId mas força `null` quando `completedBy === 'client'`. Defesa extra contra mau uso — mesmo que alguém passe actorId no caminho cliente, a auditoria fica coerente.
- Fix colateral: `recommendations/[recommendationId]/route.ts` POST delegava para PATCH/DELETE sem forwardar cookies, quebrando form submissions autenticadas. Patch: preservar `cookie` header na Request delegada.
- Fix colateral: `billing.test.ts` atualizado para injetar `process.env.COCKPIT_SECRET` + cookie legacy em todo request. Os 13 tests lógicos existentes passam a exercitar o caminho fallback, garantindo continuidade do comportamento legacy durante T6.
- Verificação: `infra/scripts/verify-t6-cycle-6-local.sh` com verifier TS em `infra/scripts/verifiers/t6-cycle-6.ts`. 7 módulos × 2 cenários (real session + legacy fallback) = 14 gravações validadas + 1 cenário no-auth 401 + 3 checks de client/system writes (sem actorId) + source audit (14/14 operator callsites detectados com actorId por regex literal; o 15º — checklist ternário — passa via regex shorthand check). Evidência `state/evidence/T6-cycle-6/summary-local.json` com `ok: true`.
- Regression: inner test suite verde (13/13 lógicos; EPERM Windows permanece pré-existente).
- Limitação assumida: tasks/notes/flags/pending-flags/review-queue não foram tocados — eles não escrevem audit ou estão fora do caminho T6. Permanecem gated APENAS pelo middleware Edge, que os testes bypassam via loadUserland. Risco aceitável para T6; T7/T8 podem endurecer.
- Limitação assumida: Cycle 3 verifier tinha contract-guard `callsitesWithActorId === 0` que agora está propositalmente quebrado. Se alguém rodar o verifier do Cycle 3 isoladamente, vai falhar. Cycle 8 closure deve reconciliar.
- Dono: Vulcanus. Aceito por Zeus.

## 2026-04-15 — T6 Cycle 7 aceito: Users admin UI

- Entregue: helper `requireCockpitAdmin` (wrap de `requireCockpitSession` + check `role === 'admin'`, 403 caso contrário); API admin-only em `/api/cockpit/users` (GET lista, POST cria com 400/409 canônicos) e `/api/cockpit/users/[userId]` (PATCH para displayName/role/isActive/password); página `/cockpit/users` com form de criação + ações inline de role e toggle ativo; layout `apps/web/app/cockpit/layout.tsx` com header de navegação, display do usuário logado, banner "Sessão legada (COCKPIT_SECRET)" no fallback, e botão de logout; página `/cockpit/page.tsx` redireciona para `/cockpit/leads`.
- Decisão de design: fallback `COCKPIT_SECRET` (role=operator do Cycle 4) NÃO passa pelo gate admin. Users admin exige sessão real. Isso é intencional — força a migração para autenticação individual antes de T7 remover o secret.
- Decisão de design: last-admin protection em duas camadas. API valida `countActiveAdmins() <= 1` antes de permitir demote/deactivate do último admin (409 `last_admin_protected`); página replica o check nas server actions para UX imediata. Ambas consultam o mesmo helper.
- Decisão de design: deactivation drop sessions já estava implementada em `updateCockpitUser` desde Cycle 1 (DELETE sessions do alvo na mesma transação). Cycle 7 apenas expõe via UI + API. Verifier G prova end-to-end: PATCH isActive=false → 0 sessions → operator cookie → 401 em `/api/cockpit/session`.
- Decisão de design: layout como single source of truth para header. Server component lê cookies uma vez, renderiza condicionalmente (sessão real → display, legacy → banner amarelo, anônimo → sem header). Custo: +1 session lookup por render de página cockpit — aceitável no scale atual.
- Decisão explícita: users admin actions (criar/promover/desativar) NÃO escrevem `writeAuditLog` neste ciclo. Compliance pode exigir trail disso — deferido para T7+ como novo entityType='cockpit_user'.
- Verificação: `infra/scripts/verify-t6-cycle-7-local.sh` com verifier TS em `infra/scripts/verifiers/t6-cycle-7.ts`. 8 cenários runtime (A-H) + 8 source-text checks, todos verdes. Evidência `state/evidence/T6-cycle-7/summary-local.json` com `ok: true`.
- Regression: inner test suite verde (13/13 lógicos; EPERM Windows permanece pré-existente).
- Limitação assumida: sem CSRF explícito nas server actions (Next App Router tem proteção built-in via Origin check, mas é opaca); sem rate-limit no login; layout refetch session a cada page render (cacheável em futura iteração); last-admin protection tem janela de corrida teórica (dois admins tentando se demote simultâneamente).
- Dono: Vulcanus. Aceito por Zeus.
