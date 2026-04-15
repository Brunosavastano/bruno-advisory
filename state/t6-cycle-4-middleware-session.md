# T6 Cycle 4 — Middleware + requireCockpitSession

## What was built
- Helper `requireCockpitSession(request)` em `apps/web/lib/cockpit-session.ts` — Node runtime, roda dentro de route handlers. Lê cookies da `Request`, tenta o caminho de sessão real (lookup em `cockpit_sessions` + `cockpit_users`, validação por `isCockpitSessionValid`), cai para o fallback `COCKPIT_SECRET` e, se nada resolve, retorna 401 estruturado.
- Retorna `CockpitSessionCheck` — tagged union `{ ok: true, context } | { ok: false, status, body }`. Route handlers não precisam capturar exceção; é só um `if (!check.ok) return Response.json(...)`.
- Contexto distingue explicitamente sessão real (`legacy: false`, `actorId === userId`) de fallback legado (`legacy: true`, `actorId === 'legacy-secret'`, `userId: null`, `role: 'operator'`).
- 401 do caminho de sessão inclui `reason`: `session_expired` ou `user_disabled` — o fallback genérico (sem cookie, sem secret, ou secret errado) retorna `error: 'unauthorized'` sem reason para não dar pista de enumeração.
- Middleware (`apps/web/proxy.ts`) ampliado: além do `cockpit_token=SECRET`, agora aceita **presença** do cookie `cockpit_session` como sinal para deixar passar. Validação real fica na rota. Edge runtime intocado (sem DB).
- Primeira rota produtiva consumindo o helper: `GET /api/cockpit/session` → retorna o contexto serializado ou 401. Vai alimentar o header do cockpit em Cycle 7; para T6, serve também como superfície de prova.

## Where it is
- Helper: `apps/web/lib/cockpit-session.ts` (exporta `requireCockpitSession`, `COCKPIT_SESSION_COOKIE`, `COCKPIT_LEGACY_TOKEN_COOKIE`, `CockpitSessionContext`, `CockpitSessionCheck`)
- Middleware: `apps/web/proxy.ts` (adicionado `hasCockpitSessionCookie` e fast-path no `isAuthorizedCockpit`)
- Rota exemplar: `apps/web/app/api/cockpit/session/route.ts`
- Verifier shell: `infra/scripts/verify-t6-cycle-4-local.sh`
- Verifier TS: `infra/scripts/verifiers/t6-cycle-4.ts`
- Evidence: `state/evidence/T6-cycle-4/summary-local.json`

## How to verify
1. `bash infra/scripts/verify-t6-cycle-4-local.sh`
2. Confirmar `ok: true` em `state/evidence/T6-cycle-4/summary-local.json`
3. Confirmar 7 cenários verdes no summary:
   - **A_valid_session** — cookie `cockpit_session` válido → 200, `legacy: false`, `role: 'admin'`, `actorIdEqualsUserId: true`
   - **B_no_auth** — sem cookies, `COCKPIT_SECRET` setado no env → 401 `{ok:false, error:'unauthorized'}` (sem reason)
   - **C_legacy_token** — cookie `cockpit_token=SECRET` → 200, `legacy: true`, `actorId: 'legacy-secret'`, `role: 'operator'`
   - **D_expired_session** — token de sessão apontando para `expires_at` passado → 401 `reason: 'session_expired'`
   - **E_disabled_user** — token válido mas `is_active=0` → 401 `reason: 'user_disabled'`
   - **F_bogus_session** — token inexistente, sem legacy → 401
   - **G_bogus_session_plus_legacy** — token inexistente + legacy válido → 200 `legacy: true` (fallback funciona mesmo com session cookie sujo)
4. Confirmar middleware source-checks: `importsCockpitAuthModel`, `sessionCookieConst`, `presenceOnlyCheck`, `isAuthorizedChecksSession` — todos `true`
5. Confirmar helper source-checks: `exportsRequire`, `readsSessionCookie`, `readsLegacyCookie`, `setsLegacyActorId`, `usesIsValid`, `distinguishesDisabled`, `distinguishesExpired` — todos `true`
6. `npm run typecheck` limpo; inner test suite verde (13/13 lógicos; EPERM Windows permanece pré-existente)

## Design decisions
- **Tagged union em vez de exceção.** Route handlers são mais legíveis com `if (!check.ok) return ...`. Se fosse exceção, toda rota teria que montar um try/catch ou um middleware-helper adicional.
- **Middleware checa presença, rota checa verdade.** Edge runtime não pode abrir SQLite — qualquer tentativa quebra build. Por isso proxy.ts só faz `cookies.get(...).value`. Um atacante pode colocar um cookie `cockpit_session` arbitrário e passar pelo middleware, mas a rota retorna 401 quando `findCockpitSessionByToken` devolve null. Custo zero.
- **`reason` só no caminho de sessão.** 401 de "sem autenticação" não dá reason (evita enumeração "email existe mas está bloqueado"). 401 de "sessão existe mas inválida" dá reason porque o atacante já tem um token real (dele mesmo) — a info extra ajuda o UX ("sua sessão expirou, faça login novamente") sem vazar dados.
- **Fallback prevalece mesmo com session cookie inválido.** Cenário G: se alguém enviar session cookie bagunçado + secret válido, o helper cai para legacy. Isso garante que middleware secret sempre funciona enquanto T6 roda, independentemente do que o cliente mandar no outro cookie.
- **`role: 'operator'` no fallback.** Precisa de UM papel para calcular capabilities. Admin seria perigoso (qualquer operador com o secret teria poder de gerenciar usuários). Viewer seria quebrador (legacy precisa escrever). Operator é o menor privilégio funcional.

## Anti-scope cumprido
- Sem login/logout API — Cycle 5
- Sem propagação dos 19 callsites existentes — Cycle 6 (helper já existe mas é chamado só pela rota nova)
- Sem UI — Cycle 7
- Sem `writeAuditLog` real consumindo `context.actorId` — primeira chamada é via Cycle 6 (cycle 4 só expõe o contexto)
- Sem remoção de `COCKPIT_SECRET` — T7

## Remaining risk
- Nenhuma rota produtiva além de `/api/cockpit/session` usa o helper ainda. As 19 callsites do `writeAuditLog` só recebem `actorId` em Cycle 6. Até lá, todos os writes permanecem com `actor_id NULL` — consistente com a garantia de Cycle 3.
- `GET /api/cockpit/session` não é rate-limited. Para T6 isso é aceitável (cockpit tem usuários contados nos dedos). Para T7/T8 revisar.
- Cookie `cockpit_session` é setado só em Cycle 5 (login). Até lá, a única forma de obter o caminho "legacy: false" é via fixture direta (como o verifier faz) — é esperado.

## Next best step
- Abrir Ciclo 5: `POST /api/cockpit/login` (valida email+password com `verifyCockpitPassword`, emite sessão via `createCockpitSession`, seta cookie `cockpit_session` com `httpOnly + sameSite=lax + path=/` + `maxAge` = `sessionExpiryDays * 24 * 3600`) e `POST /api/cockpit/logout` (lê cookie, chama `deleteCockpitSessionByToken`, expira cookie). Página mínima `/cockpit/login` com form que posta JSON para o endpoint.
