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
| 4 | Middleware + requireCockpitSession | 🔴 open |
| 5 | Login / logout API + page | ⏳ pending |
| 6 | Actor propagation (28 callsites) | ⏳ pending |
| 7 | Users admin UI | ⏳ pending |
| 8 | Regression + closure | ⏳ pending |

## Current cycle
**Cycle 4 — Middleware + requireCockpitSession**

### Deliverables
- Helper `requireCockpitSession(request)` em `apps/web/lib/cockpit-auth-server.ts` (ou similar) que roda DENTRO de route handlers (Node runtime), lê o cookie de sessão, valida via `findCockpitSessionByToken` + `isCockpitSessionValid`, devolve `{ userId, role }` ou 401/410. Jamais é chamado em `middleware.ts` (Edge runtime não pode tocar SQLite).
- Middleware Edge mantém apenas checagem barata: presença de cookie OU `COCKPIT_SECRET`. Se nenhum, redireciona/401. Se tem cookie, passa adiante — route handler valida de verdade.
- Fallback `COCKPIT_SECRET`: quando o middleware aceita via secret (sem cookie de sessão), o route handler detecta essa condição e passa `actorId: 'legacy-secret'` às chamadas de `writeAuditLog`. Primeira rota a receber esse tratamento fica a critério do ciclo (provavelmente uma rota de cockpit leve).
- `infra/scripts/verify-t6-cycle-4-local.sh` + `infra/scripts/verifiers/t6-cycle-4.ts` — assert: (a) `requireCockpitSession` retorna contexto válido com cookie de sessão real; (b) retorna 401 sem cookie e sem secret; (c) com secret mas sem cookie, retorna contexto com `role: 'operator'` (fallback) e o caller que escrever audit_log grava `actor_id: 'legacy-secret'`; (d) sessão expirada é rejeitada (401); (e) sessão de usuário desativado é rejeitada.
- `state/evidence/T6-cycle-4/summary-local.json`.
- State note: `state/t6-cycle-4-middleware-session.md`.

### Histórico dos Ciclos anteriores
- **Ciclo 1.** Entregue. Schema (`cockpit_users`, `cockpit_sessions`, coluna `audit_log.actor_id`), hashing canônico com scrypt no modelo do core, types públicos e read-path do audit já com `actorId`. Ver `state/t6-cycle-1-schema-scrypt.md`.
- **Ciclo 2.** Entregue. CLI `scripts/bootstrap-admin.ts` + rota self-locking `apps/web/app/api/cockpit/bootstrap-admin/route.ts`. Idempotência via snapshot diff; lockout via 409 `already_bootstrapped`. Ver `state/t6-cycle-2-bootstrap-admin.md`.
- **Ciclo 3.** Entregue. Assinatura aditiva `actorId?: string | null` em `writeAuditLog`, INSERT atualizado, 19 callsites intactos. Read-path já entrega `actorId`; verifier cobre source+runtime+round-trip. Ver `state/t6-cycle-3-audit-actor-id.md`.

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
- `project.yaml`
- `ROADMAP.md`
- `T6_auth_rbac_prompt.md`
