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
| 1 | Schema & scrypt foundation | 🔴 open |
| 2 | Bootstrap admin CLI | ⏳ pending |
| 3 | Audit log actor_id signature | ⏳ pending |
| 4 | Middleware + requireCockpitSession | ⏳ pending |
| 5 | Login / logout API + page | ⏳ pending |
| 6 | Actor propagation (28 callsites) | ⏳ pending |
| 7 | Users admin UI | ⏳ pending |
| 8 | Regression + closure | ⏳ pending |

## Current cycle
**Cycle 1 — Schema & scrypt foundation**

### Deliverables
- `packages/core/src/cockpit-auth-model.ts` (canonical roles enum, TTL constant)
- `apps/web/lib/storage/cockpit-auth.ts` (scrypt helpers, user CRUD, session CRUD)
- DDL + `ensureCockpitAuthColumns()` in `apps/web/lib/storage/db.ts`
- Types added to `apps/web/lib/storage/types.ts`
- Verifier: `infra/scripts/verify-t6-cycle-1-local.sh`
- Evidence: `state/evidence/T6-cycle-1/summary-local.json` with `{ok, checkedAt, scryptRoundTrip, userCreated, sessionCreated}`
- State note: `state/t6-cycle-1-schema-scrypt.md`

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
- `project.yaml`
- `ROADMAP.md`
- `T6_auth_rbac_prompt.md`
