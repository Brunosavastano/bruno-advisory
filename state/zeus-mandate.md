# Zeus Mandate — T6 Cockpit Auth & RBAC

## Date
2026-04-15

## Status
T6 is CLOSED (accepted 2026-04-15). See `state/t6-closure.md`.

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
| 8 | Regression + closure | ✅ accepted |

## Current cycle
Nenhum. T6 fechada.

### Cycle 8 deliverables entregues
- Contract-guard do Cycle 3 verifier reconciliado: assertion temporal (`callsitesWithActorId === 0`) retirada com comentário; runtime check da rota de stage agora usa fallback legacy e valida `actor_id='legacy-secret'`.
- `state/t6-closure.md` escrito.
- `project.yaml` atualizado para `tranche_status: done`, `stage_gate: auth_hardening_done`.
- Todos 7 verifiers rodaram verde em sequência. `npm run typecheck` limpo. Inner test suite 13/13 lógicos.
- Commit de closure pushado.

### Histórico consolidado (8 ciclos)
- **Ciclo 1.** Schema (`cockpit_users`, `cockpit_sessions`, `audit_log.actor_id`) + scrypt canônico. Ver `state/t6-cycle-1-schema-scrypt.md`.
- **Ciclo 2.** CLI `scripts/bootstrap-admin.ts` + rota self-locking `/api/cockpit/bootstrap-admin`. Ver `state/t6-cycle-2-bootstrap-admin.md`.
- **Ciclo 3.** `writeAuditLog` com `actorId?: string | null` aditivo. Ver `state/t6-cycle-3-audit-actor-id.md`.
- **Ciclo 4.** Helper `requireCockpitSession` + proxy.ts presence-only + `/api/cockpit/session`. Ver `state/t6-cycle-4-middleware-session.md`.
- **Ciclo 5.** `POST /api/cockpit/login` + `POST /api/cockpit/logout` + página `/cockpit/login`. Ver `state/t6-cycle-5-login-logout.md`.
- **Ciclo 6.** `actorId` propagado em 15 helpers + 12 rotas. Ver `state/t6-cycle-6-actor-propagation.md`.
- **Ciclo 7.** Users admin UI + API + `requireCockpitAdmin` + cockpit layout. Ver `state/t6-cycle-7-users-admin-ui.md`.
- **Ciclo 8.** Regression + closure. Ver `state/t6-closure.md`.

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
- `state/t6-closure.md`
- `project.yaml`
- `ROADMAP.md`
- `T6_auth_rbac_prompt.md`
