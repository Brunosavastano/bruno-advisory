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
| 6 | Actor propagation (19 callsites) | 🔴 open |
| 7 | Users admin UI | ⏳ pending |
| 8 | Regression + closure | ⏳ pending |

## Current cycle
**Cycle 6 — Actor propagation (19 callsites)**

### Deliverables
- Propagação de `actorId` nas 19 callsites de `writeAuditLog` distribuídas em `apps/web/lib/storage/{billing,checklist,documents,leads,memos,portal,recommendations,research-workflows}.ts`.
- Cada rota mutadora (estágio comercial, tasks, notes, memos, portal invites, checklist, documents, recommendations, research-workflows, billing, flags, etc.) passa a chamar `requireCockpitSession(request)` no topo, pegar `context.actorId` do resultado e propagar para o helper de storage correspondente.
- Helpers de storage recebem `actorId` como parâmetro opcional (aditivo, default undefined → NULL no audit) e repassam para `writeAuditLog`.
- Quando o caller vem do fallback `COCKPIT_SECRET` (context.legacy === true), o `actorId` fica `'legacy-secret'` — sentinel de auditoria para T7 remover.
- `infra/scripts/verify-t6-cycle-6-local.sh` + `infra/scripts/verifiers/t6-cycle-6.ts`: exercita uma rota representativa de cada módulo de storage via HTTP simulado; assert (a) audit_log row gravada com actor_id === userId da sessão real; (b) mesma rota chamada com cockpit_token fallback grava actor_id='legacy-secret'; (c) mesma rota sem auth retorna 401.
- `state/evidence/T6-cycle-6/summary-local.json` com contagem de callsites cobertos e resultado por módulo.
- State note: `state/t6-cycle-6-actor-propagation.md`.

### Histórico dos Ciclos anteriores
- **Ciclo 1.** Schema + scrypt. `cockpit_users`, `cockpit_sessions`, `audit_log.actor_id`. Ver `state/t6-cycle-1-schema-scrypt.md`.
- **Ciclo 2.** CLI de bootstrap + rota self-locking `/api/cockpit/bootstrap-admin`. Ver `state/t6-cycle-2-bootstrap-admin.md`.
- **Ciclo 3.** `writeAuditLog` com `actorId` aditivo; 19 callsites intactos. Ver `state/t6-cycle-3-audit-actor-id.md`.
- **Ciclo 4.** Helper `requireCockpitSession`, proxy.ts estendido para presença de cookie, rota `GET /api/cockpit/session`. Fallback com `actorId='legacy-secret'`. Ver `state/t6-cycle-4-middleware-session.md`.
- **Ciclo 5.** `POST /api/cockpit/login` + `POST /api/cockpit/logout` + página `/cockpit/login` (server action). Middleware exenta rotas públicas. 7 cenários runtime + 12 source-text verdes. Ver `state/t6-cycle-5-login-logout.md`.

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
- `project.yaml`
- `ROADMAP.md`
- `T6_auth_rbac_prompt.md`
