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
| 3 | Audit log actor_id signature | 🔴 open |
| 4 | Middleware + requireCockpitSession | ⏳ pending |
| 5 | Login / logout API + page | ⏳ pending |
| 6 | Actor propagation (28 callsites) | ⏳ pending |
| 7 | Users admin UI | ⏳ pending |
| 8 | Regression + closure | ⏳ pending |

## Current cycle
**Cycle 3 — Audit log actor_id signature**

### Deliverables
- Parâmetro aditivo `actorId?: string | null` na assinatura de `writeAuditLog` (default `null`) sem alterar nenhum callsite existente.
- Testes cobrindo: gravação com `actorId` explícito (string), gravação sem `actorId` (fica `null`), gravação com `actorId: null` explícito, round-trip pelo read-path (`listAuditLog` devolve o mesmo valor).
- `infra/scripts/verify-t6-cycle-3-local.sh` + `infra/scripts/verifiers/t6-cycle-3.ts` — typecheck + build + assertions de contrato.
- `state/evidence/T6-cycle-3/summary-local.json` com `{ok, checkedAt, actorIdDefaultNull, actorIdStringRoundTrip, actorIdNullExplicitRoundTrip, callsitesUnchanged}`.
- State note: `state/t6-cycle-3-audit-actor-id.md`.

### Histórico dos Ciclos anteriores
- **Ciclo 1.** Entregue. Ver `state/evidence/T6-cycle-1/summary-local.json` e `state/t6-cycle-1-schema-scrypt.md`. Schema (`cockpit_users`, `cockpit_sessions`, coluna `audit_log.actor_id`), hashing canônico com scrypt no modelo do core, types públicos e read-path do audit já com `actorId`.
- **Ciclo 2.** Entregue. Ver `state/evidence/T6-cycle-2/summary-local.json` e `state/t6-cycle-2-bootstrap-admin.md`. CLI `scripts/bootstrap-admin.ts` + rota self-locking `apps/web/app/api/cockpit/bootstrap-admin/route.ts`. Idempotência provada por snapshot diff (userId, passwordHash, createdAt inalterados entre runs); lockout provado por 409 `already_bootstrapped` no POST direto após o primeiro run.

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
- `project.yaml`
- `ROADMAP.md`
- `T6_auth_rbac_prompt.md`
