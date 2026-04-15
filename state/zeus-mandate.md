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
| 5 | Login / logout API + page | 🔴 open |
| 6 | Actor propagation (28 callsites) | ⏳ pending |
| 7 | Users admin UI | ⏳ pending |
| 8 | Regression + closure | ⏳ pending |

## Current cycle
**Cycle 5 — Login / logout API + page**

### Deliverables
- `POST /api/cockpit/login` em `apps/web/app/api/cockpit/login/route.ts`: recebe `{ email, password }`, valida via `findCockpitUserByEmail` + `verifyCockpitPassword`, cria sessão com `createCockpitSession`, seta cookie `cockpit_session` com `{ httpOnly: true, sameSite: 'lax', path: '/', secure: (prod), maxAge: sessionExpiryDays * 24 * 3600 }`, retorna `{ ok, userId, role, expiresAt }`. Respostas canônicas: 200 sucesso, 400 payload inválido, 401 credenciais erradas, 403 usuário desativado.
- `POST /api/cockpit/logout` em `apps/web/app/api/cockpit/logout/route.ts`: lê o cookie de sessão, chama `deleteCockpitSessionByToken`, expira o cookie via `Set-Cookie: cockpit_session=; Max-Age=0`, retorna `{ ok: true }`. Idempotente — logout sem cookie retorna 200.
- Página `/cockpit/login` (`apps/web/app/cockpit/login/page.tsx`): form mínimo não-autenticado (não é gated pela proxy — precisa ajuste no matcher ou em `isCockpitPageRoute` para excluir este path do gating), posta JSON para `/api/cockpit/login`, em sucesso redireciona para `/cockpit`, em erro mostra mensagem em linha.
- `infra/scripts/verify-t6-cycle-5-local.sh` + `infra/scripts/verifiers/t6-cycle-5.ts` — cenários: (a) login correto → 200 + cookie setado + sessão existe no DB; (b) login com email inexistente → 401; (c) login com senha errada → 401; (d) login com usuário inativo → 403; (e) logout remove a sessão do DB e expira o cookie; (f) após login, `GET /api/cockpit/session` retorna contexto real (integração com Cycle 4).
- `state/evidence/T6-cycle-5/summary-local.json`.
- State note: `state/t6-cycle-5-login-logout.md`.

### Histórico dos Ciclos anteriores
- **Ciclo 1.** Schema + scrypt. `cockpit_users`, `cockpit_sessions`, `audit_log.actor_id`. Ver `state/t6-cycle-1-schema-scrypt.md`.
- **Ciclo 2.** CLI de bootstrap + rota self-locking `/api/cockpit/bootstrap-admin`. Ver `state/t6-cycle-2-bootstrap-admin.md`.
- **Ciclo 3.** `writeAuditLog` com `actorId` aditivo; 19 callsites intactos. Ver `state/t6-cycle-3-audit-actor-id.md`.
- **Ciclo 4.** Helper `requireCockpitSession`, proxy.ts estendido para presença de cookie, rota `GET /api/cockpit/session`. 7 cenários verdes incluindo fallback legado com `actorId='legacy-secret'`. Ver `state/t6-cycle-4-middleware-session.md`.

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
- `project.yaml`
- `ROADMAP.md`
- `T6_auth_rbac_prompt.md`
