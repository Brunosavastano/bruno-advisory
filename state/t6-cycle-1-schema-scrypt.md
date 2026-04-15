# T6 Cycle 1 — Schema & scrypt foundation

## What was built
- Modelo canônico de autenticação do cockpit com 3 papéis (`admin`, `operator`, `viewer`) e constantes oficiais (TTL de sessão, cookie, parâmetros scrypt OWASP 2024, sentinel `legacy-secret`).
- Hashing nativo via `node:crypto.scryptSync` (N=16384, r=8, p=1, keyLen=64, salt=32B) com formato self-describing `scrypt$N=...,r=...,p=...$<salt>$<hash>` e verificação em `timingSafeEqual`. Zero dependência externa.
- Duas tabelas SQLite novas: `cockpit_users` (UNIQUE email, CHECK role, is_active) e `cockpit_sessions` (token único, FK → users, expires_at).
- Coluna aditiva `audit_log.actor_id` via `ensureCockpitAuthColumns()` — NULL para registros pré-T6, reservada para `legacy-secret` quando fallback for usado (T7 remove).
- Módulo de armazenamento `cockpit-auth.ts` com CRUD completo (create/find/list/update user + session create/lookup/delete/purge + countActiveAdmins + isCockpitSessionValid). Delega hashing ao módulo canônico.
- Read-path de audit log já devolvendo `actorId`; write-path permanece intacto (Ciclo 3 adiciona o parâmetro).
- Types públicos em `apps/web/lib/storage/types.ts` (`CockpitUser`, `CockpitSession`, `CockpitSessionLookupRow`, campo `actorId` em `AuditLogEntry`).

## Where it is
- Modelo canônico: `packages/core/src/cockpit-auth-model.ts`
- Export do core: `packages/core/src/index.ts`
- Schema SQLite + helper de migração: `apps/web/lib/storage/db.ts` (`cockpitUsersTable`, `cockpitSessionsTable`, `ensureCockpitAuthColumns`)
- Storage/CRUD: `apps/web/lib/storage/cockpit-auth.ts`
- Types: `apps/web/lib/storage/types.ts`
- Audit read path: `apps/web/lib/storage/audit-log.ts`
- Verifier shell: `infra/scripts/verify-t6-cycle-1-local.sh`
- Verifier TS: `infra/scripts/verifiers/t6-cycle-1.ts`
- Evidence: `state/evidence/T6-cycle-1/summary-local.json`

## How to verify
1. `cd /tmp/bruno-advisory && npm run typecheck` (passa limpo)
2. `bash infra/scripts/verify-t6-cycle-1-local.sh`
3. Confirmar `ok: true` em `state/evidence/T6-cycle-1/summary-local.json`
4. Confirmar no summary:
   - `cockpitUsersColumns` contém as 8 colunas esperadas
   - `cockpitSessionsColumns` contém as 5 colunas esperadas
   - `auditLogHasActorId: true`
   - `cockpitUsersUniqueEmailPresent: true`
   - `cockpitSessionsHasForeignKey: true`
   - `cockpitUsersRoleCheckPresent: true`
   - `hashParams: "N=16384,r=8,p=1"`
   - `saltRandomness: true` (dois hashes da mesma senha diferem)
   - `verifyCorrectOk`, `verifyWrongRejected`, `verifyTamperRejected` todos `true`
   - `shortPasswordRejected: true`
   - `surfaceChecks` todos `true`
5. `npm run test` (13/13 testes lógicos verdes; ruído Windows EPERM no shutdown é pré-existente, não bloqueia)

## Design decisions
- **Hashing no model, não no storage.** `hashCockpitPassword` / `verifyCockpitPassword` vivem em `packages/core/src/cockpit-auth-model.ts` (folha, sem dependência de barrel), permitindo verificação isolada via `node --experimental-strip-types` sem bundler. O storage apenas re-exporta.
- **Read-path do audit_log já lê `actor_id`.** Cycle 1 entrega schema + leitura; Cycle 3 acrescenta o parâmetro de escrita. Isso evita qualquer leitor quebrar quando a coluna passar a ser populada.
- **Deactivação invalida sessões.** `updateCockpitUser(..., {isActive: false})` apaga sessions abertas do usuário atomicamente, garantindo "desativei = acesso cortado" sem esperar expirar.
- **Verificação híbrida.** Schema é validado via trigger real (POST intake cria o DB) + introspecção. Hashing é validado direto contra o modelo canônico. CRUD completo fica para o Ciclo 2 via bootstrap-admin CLI (primeiro caller real).

## Anti-scope cumprido
- Sem login API (Ciclo 5)
- Sem middleware mexido (Ciclo 4)
- Sem `writeAuditLog` com `actorId` (Ciclo 3)
- Sem propagação para route handlers (Ciclo 6)
- Sem UI (Ciclo 7)

## Remaining risk
- Sem bootstrap o DB ainda tem zero admins; rodar Ciclo 2 antes de encostar no middleware para evitar lockout quando `COCKPIT_SECRET` for removido em T7.
- `cockpit-auth.ts` não foi testado end-to-end em Cycle 1 (só o modelo canônico). A primeira validação real de CRUD acontece em Cycle 2.

## Next best step
- Abrir Cycle 2: CLI `scripts/bootstrap-admin.ts` idempotente que cria o primeiro admin lendo email/senha de argv ou stdin e exercita todo o CRUD do `cockpit-auth.ts`.
