# Session Handoff — Savastano Advisory
**Data:** 2026-04-26 (v2 — fim do dia, após AI-0 → AI-2 Cycle 2)
**Propósito:** continuar trabalho em uma nova sessão sem perder contexto.

---

## TL;DR para a próxima sessão

A camada de **IA interna do cockpit está completa em produção**. Em 1 sessão fechamos:
- AI-0 (hardening de auth) Cycles 1+2
- AI-1 (gateway de IA) Cycles 1+2+3 — schema, provider Anthropic, guardrails+redaction+retry
- AI-2 (copiloto interno) Cycles 1+2 — 5 surfaces de IA + UI completa

Operador agora abre `/cockpit/leads/<id>`, toca um dos 5 botões do Copiloto IA, lê o draft em `/cockpit/ai-artifacts/<artifactId>`, aprova/rejeita com modal, vê histórico em `/cockpit/leads/<id>/ai-history`. Tudo em produção. Custo até agora: ~7 cents (3 chamadas reais + verifier mocks).

**Próxima tranche recomendada: AI-3 (Suitability digital)** — gate regulatório obrigatório para AI-5 (recomendações personalizadas) destrava o resto do roadmap.

---

## Estado em produção

- **URL:** https://savastanoadvisory.com.br
- **Servidor:** Contabo VPS, IP 212.90.121.236, alias SSH `savastano-prod` (chave `~/.ssh/id_savastano_deploy` autorizada)
- **Containers:** `savastano-advisory-app` + `savastano-advisory-caddy`. Ambos rodando.
- **AI ativada:** `AI_ENABLED=true`, `AI_PROVIDER=anthropic`, `AI_MODEL=claude-sonnet-4-6`, `ANTHROPIC_API_KEY` provisionada.
- **Budget caps ativos:** US$ 5/dia + US$ 50/mês, ambos `block` em scope global. Spend atual: ~5¢ no mês.
- **Bootstrap seed do DB inclui:** Sonnet 4.6 active + 5 prompt templates ativos (memo_internal_draft, research_summary, pre_call_brief, follow_up_draft, pending_checklist) v0.1.0.

---

## Tranches fechadas em 2026-04-26

| Tranche | Commit | O que entregou |
|---|---|---|
| AI-0 Cycle 1 | `b1a7a60` | 10 rotas residuais cockpit guardadas, middleware fail-closed em prod, intake leak removido |
| AI-0 Cycle 2 | `0964177` | flags POST + checklist POST guardadas |
| AI-1 Cycle 1 | `c8b6662` | 9 tabelas SQLite (ai_jobs, artifacts, messages, prompt_templates, guardrail_results, budget_caps, model_versions, eval_cases, eval_runs) + 9 core models + 9 storage helpers |
| AI-1 Cycle 2 | `3fce847` | Provider Anthropic + cost tracking + budget enforcement + memo-draft route + admin model-versions route + dev-mock-mode |
| (compose fix) | `b6ad97b` | docker-compose passa AI env vars para o container |
| AI-1 Cycle 3 | `9224e9a` | Guardrails (3 regras), redaction (CPF/CNPJ/RG/cartão), retry exponencial, JSON schema validator |
| AI-2 Cycle 1 | `f0bf40d` | 4 surfaces novas (research-summary, pre-call-brief, follow-up-draft, pending-checklist) + jobs list + artifact PATCH + review queue mostra ai_artifacts |
| AI-2 Cycle 2 | `0de7169` | UI completa: Copiloto IA na página do lead, página de visualização do artifact com guardrails+redaction+actions, review queue com cards mobile-first + filtros + modal de rejeição, histórico de IA por lead |

---

## Roadmap remanescente (brief v2)

| Tranche | Status | Bloqueado por | Prioridade |
|---|---|---|---|
| **AI-3** Suitability digital | Pendente | — | **ALTA** — gate regulatório, destrava AI-4/5 |
| AI-2.5 Email automation | Pendente | — | Média — ganho operacional, não bloqueia ninguém |
| AI-4 Portfolio X-Ray (parsers BR) | Pendente | AI-3 (para client-facing) | Média |
| AI-4.5 PDFs client-facing | Pendente | AI-4 ou AI-5 | Baixa |
| AI-5 Recommendation Ledger v2 + Compliance Gate | Pendente | AI-3 + AI-4 | Alta uma vez que AI-3+4 fechem |
| AI-6 Portal Copilot privado (RAG real) | Pendente | AI-5 | Alta complexidade — penúltimo |
| AI-6.5 WhatsApp como canal | Pendente | AI-6 | Subtranche |
| AI-7 Chatbot público + agendamento | Pendente | AI-6 | Última surface antes de marketing |
| AI-8 Marketing cockpit | Pendente | — | Independente, pode ir paralelo |

---

## Como abrir AI-3 na próxima sessão

> "Olá, retomando Savastano Advisory. Por favor leia `state/session-handoff-2026-04-26-v2.md`, depois consulte memory pra contexto operacional, e me proponha o plano específico de AI-3 Cycle 1."

A memory do agente já tem: perfil do Bruno, disciplina de tranches, decisões de provedor + pinning de modelo, fluxo de deploy, posicionamento regulatório, política de DB.

---

## Pontos para a próxima sessão considerar em AI-3

- **Brief v2 §AI-3** lista status do suitability (`draft` / `submitted` / `needs_clarification` / `review_required` / `approved` / `expired` / `superseded`) e perfis de risco (`conservador` → `arrojado`).
- Tabelas novas: `client_profiles` + `suitability_assessments`. Estimar 2 ou 3 ciclos.
- **Gap #4 do session-handoff original:** o brief não mapeia perguntas para a Resolução CVM 30/2021. Cycle 1 deveria adicionar `regulatory_reference` por seção do questionário.
- Suitability é cálculo determinístico (scoring), IA não toma decisão final. IA pode resumir respostas, apontar inconsistências, sugerir esclarecimentos.
- Portal flow novo (`/portal/suitability`) + cockpit flow novo (review do suitability submitted).

---

## Estado financeiro da camada de IA

- 1 chamada bem-sucedida em produção: 2¢ (memo-draft)
- 1 chamada em produção com CPF redacted: 2¢ (memo-draft)
- 1 chamada em produção: 2¢ (pre-call-brief com guardrails passando)
- 2 chamadas que falharam antes do bill (key inválida + insufficient credits): 0¢
- Verifiers locais: 0¢ (sempre mock)

Total mensal até agora: **6¢ de 5000¢ disponíveis** (0,12% do cap).

---

## Arquivos canônicos para próxima sessão

Em ordem:
1. `state/session-handoff-2026-04-26-v2.md` (este arquivo — começa por aqui)
2. `state/ai-2-cycle-2-closure.md` (closure mais recente — visão pós-deploy)
3. `state/risk-log.md` (riscos consolidados ao longo do roadmap)
4. `COMPLIANCE_PACKAGE.md` (canônico regulatório)
5. `C:\Users\bruno\Downloads\claude-opus-47-ai-implementation-brief-v2.md` (brief original do roadmap AI)
6. Memory do agente (auto-loaded)

---

**Fim do handoff v2.** Plataforma operacional, IA interna funcionando em produção, próxima tranche é regulatória (AI-3). Boa sessão.
