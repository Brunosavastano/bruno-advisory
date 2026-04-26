# AI-2 Cycle 1 Closure — Copiloto interno (4 surfaces novas + jobs list + review queue extension)

## Date
2026-04-26

## Status
**AI-2 Cycle 1 closed by evidence.** Cockpit ganhou 4 surfaces de IA além de memo-draft, todas reusando o gateway de Cycle 2/3 (cost tracking, budget, guardrails, redaction, retry herdados de graça). `ai_artifacts` agora aparecem na review queue ao lado de memos manuais, com tag visual "IA" e fluxo de aprovação/rejeição via novo endpoint PATCH.

## What AI-2 Cycle 1 delivered

### 1. Shared helper `apps/web/lib/ai/lead-surface.ts`
Fatora boilerplate (auth + lead lookup + AI_ENABLED + provider + runAiJob + artifact creation + error mapping) num único `handleLeadAiSurfacePost`. Cada rota concreta passa um `LeadAiSurfaceConfig` (~10 campos) e ganha tudo. Resultado: rotas de surface ficam em ~15 linhas, comportamento uniforme garantido por design.

### 2. 4 surfaces novas + memo-draft refatorado
| Rota | Job type | Output focus |
|---|---|---|
| `POST /api/cockpit/leads/[leadId]/ai/memo-draft` (reaproveitada via helper) | memo_draft | Rascunho de memo interno |
| `POST /api/cockpit/leads/[leadId]/ai/research-summary` | research_summary | Resumo de documentos aceitos + research workflows entregues |
| `POST /api/cockpit/leads/[leadId]/ai/pre-call-brief` | pre_call_brief | Briefing pré-reunião (pontos a validar + perguntas sugeridas) |
| `POST /api/cockpit/leads/[leadId]/ai/follow-up-draft` | follow_up_draft | Rascunho de mensagem pós-call |
| `POST /api/cockpit/leads/[leadId]/ai/pending-checklist` | pending_checklist | Checklist de pendências com categoria + prioridade |

Todas em surface=`cockpit_copilot`, status inicial do artifact=`pending_review`, audit completo.

### 3. 4 prompt templates novos seedados
Função `ensureAiCycle2Cycle1Surfaces` em `db.ts` insere idempotentemente os templates novos:
- `research_summary` v0.1.0
- `pre_call_brief` v0.1.0
- `follow_up_draft` v0.1.0
- `pending_checklist` v0.1.0

Todos com `requires_grounding=0` (rascunhos internos pra revisão) e `allowed_surfaces=['cockpit_copilot']`. Body em PT-BR com restrições explícitas (não promete retorno, não minimiza risco, lista pendências em vez de inferir, idioma definido).

### 4. Endpoints administrativos novos
- `GET /api/cockpit/leads/[leadId]/ai/jobs?status=&limit=` — operador vê o que rodou pra um lead, filtrado por status. Retorna lista com cost, latency, tokens.
- `PATCH /api/cockpit/leads/[leadId]/ai/artifacts/[artifactId]` — aprovar/rejeitar/arquivar artifact com audit log via `updateArtifactStatus`. `GET` no mesmo path retorna o artifact pra inspeção.

### 5. Review queue extension
- `lib/storage/review-queue.ts`: query nova somando ai_artifacts onde status=`pending_review`. Resultado mesclado com memos e research workflows, ordenado por updatedAt desc.
- `lib/storage/types.ts`: `ReviewQueueItem.type` agora aceita `'ai_artifact'`. Campo opcional `subtype` (ex.: `'memo_draft'`, `'pre_call_brief'`) preenchido só pra ai_artifact.
- `app/cockpit/review-queue/review-queue-panel.tsx`:
  - Tag "IA" burgundy + tag pequena com subtype ao lado, pra distinguir visualmente de memos manuais.
  - Lógica de aprovar/rejeitar troca o endpoint conforme `item.type` — ai_artifact vai pro PATCH novo, memo continua no PATCH existente.

## Evidence
Output em `state/evidence/AI-2-cycle-1/summary-local.json`. 6 cenários green:

| Cenário | Resultado |
|---|---|
| 5 templates ativos seedados | ✓ `[follow_up_draft, memo_internal_draft, pending_checklist, pre_call_brief, research_summary]` |
| 5 surfaces retornam 201 com mock provider | ✓ jobIds + artifactIds + costCents=1 cada |
| Review queue lista 5 ai_artifacts com subtype correto | ✓ |
| PATCH artifact approved (memo_draft) | ✓ status=approved, reviewedBy=adminUserId, audit `ai_artifact_approved` registrado |
| GET ai/jobs?status=succeeded retorna 5 com cost > 0 | ✓ |
| Panel UI: tag IA + handles ai_artifact PATCH | ✓ |

## Out-of-scope intencional
- ❌ Redesign mobile-first completo da review queue (cards + swipe + responsivo) — **AI-2 Cycle 2**
- ❌ Push notifications / badge counter de itens pendentes — backlog
- ❌ Botões na página do lead (`/cockpit/leads/[leadId]`) chamando as 4 novas rotas — UI a fazer junto com Cycle 2 ou em microticket dedicado
- ❌ "Gerar perguntas para reunião" como surface separada — capturado dentro do pre-call-brief
- ❌ Aprovação/rejeição na página de detalhe do lead — fluxo único é via review queue

## Riscos atualizados em `risk-log.md`
Nenhum risco novo. Mitigações herdadas de Cycle 2/3 cobrem todas as 4 surfaces novas (custo registrado, budget respeitado, guardrails ativos, redaction strict, retry transparente). Auto-extensão por design — qualquer surface futura que use `handleLeadAiSurfacePost` herda toda a proteção sem código adicional.

## Comportamento esperado em produção (após deploy)

Operador vai a `/cockpit/review-queue`. Entra um cliente que já tem 2 documentos aceitos. Operador clica "Gerar resumo de pesquisa" (a UI desse botão é Cycle 2 — pode invocar via curl/dev tools por ora). Em 15-25s o `research_summary` aparece na review queue com tag IA burgundy + subtype `research_summary`. Operador lê, aprova ou rejeita. Audit log preserva trilha completa.

## Next
**AI-2 Cycle 2** — UX completa:
- Cards mobile-first na review queue (substituindo a tabela atual)
- Botões nas páginas de lead invocando as 5 surfaces
- Filtro por surface (memo / research / brief / follow-up / checklist)
- Push notification ou badge no header quando novo item chegar
- Modal de comentário obrigatório em rejeição (já tem prompt, virar modal)

Cycle 2 é principalmente trabalho de UI; backend já está pronto.
