# T6 Cycle 6 — Actor propagation (19 callsites)

## What was built
- **15 helpers de storage** atualizados para aceitar `actorId?: string | null` e repassá-lo ao `writeAuditLog`:
  - `leads.ts` — `updateLeadCommercialStage`
  - `billing.ts` — `createLeadLocalBillingRecord`, `createLeadLocalBillingCharge`, `createNextLeadLocalBillingCharge`, `settleLeadLocalBillingChargeById`
  - `checklist.ts` — `completeChecklistItem` (param opcional, forçado a `null` no caminho cliente)
  - `documents.ts` — `reviewDocument` (upload cliente-driven continua sem `actorId`)
  - `memos.ts` — `updateStatus`
  - `portal.ts` — `createInvite`, `revokeInvite` (cliente/system writes em `redeemInvite`, `getSession` auto-expiry, `deleteSession` client logout permanecem sem `actorId`)
  - `recommendations.ts` — `publishRecommendation`, `deleteRecommendation`
  - `research-workflows.ts` — `updateStatus`
- **12 route handlers de cockpit** chamam `requireCockpitSession(request)` no topo e passam `check.context.actorId` para o helper:
  - `commercial-stage`, `billing-record`, `billing-charges`, `billing-charges/next`, `billing-settlements/[chargeId]`, `documents/[documentId]`, `memos` (PATCH), `portal-invite-codes`, `portal-invite-codes/[inviteId]/revoke`, `recommendations/[recommendationId]` (PATCH + DELETE), `research-workflows` (PATCH)
- **Recommendations POST delegation fix**: a rota `recommendations/[recommendationId]/route.ts` tinha POST que delegava para PATCH/DELETE sem repassar o cookie — agora preserva `cookie` header na Request delegada.
- **Regression test setup** (`billing.test.ts`): adiciona `process.env.COCKPIT_SECRET` + cookie legacy em todo request; helper `cockpitHeaders()` substitui `headers: { 'content-type': 'application/json' }`. Testes exercitam o caminho `legacy-secret` (garantia de continuidade do fallback).

## Where it is
- Storage: `apps/web/lib/storage/{billing,checklist,documents,leads,memos,portal,recommendations,research-workflows}.ts`
- Routes: `apps/web/app/api/cockpit/leads/[leadId]/{commercial-stage,billing-record,billing-charges,billing-charges/next,billing-settlements/[chargeId],documents/[documentId],memos,portal-invite-codes,portal-invite-codes/[inviteId]/revoke,recommendations/[recommendationId],research-workflows}/route.ts`
- Test fixture: `apps/web/lib/storage/__tests__/billing.test.ts`
- Verifier shell: `infra/scripts/verify-t6-cycle-6-local.sh`
- Verifier TS: `infra/scripts/verifiers/t6-cycle-6.ts`
- Evidence: `state/evidence/T6-cycle-6/summary-local.json`

## How to verify
1. `bash infra/scripts/verify-t6-cycle-6-local.sh`
2. Confirmar `ok: true` em `state/evidence/T6-cycle-6/summary-local.json`
3. Confirmar 7 módulos cobertos × 2 cenários cada (real + legacy) = 14 gravações validadas:
   - `leads_commercial_stage` — real: `actorId === adminUserId`, legacy: `'legacy-secret'`
   - `billing_record` — idem (valida ambos writes: created + activated)
   - `portal_invite_create` — idem
   - `research_workflows_status` — idem
   - `memos_status` — idem
   - `recommendations_publish` — idem
   - `documents_review` — idem
4. `noAuthScenario.status: 401` (cenário sem cookie nem secret)
5. `nonOperatorChecks`: `redeemNotThreaded`, `autoExpireNotThreaded`, `clientLogoutNotThreaded` todos `true` (client/system writes permanecem sem actorId)
6. `sourceAudit`: `operatorCallsitesTotal === operatorCallsitesWithActorId` (14/14 detectados — o 15º é o ternário de checklist que escapa do regex literal `actorType: 'operator'` mas teve `actorId` threaded via block source)
7. `npm run typecheck` limpo
8. Inner test suite verde (13/13 lógicos; EPERM Windows permanece pré-existente)

## Design decisions
- **Opcional em todo helper.** Cada helper recebe `actorId?: string | null` (ou param posicional opcional, depende do padrão pré-existente). Default `null`/`undefined` → `null` no DB. Isso garante compat com callers legados e permite que helpers chamados de múltiplos contextos (cockpit + portal) não quebrem.
- **Checklist: client path nunca carrega actorId.** `completeChecklistItem` recebe `actorId` mas força `null` quando `completedBy === 'client'`. Mesmo que um caller passe um valor por engano, a semântica de auditoria permanece coerente.
- **Portal helpers são tri-modais.** `createInvite`/`revokeInvite` (operator) recebem `actorId`. `redeemInvite`/`getSession auto-expiry`/`deleteSession client logout` (client/system) NÃO recebem — a assinatura canonicalmente não aceita, para prevenir uso incorreto.
- **Middleware Edge mantém presença-only check.** Cycle 4 já estabeleceu isso; aqui confirmamos que a presença do cookie ou do secret sempre chega na route handler, que faz a validação real. Nenhuma route Cycle 6 toca Edge.
- **Tests usam COCKPIT_SECRET fallback.** `billing.test.ts` não cria sessão real (caro em fixture setup + tempo); usa o cookie legacy e confia que o caminho `legacy-secret` cobre a verificação funcional do storage. Cycle 6 verifier separado exercita o caminho com sessão real.
- **Recommendations POST delegation fix.** O POST `recommendations/[recommendationId]` construía uma `new Request(...)` sem forwardar o cookie — sem esse fix, a delegação quebrava o fluxo de form submission. Patch mínimo: repassar `cookie` header.

## Anti-scope cumprido
- Sem mudança no schema (coluna `audit_log.actor_id` já existe de Cycle 1)
- Sem mudança na função `writeAuditLog` (assinatura canônica permanece a de Cycle 3)
- Sem UI nova (Cycle 7)
- Sem remoção de `COCKPIT_SECRET` (T7)
- Sem rate-limiting
- Sem refresh tokens
- Sem auditoria retroativa (rows antigos ficam com `actor_id NULL` — Cycle 3 garantiu a coluna)

## Remaining risk
- **Rotas de mutação não-auditadas** (ex: tasks, notes, flags, pending-flags, review-queue não escrevem audit ou não foram tocadas) continuam gated APENAS pelo middleware Edge. Se alguém contornar a proxy (ex: via subprocess test harness), elas aceitam sem sessão. Risco aceitável para T6 — escopo é auditoria de operador, não hardening geral. T7/T8 podem endurecer.
- **Fixture tests bypassam middleware.** `billing.test.ts` invoca handlers via `loadUserland` — a proxy não roda. Isso É o padrão estabelecido, mas significa que middleware bugs passam desapercebidos nos testes. Cycle 8 pode adicionar um smoke test via `next dev`.
- **Cycle 3 verifier invariant.** Originalmente, Cycle 3 verifier afirmava `callsitesWithActorId === 0` (contrato "nenhum caller passa actorId ainda"). Esse contrato está quebrado por design em Cycle 6. Se alguém rodar o Cycle 3 verifier DEPOIS de Cycle 6, vai falhar. Cycle 8 closure deve retirar ou refrasear essa assertion.
- **Recommendations create route** não existe na superfície pública — o verifier seeda via `DatabaseSync` direto. Se uma UI de "create recommendation" surgir em Cycle 7, precisa receber requireCockpitSession.

## Next best step
- Abrir Ciclo 7: UI de gerenciamento de usuários em `/cockpit/users` (list, create, update, deactivate), header do cockpit com logout button visível, página `/cockpit` como landing após login, links para users admin gated por role. Usa `requireCockpitSession` + checa `context.role === 'admin'` para gates de capability. Manter consistência com o padrão estabelecido por Cycles 4-6.
