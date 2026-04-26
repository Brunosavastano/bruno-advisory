# Session Handoff — Savastano Advisory
**Data:** 2026-04-26
**Propósito:** continuar trabalho do projeto em uma nova sessão sem perder contexto.

---

## TL;DR para a próxima sessão

A Savastano Advisory está **operacional em produção** em `https://savastanoadvisory.com.br`. O V1 está completo: site público, cockpit admin com RBAC, portal do cliente com convites, billing local, compliance preenchido e auditado, backup automático.

A próxima fase é **transformar a plataforma em AI-native** seguindo o brief v2 em `C:\Users\bruno\Downloads\claude-opus-47-ai-implementation-brief-v2.md`. A primeira tranche é **AI-0 (hardening residual)** que precisa fechar 9 rotas do cockpit ainda sem auth + corrigir 3 risks documentados antes de qualquer LLM entrar no projeto.

**Repo principal:** `C:\Users\bruno\Desktop\bruno-advisory` (não confundir com worktrees em `.claude/worktrees/`).

---

## Estado em produção

### Site
- **URL:** https://savastanoadvisory.com.br
- **Domínio:** registrado no Registro.br, ativo
- **HTTPS:** Caddy + Let's Encrypt (auto-renew)
- **Brand:** Savastano Advisory (nome fantasia de Bruno Barreto Mesiano Savastano, CVM 004503-0)

### Servidor
- **VPS:** Contabo, IP `212.90.121.236`
- **OS:** Ubuntu (já tinha LexBase rodando lá, convivem sem conflito)
- **Acesso:** `ssh root@212.90.121.236` (senha em poder de Bruno)
- **Diretório do projeto:** `/home/savastano-advisory`

### Containers
```
docker ps --filter "name=savastano"
```
- `savastano-advisory-app` — Next.js standalone, porta 3000 interna
- `savastano-advisory-caddy` — reverse proxy, portas 80/443

Outros containers no servidor (LexBase, NÃO TOCAR):
- `lexbase-postgres`
- `lexbase-redis`

### Volumes Docker
- `savastano-advisory-data` — SQLite + uploads (em `/data` dentro do container)
- `savastano-advisory-caddy-data` — certificados TLS
- `savastano-advisory-caddy-config`

### Credenciais
- **COCKPIT_SECRET:** `84d9b7adb2d1cfcb6dbfbe526e0aab9cb9f689d90229ffb916c1fbc30fea2d7a` (em `/home/savastano-advisory/.env` no servidor)
- **Admin login:** `brunobmsavastano@gmail.com` (senha definida por Bruno via bootstrap)
- **APP_BASE_URL:** `https://savastanoadvisory.com.br`

### Backup
- **Cron:** todo dia 3h da manhã
- **Comando:** `docker cp savastano-advisory-app:/data/savastano-advisory.sqlite3 /root/backups/savastano-advisory-$(date +%Y%m%d).sqlite3`
- **Local:** `/root/backups/` no servidor

---

## Comandos operacionais úteis

### Deploy de uma atualização
```bash
ssh root@212.90.121.236
cd /home/savastano-advisory
git pull
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
```

### Ver logs do app
```bash
docker logs savastano-advisory-app --tail 50
```

### Bootstrap de novo admin (se precisar)
```bash
docker exec savastano-advisory-app wget -qO- \
  --header="Content-Type: application/json" \
  --header="Cookie: cockpit_token=84d9b7adb2d1cfcb6dbfbe526e0aab9cb9f689d90229ffb916c1fbc30fea2d7a" \
  --post-data='{"email":"EMAIL","displayName":"NOME","password":"SENHA"}' \
  http://CONTAINER_HOSTNAME:3000/api/cockpit/bootstrap-admin
```
**Nota:** `CONTAINER_HOSTNAME` aparece em `docker logs savastano-advisory-app` (formato: `77b7fa4b21f7` ou similar). NÃO use `localhost` — não funciona dentro do container.
**Nota 2:** A rota `bootstrap-admin` é self-locking — bloqueia novos admins quando já existe pelo menos 1 admin ativo (retorna 409 `already_bootstrapped`).

### Listar leads via SQLite no container
```bash
docker exec savastano-advisory-app sh -c "node -e \"const db=require('node:sqlite').DatabaseSync; const d=new db('/data/savastano-advisory.sqlite3'); console.log(d.prepare('SELECT lead_id,full_name,email FROM intake_leads').all())\""
```

---

## Tranches completadas nesta sessão

### Pré-sessão (já estavam fechadas)
- T0–T5: fundação até beta
- T6: Cockpit Auth & RBAC (8 ciclos, commit `3e776d5`)

### Nesta sessão
| Tranche | Commit | O que entregou |
|---|---|---|
| T7 — Rebrand + Compliance | `b545f0c` | Bruno Advisory → Savastano Advisory em todas as superfícies; 17 placeholders preenchidos; 4 blocos instrucionais fechados; 29/29 itens de checklist verificados |
| T8 (renumerada — PG deferida) — Deploy | `798598d` | Dockerfile + docker-compose + Caddy + DNS + HTTPS + primeira ida ao ar |
| T9 — Redesign visual | (várias commits) | Brasão Savastano; paleta burgundy/dourado/preto/pergaminho; Cormorant Garamond + Crimson Pro; nova landing; página /sobre com CV e foto P&B; otimização de imagens (WebP, 4.7MB→194KB) |

### Decisões importantes registradas

1. **PostgreSQL migration deferida para V2** (`58756e4`).
   Triggers documentados em `project.yaml` seção `deferred.postgres_migration`:
   - Segundo operador adicionado
   - Contagem de clientes > 20
   - Necessidade de escala horizontal
   - Erros de concurrent write observados
   Plano técnico preservado em `docs/postgres-migration.md` (9 passos, 24 tabelas, zero código).

2. **Brand decision: Savastano Advisory.**
   Aprovado no INPI classes 35 e 36. Decisão pessoal do Bruno (Áxia foi cogitado mas descartado).

3. **E-mail = Gmail pessoal** (`brunobmsavastano@gmail.com`).
   Workspace/Zoho/Cloudflare Routing foram avaliados mas descartados pela complexidade. Para V1 com poucos clientes, Gmail pessoal serve. Trigger para mudar: separar formal/pessoal quando volume justificar.

4. **COCKPIT_SECRET fallback ainda ativo.** AI-0 vai endurecer mas não remover ainda. Remoção definitiva em tranche futura (AI-7+ ou tranche dedicada).

5. **SQLite em produção é deliberado.** Ver triggers de migração acima.

6. **Cookie/analytics: Plausible self-hosted** (configurado no compliance, ainda não implementado em código). Sem Google Analytics, sem cookies.

---

## Identidade visual (referência)

- **Cor principal:** burgundy `#8B1A1A`
- **Acento:** dourado `#C5A55A` (e variações)
- **Fundo:** preto `#0D0D0D` / charcoal `#1A1A1A`
- **Texto:** cream `#F5F0E8` / `#D4CFC7`
- **Fontes:**
  - Display: Cormorant Garamond (serif clássico)
  - Body: Crimson Pro (serif legível)
  - UI/labels: DM Sans (sans-serif)
- **Logo/brasão:** `apps/web/public/brasao-lg.webp` (170KB) e `brasao-sm.webp` (5KB)
- **Foto Bruno:** `apps/web/public/bruno-foto-opt.webp` (19KB, P&B)

---

## Roadmap remanescente — AI-Native Layer

**Brief canônico:** `C:\Users\bruno\Downloads\claude-opus-47-ai-implementation-brief-v2.md`

### As 12 tranches do brief v2 (ordem obrigatória)

1. **AI-0** — Hardening residual de auth, middleware e intake.
2. **AI-1** — LLM gateway, auditabilidade, cost tracking, budget caps, model versioning.
3. **AI-2** — Copiloto interno para memos/research workflows + UX mobile de aprovação.
4. **AI-2.5** — Email automation com classificação e drafts aprováveis.
5. **AI-3** — Suitability digital.
6. **AI-4** — Portfolio X-Ray com parsers brasileiros (B3 CEI, XP, BTG, Itaú, Bradesco, Inter).
7. **AI-4.5** — PDFs e artefatos client-facing.
8. **AI-5** — Recommendation Ledger v2 + Compliance Gate.
9. **AI-6** — Portal Copilot privado com RAG real e anti-hallucination.
10. **AI-6.5** — WhatsApp como canal do Portal Copilot.
11. **AI-7** — Chatbot público educacional + agendamento.
12. **AI-8** — Marketing Cockpit.

### Princípios obrigatórios (ler antes de qualquer ciclo)

1. IA não recomenda diretamente ao cliente sem revisão humana.
2. IA não substitui suitability.
3. IA não publica recomendação final.
4. IA pode gerar rascunho, resumo, classificação, explicação, alerta, análise preparatória.
5. Cálculos financeiros devem ser determinísticos, NUNCA inferidos pelo LLM.
6. Todo output sensível tem log de prompt/template, modelo, versão, tokens, custo, latência, hashes, usuário, data, artefato, decisão humana.
7. Chatbot público é educacional e de triagem — nunca consultoria individualizada.
8. Chatbot privado responde com base em fontes aprovadas via RAG.
9. Artefatos client-facing exigem grounding (claims com `source_id`).
10. Compliance checker bloqueia promessa de retorno, minimização de risco, recomendação sem suitability vigente.
11. Toda decisão automatizada que afete o cliente tem canal de revisão humana.
12. Sistema mensurável financeiramente: cada job registra custo + budget caps.

---

## Gaps específicos do brief v2 (meus 10 pontos identificados)

Cada gap se encaixa naturalmente em um ciclo específico. Não bloqueiam adoção do brief — são refinamentos a incluir nos ciclos.

### 1. Streaming não foi mencionado → **AI-1 Cycle 2**
Para chatbots (público, portal, WhatsApp), streaming SSE/chunked é UX obrigatório. Sem streaming, cliente espera 8s vendo loader. Adicionar à camada de gateway.

### 2. Rate limiting está como aspiração, não como schema → **AI-7 Cycle 1**
AI-7 critério diz "rate limit existe" mas sem tabela ou pattern. Para chatbot público precisa: per-IP (anti-bot), per-session (anti-abuse), per-day-global (cost cap). Schema mínimo: `ai_rate_limit_events(scope_type, scope_value, count, window_start)`.

### 3. Política de fallback/retry → **AI-1 Cycle 3**
O que acontece se Anthropic ficar fora 10min? Retry com backoff exponencial? Fallback para outro provider? Ou aceita degradação graceful? AI-1 Cycle 3 (guardrails + redaction) é o lugar.

### 4. Suitability não cita CVM Resolução 30 → **AI-3 Cycle 1**
AI-3 lista seções genéricas ("objetivos", "horizonte") mas não mapeia perguntas obrigatórias da Resolução. Cada seção do questionário deveria ter `regulatory_reference: 'CVM-Res-30/2021-Art-5-IV'` ou similar. Sem isso, defensibilidade regulatória fica comprometida.

### 5. Tributação ausente nas métricas de portfolio → **AI-4 Cycle 2**
AI-4 lista métricas técnicas mas pula: alocação por regime tributário (isento vs RF vs RV), IR diferido por ativo, exposição cambial efetiva, risco-Brasil concentration. Para PF premium brasileiro, tributação é central na decisão.

### 6. `risk_disclosure TEXT` no recommendation ledger → **AI-5 Cycle 1**
Deveria ser JSON estruturado: `{liquidez, credito, mercado, concentracao, cambial, tributario, regulatorio}`. Texto livre não é auditável uniformemente em compliance review.

### 7. Email com attachment loop não está mapeado → **AI-2.5 Cycle 3**
AI-2.5 trata e-mail mas não fala: se vier PDF anexo, ele vira `lead_documents` automaticamente? Vai pro portfolio parser? O fluxo end-to-end (email recebido com extrato → document upload → portfolio parser → suitability comparison) fica solto.

### 8. Retention dos artefatos de IA não está mapeada → **AI-1 Cycle 1**
`COMPLIANCE_PACKAGE.md` define retention: 5 anos para cliente, 2 para leads, 5 para audit. Mas quais regras valem para `ai_artifacts`, `ai_messages`, `ai_jobs`? Bloqueados por guardrail seguem qual TTL? Adicionar mapping explícito ao schema.

### 9. Observabilidade externa não tem seção → **AI-1 Cycle 3**
Erros, latência, custo deveriam ir para Sentry/Datadog/Logflare. Sem isso, debugging em produção depende de SSH + grep no log. Para uma plataforma que cobra cliente real, é insuficiente.

### 10. UX de "não posso responder" no Portal Copilot → **AI-6 Cycle 1**
Quando classifier retorna `new_recommendation_request`, qual é a resposta canônica? "Sua pergunta exige análise individualizada, abri uma tarefa para o consultor revisar." Deveria ser template codificado, não improvisado pelo LLM. Mesma coisa para `unsupported_or_high_risk`, `suitability_update_needed`.

---

## AI-0 Cycle 1 — escopo exato para começar

### Rotas que ainda precisam de `requireCockpitSession()`
Confirmadas pela inspeção pós-T6 Cycle 6:

- `GET /api/cockpit/review-queue`
- `POST /api/cockpit/leads/[leadId]/recommendations`
- `GET /api/cockpit/leads/[leadId]/memos`
- `POST /api/cockpit/leads/[leadId]/memos`
- `DELETE /api/cockpit/leads/[leadId]/memos`
- Rotas de `notes` (ver `apps/web/app/api/cockpit/leads/[leadId]/notes/`)
- Rotas de `tasks` (ver `apps/web/app/api/cockpit/leads/[leadId]/tasks/`)
- `GET /api/cockpit/leads/[leadId]/flags`
- `GET /api/cockpit/leads/[leadId]/checklist`
- `GET /api/cockpit/leads/[leadId]/documents`
- `GET /api/cockpit/leads/[leadId]/audit-log`

### Outros itens

1. **Risk B — Middleware fail-open.** `apps/web/proxy.ts`: quando `COCKPIT_SECRET` está ausente em produção, retorna `NextResponse.next()`. Em prod, falhar fechado. Hoje em produção o secret está setado, mas a falha lógica permanece.

2. **Risk C — Intake expõe `leadId`.** `apps/web/app/intake/intake-form.tsx` mostra leadId e link para `/cockpit/leads` na mensagem de sucesso. Remover ambos.

3. **Criar wrapper `apps/web/lib/route-guards.ts`** com `withCockpitSession(handler)` e `withCockpitAdmin(handler)` para reduzir boilerplate.

4. **Verifier `infra/scripts/verify-ai-0-cycle-1-local.sh`** que prova:
   - cookie fake não acessa review queue
   - cookie fake não cria recomendação
   - cookie fake não lê memos/notes/tasks/flags/checklist/documents/audit-log
   - intake success não contém `leadId` ou `/cockpit/leads`
   - prod sem `COCKPIT_SECRET` falha fechado

### Fora de escopo de AI-0 Cycle 1
- NÃO adicionar Anthropic/OpenAI ainda
- NÃO criar chatbot
- NÃO criar suitability
- NÃO criar portfolio x-ray
- NÃO mexer em Postgres (deferido para V2)
- NÃO alterar branding

### Gate de saída AI-0 Cycle 1
Código alterado + verifier executável + evidência em `state/`.

---

## Estrutura de tabelas que vão entrar em AI-1

Para preparação mental do que vem depois de AI-0:

**Mínimas em AI-1:**
- `ai_jobs` (com cost tracking: tokens, cost_cents, latency_ms, cached_input_tokens, surface, blocked_budget/blocked_guardrail statuses)
- `ai_artifacts` (com `requires_grounding` flag)
- `ai_messages` (surfaces: public_chat, portal_copilot, cockpit_copilot, email_*, whatsapp_*, marketing_copilot)
- `ai_prompt_templates` (com versioning + model_compatibility)
- `ai_guardrail_results`
- `ai_budget_caps` (scope_type: global/surface/job_type/lead, period: day/month, action_on_exceed: warn/block)
- `ai_model_versions` (pin policy + golden set)
- `ai_eval_cases` + `ai_eval_runs` (recomendado, não mínimo)

**Em AI-6 (RAG):**
- `ai_source_chunks` (com `approved_for_portal_ai` flag)
- `ai_embeddings` (vector serializado para SQLite, fronteira preparada para pgvector)
- `ai_retrieval_events`

---

## Arquivos canônicos para próxima sessão ler

Em ordem:

1. `project.yaml` — estado de máquina, brand, deferred PG triggers
2. `state/decision-log.md` — histórico de decisões T0–T9
3. `state/risk-log.md` — riscos do projeto
4. `COMPLIANCE_PACKAGE.md` — pacote regulatório completo (preenchido em T7)
5. `state/t6-closure.md` — fechamento da T6 Auth & RBAC
6. `state/t7-closure.md` — fechamento T7 Rebrand + Compliance
7. `state/t8-closure.md` — fechamento T8 Deploy
8. `C:\Users\bruno\Downloads\claude-opus-47-ai-implementation-brief-v2.md` — roadmap AI completo
9. **Este arquivo** — `state/session-handoff-2026-04-26.md`

---

## Como Bruno trabalha (perfil + preferências)

Para a próxima sessão calibrar tom e profundidade técnica:

- **Não-técnico** em código. Não programa. Tem formação em finanças (CFA L2 candidate, Master Insper, ex-Davis Polk + Machado Meyer + ABGF).
- **Quer explicações em português, sem jargão.** Quando algo técnico precisa ser dito, expandir o que a sigla/conceito significa.
- **Prefere disciplina por tranches** — Bruno autoriza, agente executa, fecha com evidência. Não autorize tranches sem comando explícito ("Autorizado.").
- **Cada commit precisa ser pushado** ao GitHub `https://github.com/Brunosavastano/bruno-advisory.git` (note: o repo continua com o nome antigo bruno-advisory por inércia).
- **Padrão de assinatura de commit:** `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>` ou ajuste para o modelo da sessão.
- **Aceita ser corrigido com franqueza** — o brief v2 é resultado direto disso. Bruno valoriza honestidade sobre o que não dá certo.

---

## Fluxo end-to-end testado e funcionando

Já validado em produção em 2026-04-26:

```
Cliente preenche /intake
  ↓
Lead aparece em /cockpit/leads
  ↓
Admin clica detalhe do lead
  ↓
Admin cria invite code do portal
  ↓
Cliente recebe código → /portal/login → entra
  ↓
Cliente vê dashboard, recomendações, research, memos, documentos
```

Tudo funcionando. Agora é só ligar IA por cima.

---

## Última coisa: como abrir AI-0 na próxima sessão

A próxima sessão deveria começar assim:

> "Olá, retomando o projeto Savastano Advisory. Por favor leia `state/session-handoff-2026-04-26.md`, `state/t8-closure.md`, `COMPLIANCE_PACKAGE.md` e `C:\Users\bruno\Downloads\claude-opus-47-ai-implementation-brief-v2.md`. Depois confirme que entendeu o estado e me proponha o plano específico de AI-0 Cycle 1."

A partir daí, executar exatamente o escopo descrito na seção "AI-0 Cycle 1" deste handoff.

---

**Fim do handoff.** Boa continuação para a próxima sessão.
