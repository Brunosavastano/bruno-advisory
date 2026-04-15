# Zeus Mandate — T6 Cockpit Auth & RBAC

## Date
2026-04-15

## Status
T6 is OPEN.

## Tranche objective
Replace the single-secret cockpit auth model with per-user accounts, roles (admin/operator/viewer), session-based login, and individualized audit log traceability. Preserve `COCKPIT_SECRET` fallback during this tranche (removed in T7).

## Cycles

| # | Name | Status |
|---|------|--------|
| 1 | Schema & scrypt foundation | ✅ accepted |
| 2 | Bootstrap admin CLI | ✅ accepted |
| 3 | Audit log actor_id signature | ✅ accepted |
| 4 | Middleware + requireCockpitSession | ✅ accepted |
| 5 | Login / logout API + page | ✅ accepted |
| 6 | Actor propagation (19 callsites) | ✅ accepted |
| 7 | Users admin UI | 🔴 open |
| 8 | Regression + closure | ⏳ pending |

## Current cycle
**Cycle 7 — Users admin UI**

### Deliverables
- Página `/cockpit/users` (`apps/web/app/cockpit/users/page.tsx`): lista usuários do cockpit com (email, displayName, role, isActive, createdAt, lastLoginAt se disponível). Visível apenas para `role === 'admin'` — outros papéis recebem 403.
- Server actions: `createCockpitUser` (admin-only form de email/displayName/password/role), `updateCockpitUser` (edit displayName/role/isActive/password), `deactivateCockpitUser` (toggle isActive → false + sessions deletadas atomicamente).
- Header do cockpit (`apps/web/app/cockpit/layout.tsx` ou similar): mostra o usuário logado (email ou displayName) + botão de logout que posta para `/api/cockpit/logout` e redireciona para `/cockpit/login`. Legacy context mostra "sessão legada (COCKPIT_SECRET)" para sinalizar que T7 vai remover.
- Página `/cockpit` como landing autenticado (seja linha-de-dashboard simples ou redirect para `/cockpit/leads`, decisão no opening).
- Role gating helper: extender `requireCockpitSession` ou adicionar `requireCockpitAdmin(request)` que chama `requireCockpitSession` + confere `role === 'admin'`.
- `infra/scripts/verify-t6-cycle-7-local.sh` + `infra/scripts/verifiers/t6-cycle-7.ts`: 
  (a) admin lista users → 200 com rows
  (b) operator lista users → 403
  (c) legacy session lista users → 403 (role='operator' do fallback)
  (d) admin cria user → 201 + row no DB + actor_id do creator
  (e) admin desativa user → sessões do alvo deletadas + audit row
  (f) logout funcional cobre setup/teardown
- `state/evidence/T6-cycle-7/summary-local.json`.
- State note: `state/t6-cycle-7-users-admin-ui.md`.

### Histórico dos Ciclos anteriores
- **Ciclo 1.** Schema + scrypt. Ver `state/t6-cycle-1-schema-scrypt.md`.
- **Ciclo 2.** CLI de bootstrap + rota self-locking. Ver `state/t6-cycle-2-bootstrap-admin.md`.
- **Ciclo 3.** `writeAuditLog` com `actorId` aditivo. Ver `state/t6-cycle-3-audit-actor-id.md`.
- **Ciclo 4.** `requireCockpitSession` + proxy.ts com presença. Ver `state/t6-cycle-4-middleware-session.md`.
- **Ciclo 5.** Login/logout API + página `/cockpit/login`. Ver `state/t6-cycle-5-login-logout.md`.
- **Ciclo 6.** Actor propagado em 15 storage helpers + 12 rotas de cockpit; `actor_id` = userId (real) ou `'legacy-secret'` (fallback). Ver `state/t6-cycle-6-actor-propagation.md`.

## Acceptance bar
Each cycle: artifacts present + local verifier passes + state note written + evidence JSON in `state/evidence/T6-cycle-N/`. `npm run test` stays green. `COCKPIT_SECRET` fallback remains functional throughout.

## Rules
- No external auth/crypto dependencies (bcrypt, argon2, JWT libs — all forbidden; use node:crypto)
- No middleware DB calls (Edge runtime incompatibility)
- No callsite changes in cycles 1–3 (additive work only)
- Cookie hygiene: httpOnly + sameSite=lax + path=/ explicit
- `COCKPIT_SECRET` stays active all of T6
- No VLH dependency of any kind

## Canonical references
- `state/t6-opening.md`
- `state/t6-prompt.md`
- `state/t6-cycle-1-schema-scrypt.md`
- `state/t6-cycle-2-bootstrap-admin.md`
- `state/t6-cycle-3-audit-actor-id.md`
- `state/t6-cycle-4-middleware-session.md`
- `state/t6-cycle-5-login-logout.md`
- `state/t6-cycle-6-actor-propagation.md`
- `project.yaml`
- `ROADMAP.md`
- `T6_auth_rbac_prompt.md`
