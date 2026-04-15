# T6 Cycle 5 — Login / logout API + page

## What was built
- `POST /api/cockpit/login` em `apps/web/app/api/cockpit/login/route.ts`: lê `{email, password}`, valida via `findCockpitUserByEmail` + `verifyPassword` (constante no tempo), cria sessão via `createCockpitSession`, emite cookie `cockpit_session` com `HttpOnly; SameSite=Lax; Path=/; Max-Age=<sessionExpiryDays * 24 * 3600>` (e `Secure` quando `x-forwarded-proto=https`). Status canônicos: 200 sucesso, 400 payload inválido, 401 `invalid_credentials`, 403 `user_disabled`.
- `POST /api/cockpit/logout` em `apps/web/app/api/cockpit/logout/route.ts`: parseia o cookie, chama `deleteCockpitSessionByToken`, emite Set-Cookie com `Max-Age=0` + `Expires=Thu, 01 Jan 1970`. Idempotente — sem cookie retorna 200 `revoked:false`.
- Página `/cockpit/login` em `apps/web/app/cockpit/login/page.tsx`: server-action form (mesmo padrão de `/portal/login`), posta email+senha, em sucesso chama `cookieStore.set(...)` usando `cockpitAuthModel.cookie.*` e redireciona para `/cockpit/leads`. Em erro redireciona para `/cockpit/login?error=...`.
- Proxy (middleware) atualizado: nova função `isCockpitPublicRoute` exenta `/cockpit/login`, `/api/cockpit/login`, `/api/cockpit/logout` da checagem de auth — caso contrário seria impossível chegar na tela de login.

## Where it is
- Rota login: `apps/web/app/api/cockpit/login/route.ts`
- Rota logout: `apps/web/app/api/cockpit/logout/route.ts`
- Página: `apps/web/app/cockpit/login/page.tsx`
- Middleware: `apps/web/proxy.ts` (função `isCockpitPublicRoute` + short-circuit)
- Verifier shell: `infra/scripts/verify-t6-cycle-5-local.sh`
- Verifier TS: `infra/scripts/verifiers/t6-cycle-5.ts`
- Evidence: `state/evidence/T6-cycle-5/summary-local.json`

## How to verify
1. `bash infra/scripts/verify-t6-cycle-5-local.sh`
2. Confirmar `ok: true` em `state/evidence/T6-cycle-5/summary-local.json`
3. Confirmar 7 cenários verdes:
   - **A_valid_login** — 200 com Set-Cookie contendo `HttpOnly; SameSite=Lax; Path=/; Max-Age=<n>`, sem `Secure` em http local, `sessionRowWritten: true`
   - **B_unknown_email** — 401 `error: 'invalid_credentials'`
   - **C_wrong_password** — 401 `error: 'invalid_credentials'` (mesmo body do B — sem enumeração)
   - **D_disabled_user** — 403 `error: 'user_disabled'`
   - **E_session_after_login** — `/api/cockpit/session` com o cookie de A retorna `legacy: false`, `userId` idêntico ao admin (integração com Cycle 4)
   - **F_logout_with_cookie** — logout retorna 200 `revoked: true`, Set-Cookie tem `Max-Age=0`, linha some do DB, `/api/cockpit/session` com cookie revogado volta a 401
   - **G_logout_without_cookie** — 200 `revoked: false` (idempotente)
4. Source-text checks: 4 no middleware (exenta login/logout) + 8 na página (usa cookie model, chama verifyPassword/createSession, redireciona para /cockpit/leads)
5. `npm run typecheck` limpo; inner test suite 13/13 lógicos (EPERM Windows permanece pré-existente)

## Design decisions
- **401 genérico em B e C.** Unknown email e wrong password retornam o MESMO body `{ok:false, error:'invalid_credentials'}`. Nenhum vazamento lateral via timing (scrypt é constante) ou via body (mensagem idêntica). Disabled é 403 com reason explícito — ok porque o atacante já passou na senha; no-op negar isso.
- **`Secure` condicional.** Cookie não leva `Secure` em http local (dev). Detecção por `x-forwarded-proto`. Alternativa seria checar `NODE_ENV==='production'` mas isso quebra HTTPS local atrás de tunnel/proxy. Header é mais correto.
- **Set-Cookie manual com string concatenada.** Em vez de `response.cookies.set(...)` (API do Next que varia entre versões), montamos a string. Ganha: portabilidade entre Next 14/15/16 e debugabilidade (é visível no test). Perda: nenhuma — `Response` do Web standard aceita `set-cookie` via header direto.
- **Server action na página em vez de fetch no cliente.** Consistente com `/portal/login`. Ganha: JS desabilitado ainda funciona, cookie é setado no servidor sem round-trip extra. Perda: sem feedback em-tempo-real; erros vão via query string. Aceitável para login — não é UX de app viva.
- **Redirecta para `/cockpit/leads`.** Cockpit não tem um `/cockpit` root page; leads é o landing canônico dos operadores. Cycle 7 revisita quando a UI de users + header estiver pronta.
- **Exemption em middleware, não no path dos handlers.** Poderia gatekeear via `requireCockpitSession` e deixar a rota de login retornar o que quiser, mas a ideia é que o login NUNCA precise passar pela checagem de sessão — é a porta de entrada. Middleware é o lugar certo para marcar como pública.

## Anti-scope cumprido
- Sem propagação de `actorId` para as 19 callsites — Cycle 6
- Sem UI de users/admin — Cycle 7
- Sem header com logout button — Cycle 7
- Sem rate-limiting (explicitamente aceito para T6; T7+ revisita)
- Sem remoção de `COCKPIT_SECRET` — T7
- Sem "forgot password" — fora de escopo permanente (admin redefine via CLI ou UI em Cycle 7)

## Remaining risk
- Login não tem rate-limit. Atacante pode brute-force offline-style: scrypt N=16384 custa ~50-100ms por tentativa, então 1k tentativas = ~1min. Para PF premium com senhas longas é aceitável; para T7 revisitar se surgirem credenciais fracas.
- Página de login usa redirecionamento com erro em query string — URL fica `?error=Credenciais%20inválidas.` visível no histórico do browser. Não sensível, mas feio. Cycle 7 pode trocar por state local.
- Se `COCKPIT_SECRET` estiver ativo, quem tem o secret ainda pode bypassar login — é o ponto do fallback durante T6. T7 remove.

## Next best step
- Abrir Ciclo 6: propagar `actorId` nos 19 callsites de `writeAuditLog` consumindo `context.actorId` do `requireCockpitSession`. Cada rota mutadora (stage, tasks, notes, memos, portal invites, checklist, documents, recommendations, research-workflows, billing, flags) precisa: (a) chamar `requireCockpitSession` no topo; (b) propagar `context.actorId` para o helper de storage; (c) helpers de storage propagarem para `writeAuditLog`. Alternativa mais leve: passar o contexto inteiro para o helper, que decide o que gravar. Decidir no opening do ciclo.
