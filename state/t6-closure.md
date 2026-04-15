# T6 Closure — Cockpit Auth & RBAC

## Date
2026-04-15

## Status
**T6 closed by evidence.** All 8 cycles aceitos. `COCKPIT_SECRET` fallback permanece ativo por design (removido em T7).

## What T6 delivered
- **Schema canônico**: `cockpit_users`, `cockpit_sessions`, coluna `audit_log.actor_id` (Cycle 1).
- **Hashing canônico**: `scrypt` nativo via `node:crypto` (N=16384/r=8/p=1/keyLen=64/saltBytes=32), formato self-describing `scrypt$N=...,r=...,p=...$<salt>$<hash>`, verificação via `timingSafeEqual` (Cycle 1).
- **Bootstrap CLI + rota self-locking**: `scripts/bootstrap-admin.ts` + `/api/cockpit/bootstrap-admin` que retorna 409 `already_bootstrapped` quando `countActiveAdmins() > 0` (Cycle 2).
- **Audit signature aditivo**: `writeAuditLog` aceita `actorId?: string | null` sem quebrar os 19 callsites pré-existentes (Cycle 3).
- **Helper `requireCockpitSession`**: Node-runtime helper que lê cookies, valida sessão via DB, faz fallback para `COCKPIT_SECRET` com `actorId='legacy-secret'`, retorna 401/403 estruturado. Middleware Edge (`proxy.ts`) só checa presença (Cycle 4).
- **Login/logout end-to-end**: `POST /api/cockpit/login` (emite sessão + cookie httpOnly+sameSite=lax+path=/), `POST /api/cockpit/logout` (revoga sessão, expira cookie), página `/cockpit/login` (server action). Rotas públicas exentas do gating no proxy (Cycle 5).
- **Actor propagation completo**: 15 helpers de storage e 12 route handlers de cockpit propagam `actorId` via `requireCockpitSession`. Writes de operador carregam `actor_id = userId` (sessão real) ou `'legacy-secret'` (fallback). Writes de cliente/sistema permanecem com `actor_id NULL` (Cycle 6).
- **Users admin UI**: `/cockpit/users` com CRUD, API REST admin-only (`GET/POST /api/cockpit/users`, `PATCH /api/cockpit/users/[userId]`), layout com header + logout + banner de sessão legada, `requireCockpitAdmin` helper com gate duplo (session + role), last-admin protection (Cycle 7).

## Criterion-by-criterion coverage

| Critério do prompt/roadmap T6 | Evidência |
|---|---|
| Replace single-secret cockpit auth com contas individuais | Cycle 5 (login/logout), Cycle 7 (users admin) |
| 3 roles (admin/operator/viewer) com capability matrix | Cycle 1 (model), Cycle 4 (role no context), Cycle 7 (role-change UI) |
| Session-based auth com cookies httpOnly+sameSite | Cycle 5 (cookie flags verified em `A_valid_login`) |
| Individualized audit trail (`audit_log.actor_id`) | Cycle 1 (coluna), Cycle 3 (signature), Cycle 6 (propagação) |
| Preserve `COCKPIT_SECRET` fallback durante T6 | Cycle 4 (fallback retorna `actorId='legacy-secret'`), Cycle 5-7 reutilizam |
| No external crypto/auth dependencies | scrypt via `node:crypto`; sem bcrypt/argon2/JWT |
| No middleware DB calls (Edge runtime) | Cycle 4 (`proxy.ts` é presence-only; validação real em Node routes) |

## Evidence consolidated

Todas as evidências estão em `state/evidence/T6-cycle-*/summary-local.json`:

| Cycle | File | Status |
|---|---|---|
| 1 | `state/evidence/T6-cycle-1/summary-local.json` | ok: true |
| 2 | `state/evidence/T6-cycle-2/summary-local.json` | ok: true |
| 3 | `state/evidence/T6-cycle-3/summary-local.json` | ok: true (reconciliado em Cycle 8) |
| 4 | `state/evidence/T6-cycle-4/summary-local.json` | ok: true |
| 5 | `state/evidence/T6-cycle-5/summary-local.json` | ok: true |
| 6 | `state/evidence/T6-cycle-6/summary-local.json` | ok: true |
| 7 | `state/evidence/T6-cycle-7/summary-local.json` | ok: true |

Todos os 7 verifiers rodados em sequência em Cycle 8 fecharam verdes. `npm run typecheck` limpo. Inner test suite 13/13 lógicos (pre-existing Windows EPERM cleanup noise continua — não regressão).

## What Cycle 8 did
- Reconciliou o contract-guard do Cycle 3 (`callsitesWithActorId === 0`): o guard tinha caráter temporal (pré-Cycle-6) e foi legitimamente quebrado pelo Cycle 6. Retirado com comentário explícito; verificador agora reporta a contagem sem asserir zero.
- Atualizou o runtime check do Cycle 3: em vez de assumir `actor_id NULL` na rota de stage, agora usa o fallback legacy e verifica `actor_id='legacy-secret'`. Prova que o pipeline route → helper → DB permanece coerente.
- Rodou todos os 7 verifiers em sequência, typecheck, e test suite. Evidência atualizada.
- Atualizou `project.yaml` para `tranche_status: done`, `stage_gate: auth_hardening_done`.
- Consolidou fechamento neste documento.

## Deferrals explícitos (T7 e além)

**T7 — Removal of legacy secret:**
- Remover `COCKPIT_SECRET` completamente (env, middleware, helper fallback).
- Remover sentinel `'legacy-secret'` — rows antigas podem ficar como marca histórica.
- Rota de bootstrap + CLI precisam de novo caminho autorizado quando não há nenhum admin (bypass automático enquanto `adminCount === 0`).
- Remover exception no proxy para `/api/cockpit/logout` se logout passar a exigir sessão válida.

**T7+ (nice-to-have, não bloqueiam):**
- Audit trail para ações de users admin (create/update/deactivate) — atualmente sem rastro em `audit_log`.
- Rate-limit no login (brute-force scrypt N=16384 leva ~50-100ms/tentativa, aceitável para PF premium mas frágil para senhas curtas).
- CSRF explícito em server actions (Next App Router tem proteção built-in via Origin check, mas é opaca).
- Password reset self-service por email.
- 2FA / OTP.
- SSO / OAuth.
- Session refresh (atualmente TTL fixo de 30 dias).

## Tripwires post-T6

Se algum destes falhar, é sinal de drift:
1. `bash infra/scripts/verify-t6-cycle-7-local.sh` — exercita o full cycle (user admin + logout + last-admin guard).
2. `npm run typecheck` no repo root.
3. `node --experimental-strip-types --test apps/web/lib/storage/__tests__/*.test.ts` após `npm run build -w @bruno-advisory/web` — deve ficar em 13/13 lógicos.
4. Qualquer rota de cockpit que escreve audit sem chamar `requireCockpitSession(request)` é regressão. Todos os 12 route handlers identificados em Cycle 6 têm a chamada no topo.

## Architectural invariants now enforced
- `audit_log.actor_id` é NOT NULL apenas quando o ator é um operador cockpit (real session ou fallback legacy). Cliente/system writes ficam NULL.
- `requireCockpitSession` é o único caminho de autenticação para route handlers — 12 rotas o consomem em Cycle 6, mais `/api/cockpit/session` (Cycle 4) e `/api/cockpit/users*` (Cycle 7).
- Middleware (`proxy.ts`) nunca toca SQLite — toda validação real está em Node runtime dentro das rotas.
- Fallback `COCKPIT_SECRET` sempre resolve para `role: 'operator'` — admin surfaces ficam inacessíveis via secret.
- Deactivar user deleta sessões na mesma transação — corte de acesso imediato.
- Último admin ativo protegido de auto-demote/deactivate em duas camadas (API + server action).

## Closure signatures
- Dono: Vulcanus.
- Aceito por: Zeus.
- Autorização de abertura de T7: pendente de Bruno.
