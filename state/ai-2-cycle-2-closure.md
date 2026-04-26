# AI-2 Cycle 2 Closure — UI completa do copiloto IA

## Date
2026-04-26

## Status
**AI-2 Cycle 2 closed by evidence.** Cockpit visualmente operacional para todas as 5 surfaces de IA. Operador agora gera, lê, aprova ou rejeita drafts inteiramente pela interface — sem precisar de curl. Backend não foi tocado.

## What AI-2 Cycle 2 delivered

### 1. Painel "Copiloto IA" na página do lead
Arquivo novo: `apps/web/app/cockpit/leads/[leadId]/ai-copilot-panel.tsx` (client component).
- 5 botões em grid responsivo (memo, research-summary, pre-call-brief, follow-up-draft, pending-checklist)
- Campo opcional "Foco específico" — operador refina o prompt antes de gerar
- Estado de loading individual por botão (`Gerando…`)
- Resultados acumulam embaixo numa lista visual: tag verde para sucesso (com link para o artifact) e vermelha para falha. Mostra custo + latência.
- Tradução de error codes em PT-BR claro: `blocked_budget` → "Bloqueado por orçamento", `blocked_guardrail` → "Bloqueado por guardrail (motivo)", `ai_disabled` → "IA desabilitada (AI_ENABLED=false no servidor)", `provider_failure` → "Falha no provedor (...)"
- Painel foi inserido logo após o header da página, antes mesmo do estágio comercial — primeira coisa que o operador vê. Link "Histórico IA" também adicionado nas ações do header.

### 2. Página de visualização do artifact
Arquivos novos:
- `apps/web/app/cockpit/ai-artifacts/[artifactId]/page.tsx` (server component)
- `apps/web/app/cockpit/ai-artifacts/[artifactId]/artifact-review-actions.tsx` (client component)

Mostra:
- Body completo do artifact em `<pre>` com whitespace preservado
- Header com tag IA burgundy + tipo (memo_draft, research_summary, etc.) + status atual + reviewer/reviewed_at se já revisado
- Card "Job de IA" com jobId, tipo, surface, provider, modelo + versão, prompt template + versão, redaction level + counts, tokens in/out + cached, custo (cents + USD), latência, timestamps, errorMessage se houver
- Card "Guardrails" listando cada regra executada com status colorido (pass=verde, warn=laranja, block=vermelho) + detalhe do match quando aplicável
- Se status=`pending_review`, render `ArtifactReviewActions` (client) com botões Aprovar/Rejeitar
- Rejeição abre formulário inline com textarea obrigatório (validação: motivo > 0 chars). Botão "Confirmar rejeição" só ativo com motivo válido.

### 3. Review queue redesenhada
Arquivo modificado: `apps/web/app/cockpit/review-queue/review-queue-panel.tsx`
- **Tabs de filtro** no topo: Todos / IA / Memos / Research, cada um com contador. Cliente-side, instantâneo.
- **Layout em cards** responsivo (`grid-template-columns: repeat(auto-fit, minmax(280px, 1fr))`). No mobile vira coluna única; no desktop 2-3 colunas.
- Cada card: tag de tipo (burgundy IA + sub-tag de subtype para ai_artifact, badge cinza para memo/research), título, lead, updatedAt, e três botões: Abrir (deep link → artifact view OU lead page) / Aprovar / Rejeitar.
- **Modal de rejeição** dedicado: textarea obrigatório, validação, fecha com clique fora ou botão Cancelar. Substitui o `window.prompt()` antigo.
- Mensagens de feedback estilizadas com borda dourada (cor de acento da identidade Savastano).

### 4. Histórico de IA por lead
Arquivo novo: `apps/web/app/cockpit/leads/[leadId]/ai-history/page.tsx`
- Tabela com todos os jobs de IA do lead (até 100): createdAt, jobType, status colorido, tokens in/out, custo, latência, link pro artifact (quando existe).
- Header mostra contagem total de jobs + succeeded count + custo total acumulado em ¢ e USD.
- Acessível via novo botão "Histórico IA" no header da página do lead, e via link "Histórico IA do lead" na página do artifact.

## Evidence
Verifier 100% verde em `state/evidence/AI-2-cycle-2/summary-local.json`. 7 grupos de checks:

| Grupo | Verdes |
|---|---|
| 4 novos arquivos existem | 4/4 |
| AiCopilotPanel: 'use client', 5 surfaces, focusHint, error handling, artifact links | 5/5 |
| Lead page: import + render + ai-history link | 3/3 |
| Artifact view: body, job metadata, guardrails, redaction, conditional actions | 5/5 |
| Artifact review actions: textarea, validação, PATCH route correto | 3/3 |
| Review queue: filter tabs, cards, modal, no `window.prompt`, IA badge burgundy, artifact deep link | 6/6 |
| AI history: lista jobs, junta artifacts, total cost, links | 4/4 |

Build + typecheck também verdes (parte do shell wrapper do verifier).

## Out-of-scope (defer)
- ❌ Push notifications / badge real-time de itens pendentes — backlog, exigiria WebSocket ou polling
- ❌ Editor inline do artifact body (operador edita por copy-paste pra memo manual por ora)
- ❌ Bulk approve / reject (só 1 a 1 por enquanto)
- ❌ Mobile nav drawer dedicado — não foi necessário, layout já é responsivo

## Comportamento esperado em produção (após deploy)

Operador abre `/cockpit/leads/<id>` no celular. Vê painel "Copiloto IA" no topo com 5 botões em grid. Toca "Briefing pré-call". Loading aparece por ~20s. Resultado verde com link "Ver artifact". Toca o link → vai para `/cockpit/ai-artifacts/<id>` → lê o body inteiro do briefing → vê custo e guardrails que rodaram → toca "Aprovar". Página recarrega mostrando status `approved` + reviewedBy = userId dele.

Em paralelo, abre `/cockpit/review-queue` — vê grid de cards, filtra por "IA", aprova/rejeita com modal pra motivo. Toca "Histórico IA" na página do lead → vê tabela completa de tudo que rodou pra esse lead, custo total acumulado.

## Riscos atualizados em `risk-log.md`
Nenhum risco novo. UI é frontend-only — toda a proteção (compliance, custo, redação, guardrails) continua no backend de Cycle 1/2/3. Operador agora pode aprovar/rejeitar artifacts sem ferramenta externa, mas nada é publicado pra cliente sem aprovação humana explícita (gate por design, não muda).

## Lifecycle do dev route AI-1 Cycle 1
A rota dev-only `/api/dev/ai-1-cycle-1/exercise` continua existindo, gated por `AI_DEV_HARNESS_ENABLED=1`. Pode ser removida no próximo cycle de cleanup ou mantida como diagnóstico — sem dano em produção.

## Next
Roadmap completo do brief v2 daqui pra frente:
- **AI-2.5** — Email automation (classificação de inbound + drafts aprováveis)
- **AI-3** — Suitability digital
- **AI-4** — Portfolio X-Ray com parsers brasileiros
- **AI-4.5** — PDFs e artefatos client-facing
- **AI-5** — Recommendation Ledger v2 + Compliance Gate
- **AI-6** — Portal Copilot privado com RAG real
- **AI-7** — Chatbot público educacional + agendamento
- **AI-8** — Marketing Cockpit

Recomendação de prioridade próxima: **AI-3 (suitability digital)** porque é gate regulatório para qualquer recomendação personalizada — tudo de AI-5 em diante depende dele. Alternativa: **AI-2.5 (email automation)** se você quiser ganhos operacionais imediatos antes de mexer em compliance estrutural.
