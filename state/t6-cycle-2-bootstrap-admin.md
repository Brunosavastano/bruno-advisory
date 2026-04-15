# T6 Cycle 2 — Bootstrap admin CLI

## What was built
- CLI idempotente `scripts/bootstrap-admin.ts` que cria o primeiro admin do cockpit: aceita `--email`, `--name`, `--password` via argv com fallback para stdin interativo (senha em modo silencioso via raw TTY). Sem dependências externas; roda via `node --experimental-strip-types` contra a rota Next compilada.
- Rota interna self-locking `apps/web/app/api/cockpit/bootstrap-admin/route.ts`:
  - `GET` → `{ok, needsBootstrap, adminCount, totalUsers}`.
  - `POST` → valida payload → checa `countActiveAdmins() > 0` → se sim, 409 `already_bootstrapped`; se não, cria admin via `createCockpitUser({role: 'admin', ...})`.
  - Gated por middleware atual (`COCKPIT_SECRET`) — mantém o fallback ativo por T6.
- Auto-build da rota pelo CLI quando `.next/server/app/api/cockpit/bootstrap-admin/route.js` não existe, seguindo o padrão `requireUserland` já usado em `seed-beta.sh`.
- Exit codes explícitos: `0` sucesso; `2` lockout (admin já existe); `3` input inválido; `4` falha genérica.
- Validação local repetível: `infra/scripts/verify-t6-cycle-2-local.sh` + `infra/scripts/verifiers/t6-cycle-2.ts`.

## Where it is
- CLI: `scripts/bootstrap-admin.ts`
- Rota auto-bloqueante: `apps/web/app/api/cockpit/bootstrap-admin/route.ts`
- Re-export do storage: `apps/web/lib/intake-storage.ts` (re-exporta `cockpit-auth`)
- Verifier shell: `infra/scripts/verify-t6-cycle-2-local.sh`
- Verifier TS: `infra/scripts/verifiers/t6-cycle-2.ts`
- Evidence: `state/evidence/T6-cycle-2/summary-local.json`

## How to verify
1. `bash infra/scripts/verify-t6-cycle-2-local.sh`
2. Confirmar `ok: true` em `state/evidence/T6-cycle-2/summary-local.json`
3. Confirmar no summary:
   - `firstRun.exitCode: 0` e `firstRun.createdUserId` presente, `createdRole: "admin"`, `passwordHashPrefix: "scrypt$N=16384,r=8,p=1"`, `adminCountAfter: 1`
   - `secondRun.exitCode: 2`, `rejected: true`, `unchangedUserId: true`, `unchangedPasswordHash: true`, `unchangedCreatedAt: true`, `totalUsersAfter: 1`, `adminCountAfter: 1`
   - `routeSurface.getNeedsBootstrap: false`, `getAdminCount: 1`, `directPostAfterLockoutStatus: 409`, `directPostAfterLockoutCode: "already_bootstrapped"`
4. `npm run typecheck` limpo
5. `npm run test` verde (13/13; ruído Windows EPERM é pré-existente, não bloqueia)

## Design decisions
- **Rota self-locking em vez de flag externa.** O lockout vive no código da rota (`countActiveAdmins() > 0` → 409), não em config ou env. Bootstrap fica permanentemente inerte após o primeiro admin sem depender de alguém lembrar de desligar um feature flag.
- **Rota pública (`/api/cockpit/bootstrap-admin`) em vez de privada (`_internal/`).** Next trata `_*` como pastas privadas e as exclui do roteamento — a rota precisa ser roteada para responder. A proteção real é o self-lock + `COCKPIT_SECRET` do middleware atual.
- **CLI invoca a rota compilada, não o módulo TS diretamente.** Mesmo padrão de `seed-beta.sh`: `requireUserland` contra `.next/server/app/api/.../route.js`. Evita barrel ESM do core + prova que a rota build-passa.
- **`process.chdir(tempRoot)` antes de `requireFromRoot`.** `db.ts` captura `repoRoot = findRepoRoot(process.cwd())` em tempo de carregamento do módulo. Se o chdir vier depois do require, o handler abre o DB real do dev, não o isolado — bug silencioso que mascara o lockout.
- **Snapshot diff como assertion.** O verifier compara `userId`, `passwordHash` e `createdAt` entre primeiro e segundo run; um "rejected" falso que ainda mutasse o DB seria capturado.

## Anti-scope cumprido
- Sem login/logout API (Ciclo 5)
- Sem middleware mexido (Ciclo 4)
- Sem `writeAuditLog` com `actorId` no write path (Ciclo 3)
- Sem propagação para route handlers (Ciclo 6)
- Sem UI (Ciclo 7)
- Bootstrap não troca senha nem promove operator → admin (fora de escopo até Ciclo 7)

## Remaining risk
- CLI ainda depende do middleware atual (`COCKPIT_SECRET`) para autorizar o POST. Quando Ciclo 4 substituir o middleware, o CLI precisa de um caminho autorizado — ou via bypass explícito de bootstrap (rota aberta enquanto `adminCount === 0`) ou via header/env dedicado. Decisão diferida para Ciclo 4.
- Nenhum teste ainda cobre o caminho de criação de operator/viewer via `createCockpitUser`. Primeiro caller real desses papéis é o Ciclo 7 (UI de admin).

## Next best step
- Abrir Ciclo 3: adicionar `actorId?: string | null` ao write-path de `writeAuditLog` de forma aditiva, sem mudar callsites. Default `null` preserva compatibilidade; sentinel `legacy-secret` entra em Ciclo 4 quando o middleware fizer o fallback explícito.
