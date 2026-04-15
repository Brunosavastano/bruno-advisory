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
| 7 | Users admin UI | ✅ accepted |
| 8 | Regression + closure | 🔴 open |

## Current cycle
**Cycle 8 — Regression + closure**

### Deliverables
- Reconciliar o contract-guard do Cycle 3 verifier (`callsitesWithActorId === 0`): Cycle 6 quebrou-o por design; substituir pela assertion "callsites > 0 && coerência de signature" OU retirar a assertion explicitamente com comentário "quebrado por Cycle 6".
- Rodar `npm run typecheck`, `npm run test` e os 7 verifiers de cycle em sequência — atualizar `state/evidence/T6-cycle-*/summary-local.json` se necessário — e confirmar todos `ok: true`.
- `state/t6-closure.md`: critérios do prompt/roadmap de T6 cumpridos, evidência consolidada, deferrals explícitos (T7: remover `COCKPIT_SECRET` + sentinel `legacy-secret`; audit trail para users admin actions; rate-limit no login).
- Atualizar `project.yaml` para `tranche_status: done`, `active_tranche: T6` (e marcar próximo `stage_gate` apropriado).
- Commit de closure + push.

### Histórico dos Ciclos anteriores
- **Ciclo 1.** Schema + scrypt. Ver `state/t6-cycle-1-schema-scrypt.md`.
- **Ciclo 2.** CLI de bootstrap + rota self-locking. Ver `state/t6-cycle-2-bootstrap-admin.md`.
- **Ciclo 3.** `writeAuditLog` com `actorId` aditivo. Ver `state/t6-cycle-3-audit-actor-id.md`.
- **Ciclo 4.** `requireCockpitSession` + proxy.ts com presença. Ver `state/t6-cycle-4-middleware-session.md`.
- **Ciclo 5.** Login/logout API + página `/cockpit/login`. Ver `state/t6-cycle-5-login-logout.md`.
- **Ciclo 6.** Actor propagado em 15 storage helpers + 12 rotas. Ver `state/t6-cycle-6-actor-propagation.md`.
- **Ciclo 7.** Users admin UI + layout com logout header + `requireCockpitAdmin` + last-admin protection + deactivation drop sessions. Ver `state/t6-cycle-7-users-admin-ui.md`.

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
- `state/t6-cycle-7-users-admin-ui.md`
- `project.yaml`
- `ROADMAP.md`
- `T6_auth_rbac_prompt.md`
