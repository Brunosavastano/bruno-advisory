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
| 2 | Bootstrap admin CLI | 🔴 open |
| 3 | Audit log actor_id signature | ⏳ pending |
| 4 | Middleware + requireCockpitSession | ⏳ pending |
| 5 | Login / logout API + page | ⏳ pending |
| 6 | Actor propagation (28 callsites) | ⏳ pending |
| 7 | Users admin UI | ⏳ pending |
| 8 | Regression + closure | ⏳ pending |

## Current cycle
**Cycle 2 — Bootstrap admin CLI**

### Deliverables
- `scripts/bootstrap-admin.ts` — CLI idempotente: aceita `--email`, `--name`, `--password` via argv ou stdin interativo; cria 1º admin se ausente; em segundo run com mesmo email retorna erro limpo sem alterar o DB; exercita todo o CRUD do `cockpit-auth.ts`.
- `infra/scripts/verify-t6-cycle-2-local.sh` + `infra/scripts/verifiers/t6-cycle-2.ts` — chama o script 2× e confere que (a) o primeiro run cria um `cockpit_user` com role=admin, is_active=1, password_hash válido; (b) o segundo run falha com erro legível; (c) `countActiveAdmins()` permanece 1.
- `state/evidence/T6-cycle-2/summary-local.json` com `{ok, checkedAt, firstRunCreatedUserId, secondRunRejected, activeAdminCountAfter}`.
- State note: `state/t6-cycle-2-bootstrap-admin.md`.

### Histórico do Ciclo 1
Entregue. Ver `state/evidence/T6-cycle-1/summary-local.json` e `state/t6-cycle-1-schema-scrypt.md`. Schema (`cockpit_users`, `cockpit_sessions`, coluna `audit_log.actor_id`), hashing canônico com scrypt no modelo do core, types públicos e read-path do audit já com `actorId`. CRUD completo (`cockpit-auth.ts`) foi construído mas ainda sem caller real — Cycle 2 é o primeiro.

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
- `project.yaml`
- `ROADMAP.md`
- `T6_auth_rbac_prompt.md`
