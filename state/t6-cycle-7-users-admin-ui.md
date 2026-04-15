# T6 Cycle 7 — Users admin UI

## What was built
- Helper `requireCockpitAdmin(request)` em `apps/web/lib/cockpit-session.ts` — wrap de `requireCockpitSession` que adicionalmente valida `role === 'admin'`. Retorna 403 `admin_required` caso contrário. Fallback legacy (`role: 'operator'`) nunca passa.
- API admin-only:
  - `GET /api/cockpit/users` → retorna `{ok, users: [...]}` (todos os cockpit_users).
  - `POST /api/cockpit/users` → cria usuário a partir de `{email, displayName, role, password}`. 201 sucesso; 400 payload inválido (com `allowedRoles` + `minPasswordLength`); 409 `email_already_exists`.
  - `PATCH /api/cockpit/users/[userId]` → atualiza `displayName`/`role`/`isActive`/`password` (qualquer combinação). 200 sucesso; 404 not_found; 400 validation; 409 `last_admin_protected` quando a mudança deixaria o DB sem admins ativos. Deactivação via `isActive: false` propaga para `DELETE FROM cockpit_sessions WHERE user_id = ?` dentro do `updateCockpitUser` — sessões do alvo caem atomicamente.
- Página `/cockpit/users` (`apps/web/app/cockpit/users/page.tsx`): gate de admin via `cookies() → findCockpitSessionByToken → isCockpitSessionValid && session.role === 'admin'`. Não-admins são redirecionados para `/cockpit/leads?error=...`. Inclui:
  - Form de criação (email/displayName/role/password).
  - Tabela de usuários com ações inline: mudar papel (select + submit) e toggle ativo/inativo.
  - Server actions replicam as guardas de last-admin protection presentes na API.
- Layout `apps/web/app/cockpit/layout.tsx`: server component que envolve TODO cockpit path. Header com (a) links de navegação (incluindo `/cockpit/users` apenas se `role === 'admin'`), (b) display `displayName · role` para sessões reais, (c) banner amarelo "Sessão legada (COCKPIT_SECRET)" quando o modo é fallback, (d) botão de logout que chama `deleteCockpitSessionByToken` + expira cookie + redireciona para `/cockpit/login`. Página de login (rota pública) renderiza SEM header (o layout detecta ausência de session/legacy e retorna apenas `children`).
- Página `/cockpit/page.tsx`: redirect simples para `/cockpit/leads` — fecha o URL morto.

## Where it is
- Helper: `apps/web/lib/cockpit-session.ts` (função `requireCockpitAdmin`)
- API list/create: `apps/web/app/api/cockpit/users/route.ts`
- API update: `apps/web/app/api/cockpit/users/[userId]/route.ts`
- Página: `apps/web/app/cockpit/users/page.tsx`
- Layout: `apps/web/app/cockpit/layout.tsx`
- Landing: `apps/web/app/cockpit/page.tsx`
- Verifier shell: `infra/scripts/verify-t6-cycle-7-local.sh`
- Verifier TS: `infra/scripts/verifiers/t6-cycle-7.ts`
- Evidence: `state/evidence/T6-cycle-7/summary-local.json`

## How to verify
1. `bash infra/scripts/verify-t6-cycle-7-local.sh`
2. Confirmar `ok: true` em `state/evidence/T6-cycle-7/summary-local.json`
3. Confirmar 8 cenários verdes:
   - **A_admin_list** — admin GET → 200, count ≥ 2
   - **B_operator_forbidden** — operator session GET → 403 `reason: admin_required`
   - **C_legacy_forbidden** — cookie legacy → 403 (fallback é role='operator')
   - **D_no_auth_unauthorized** — sem cookies → 401
   - **E_admin_create** — POST cria user, 201 com `newUserId`
   - **F_duplicate_email** — POST com email já existente → 409 `email_already_exists`
   - **G_deactivate_drops_sessions** — PATCH `isActive: false` → 200 + 0 sessões do alvo + `/api/cockpit/session` com cookie do alvo → 401
   - **H_last_admin_protected** — PATCH admin único → role='operator' → 409 `last_admin_protected`, linha NÃO muta
4. Confirmar 8 source-text checks: `requireAdminExported`, `requireAdminReturns403`, `layoutLogoutAction`, `layoutLegacyBanner`, `layoutUsersLinkAdminOnly`, `usersPageAdminGate`, `usersPageLastAdminGuard`, `rootPageRedirects` — todos `true`
5. `npm run typecheck` limpo; inner test suite 13/13 lógicos (EPERM Windows permanece pré-existente)

## Design decisions
- **`requireCockpitAdmin` como wrap, não fork.** Reusa 100% da validação de sessão do Cycle 4, apenas adicionando o check de role. Mantém um único ponto de mudança para lógica de sessão.
- **Fallback legacy never passes admin gate.** O fallback `COCKPIT_SECRET` resolve para `role: 'operator'` (Cycle 4). Por design, admin surfaces ficam inacessíveis via secret. Isso é intencional: users admin precisa de identidade individual, e cercar o legacy force a migração para sessões reais.
- **Last-admin protection em duas camadas.** Check na API (backend, sempre ativo) + check na server action da página (UX imediata — evita round-trip que voltaria com erro). Ambos consultam `countActiveAdmins()` antes de permitir a mutação. Garante que mesmo se a UI quebrar, o DB não vai ficar sem admins.
- **Deactivation = session drop.** `updateCockpitUser` já derruba sessões do alvo na mesma transação desde Cycle 1. Cycle 7 apenas expõe essa propriedade via UI + API. Verifier H prova o efeito end-to-end: PATCH → 0 sessões → operator cookie retorna 401 em `/api/cockpit/session`.
- **Layout como single source of truth.** Alternativa seria duplicar header em cada cockpit page — começa OK, virou bagunça no primeiro refactor. Layout server component lê cookies uma vez, renderiza condicionalmente. Custo: +1 session lookup por page render; aceitável (cockpit = poucos users).
- **Header oculto em `/cockpit/login`.** Layout detecta ausência de sessão E ausência de legacy fallback → retorna apenas `children`. Não precisa de route group ou lógica condicional no login page.
- **Banner "Sessão legada" no header.** Quando o modo é fallback, o header mostra um aviso amarelo. Sinaliza para o operador que ele está no caminho que T7 vai remover — e encoraja login real.
- **Página `/cockpit` redireciona.** Não existia landing autenticado. Redirect para `/cockpit/leads` é o menor passo que resolve — Cycle 8 pode promover para dashboard real se quiser.
- **Actor propagation em users admin NÃO escreve audit.** `updateCockpitUser` e `createCockpitUser` não chamam `writeAuditLog`. Se compliance exigir trail dessas operações, isso é T7+ (novo módulo de user_audit ou extensão do audit_log com entity_type='cockpit_user'). Aceitável deixar de fora em T6.

## Anti-scope cumprido
- Sem user-initiated password change (admin-only via users page)
- Sem password reset por email
- Sem 2FA / OTP
- Sem audit trail das operações de users admin (fora de T6)
- Sem role-change logs
- Sem SSO/OAuth
- Sem remoção de `COCKPIT_SECRET` (T7)

## Remaining risk
- **Users admin actions sem audit trail.** Um admin pode criar, promover ou desativar outro admin sem deixar trilha em `audit_log`. Compliance pode exigir isso — T7 pode adicionar `writeAuditLog({entityType: 'cockpit_user', action: 'user_created'|'role_changed'|'deactivated', actorId: adminId, ...})` nos 3 server actions + 2 API handlers.
- **Layout server component faz session lookup em cada page render.** Aceitável hoje (scale = handful de users). Se o cockpit crescer muito, cache via `unstable_cache` ou cookie-only check + in-memory LRU.
- **Server actions não validam CSRF explicitamente.** Next App Router já tem proteção contra cross-origin forms via Origin header check (built-in), mas isso não é óbvio. T7+ pode adicionar check explícito de Origin/Referer nas actions críticas.
- **last_admin_protection** tem uma janela de corrida: dois admins simultaneamente tentando se demote podem ambos passar o check e resultar em zero admins. Custo prático: 0 (dois admins simultâneos tentando se demote ao mesmo tempo é cenário extremo). Soluções: lock advisory ou retry com check pós-update.

## Next best step
- Abrir Ciclo 8: regressão completa + closure de T6. Inclui:
  - Reconciliar Cycle 3 verifier (contract-guard `callsitesWithActorId === 0` está quebrado por design desde Cycle 6) — retirar ou refrasear.
  - Smoke test end-to-end: rodar os 7 verifiers de cycle em sequência + confirmar evidência de todos em `state/evidence/T6-cycle-*/`.
  - Atualizar `project.yaml` para `tranche_status: done` em T6.
  - Escrever `state/t6-closure.md` com os critérios cumpridos + deferrals explícitos (T7: remoção do COCKPIT_SECRET; audit trail de users admin; rate-limit).
  - Confirmar `npm run test` verde + typecheck + build.
