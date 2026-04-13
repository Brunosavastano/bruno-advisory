# ROADMAP.md

## Estratégia geral

Construir o projeto em tranches pequenas, fechadas por evidência e não por entusiasmo.

## T0 — Foundation, Repo e Separação Dura
**Objetivo:** criar o sistema operacional do projeto, já separado do VLH.

**Inclui:**
- repo privado novo
- convenções do repo
- CI mínima
- ambiente novo
- segredos novos
- DB nova
- deploy novo
- Control Room esqueleto
- logs, backups e healthchecks mínimos
- docs canônicas

**Gate de saída:** projeto sobe em ambiente próprio e exibe status real da tranche.

---

## T1 — Oferta, ICP, Mensagem e Compliance Surface
**Objetivo:** fechar o que será vendido, para quem, com qual narrativa e com quais superfícies mínimas de compliance/UX.

**Inclui:**
- ICP PF premium
- oferta principal
- pricing inicial
- FAQs
- páginas obrigatórias
- onboarding map
- CRM fields
- recommendation ledger blueprint
- base copy do site

**Gate de saída:** existe proposta coerente, vendável e implementável.

---

## T2 — Site Público e Intake
**Objetivo:** colocar no ar a máquina pública de aquisição e qualificação.

**Inclui:**
- landing page
- páginas institucionais
- formulário de fit
- agendamento ou pedido de contato
- analytics
- captura de leads na DB
- painel interno básico para visualizar entradas

**Gate de saída:** lead entra pelo site e aparece no cockpit interno.

---

## T3 — Backoffice, CRM e Billing
**Objetivo:** transformar interesse em operação.

**Inclui:**
- CRM interno
- estados do lead/cliente
- notas internas
- tasks
- flags
- billing recorrente
- eventos de cobrança
- trilha mínima de auditoria
- RBAC básico para Bruno/admin

**Gate de saída:** um lead pode virar cliente pagante no sistema.

---

## T4 — Portal do Cliente e Ledger
**Objetivo:** dar ao cliente um espaço privado simples, funcional e auditável.

**Inclui:**
- login do cliente
- dashboard do cliente
- checklist de onboarding
- upload de documentos
- timeline de entregas
- recommendation ledger inicial
- histórico de interações estruturadas

**Gate de saída:** um cliente beta consegue entrar, enviar dados e receber material.

---

## T5 — Workflows Assistidos por IA, Beta e Go-Live
**Objetivo:** automatizar o que já provou valor e preparar entrada em produção.

**Inclui:**
- research workflow
- gerador de memo/draft
- fila de revisão humana
- logs por ação crítica
- beta controlado
- bug bash
- checklist de release
- rollback e backup testados

**Gate de saída:** sistema pronto para uso real com risco operacional reduzido.

## Regra de governança
A próxima tranche só abre quando a anterior fechar por evidência aceita por Zeus.
